import uuid
import datetime
import hashlib
import base64
from typing import Dict, Any, Optional, List, Tuple

from app.core.config import settings
from app.core.logging import logger
from app.schemas.requests import ResearchRequest, FollowUpRequest, CompareRequest, ImageIdentificationRequest
from app.schemas.medication import (
    MedicationResearchResponse,
    FollowUpAnswerResponse,
    MedicationComparisonResponse,
    SourceRefreshResponse,
    ImageIdentificationResponse,
    ServiceStatusMeta,
    MedicineIdentity,
    FactualSection,
    MemoryContextMeta,
)
from app.schemas.sources import NormalizedSource
from app.services.source_validator import source_validator
from app.services.database_service import db_service
from app.services.query_resolver import query_resolver
from app.adapters.firecrawl_adapter import FirecrawlAdapterFactory, BaseFirecrawlAdapter
from app.adapters.memento_adapter import MementoAdapterFactory, BaseMementoAdapter
from app.adapters.llm_adapter import LLMAdapterFactory, BaseLLMAdapter

# Emergency keywords that require immediate clinical redirection
EMERGENCY_KEYWORDS = [
    "overdose", "poison", "swallowed a bottle", "chest pain",
    "cannot breathe", "difficulty breathing", "suicide", "seizure",
    "unconscious", "anaphylaxis", "severe allergic reaction", "bleeding profusely"
]

# Clinical prescription keywords that must not be handled as personalized advice
PRESCRIPTION_KEYWORDS = [
    "should i take", "how much should i take", "prescribe me", "can you prescribe",
    "what dose should i start", "change my dose", "stop taking my", "diagnose me"
]

class ResearchOrchestrator:
    def __init__(
        self,
        firecrawl_adapter: Optional[BaseFirecrawlAdapter] = None,
        memento_adapter: Optional[BaseMementoAdapter] = None,
        llm_adapter: Optional[BaseLLMAdapter] = None
    ):
        self.firecrawl = firecrawl_adapter or FirecrawlAdapterFactory.get_adapter()
        self.memento = memento_adapter or MementoAdapterFactory.get_adapter()
        self.llm = llm_adapter or LLMAdapterFactory.get_adapter()

    def get_service_status(self) -> ServiceStatusMeta:
        return ServiceStatusMeta(
            firecrawl=self.firecrawl.get_status(),
            memento=self.memento.get_status(),
            llm=self.llm.get_status(),
            database={
                "url": settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else settings.DATABASE_URL,
                "status": "connected"
            }
        )

    def check_safety_and_clinical_scope(self, query: str) -> Tuple[bool, Optional[str]]:
        """
        Detects emergency or personalized clinical questions and returns safety notice.
        """
        q_lower = query.lower()

        # Emergency check
        for kw in EMERGENCY_KEYWORDS:
            if kw in q_lower:
                return True, (
                    "URGENT SAFETY ALERT: This request references symptoms of acute medical emergency, poisoning, or overdose. "
                    "DrugInfo AI is an educational tool and CANNOT provide emergency care. "
                    "Immediately contact local emergency services (such as 911, 999, 112, or local poison control center) "
                    "or proceed to the nearest emergency medical department."
                )

        # Personalized diagnosis/prescribing check
        for kw in PRESCRIPTION_KEYWORDS:
            if kw in q_lower:
                return True, (
                    "CLINICAL SCOPE NOTICE: DrugInfo AI cannot provide personalized medical diagnosis, prescription advice, "
                    "or individual dosage adjustments. Medication decisions must always be made in consultation with a licensed "
                    "physician or healthcare provider based on your complete medical history and diagnostic evaluation."
                )

        return False, None

    # ─── Private response builders ────────────────────────────────────────────

    def _build_conversational_response(
        self, req: ResearchRequest, text: str, now_iso: str
    ) -> MedicationResearchResponse:
        return MedicationResearchResponse(
            request_id=f"conv-{uuid.uuid4().hex[:8]}",
            medicine=MedicineIdentity(display_name="DrugInfo AI"),
            overview=FactualSection(text=text, source_ids=[]),
            reviewed_at=now_iso,
            is_safety_warning=False,
            service_status=self.get_service_status(),
        )

    def _build_safety_response(
        self, req: ResearchRequest, text: str, now_iso: str, intent: str = "safety_blocked"
    ) -> MedicationResearchResponse:
        return MedicationResearchResponse(
            request_id=f"{intent[:6]}-{uuid.uuid4().hex[:8]}",
            medicine=MedicineIdentity(display_name="DrugInfo AI"),
            overview=FactualSection(text=text, source_ids=[]),
            reviewed_at=now_iso,
            is_safety_warning=True,
            safety_guidance=text,
            service_status=self.get_service_status(),
        )

    def _build_clarification_response(
        self, req: ResearchRequest, text: str, now_iso: str
    ) -> MedicationResearchResponse:
        return MedicationResearchResponse(
            request_id=f"clarify-{uuid.uuid4().hex[:8]}",
            medicine=MedicineIdentity(display_name="Clarification Needed"),
            overview=FactualSection(text=text, source_ids=[]),
            reviewed_at=now_iso,
            is_safety_warning=False,
            service_status=self.get_service_status(),
        )

    def _build_evidence_insufficient_response(
        self, req: ResearchRequest, medicine: str, now_iso: str
    ) -> MedicationResearchResponse:
        return MedicationResearchResponse(
            request_id=f"insuff-{uuid.uuid4().hex[:8]}",
            medicine=MedicineIdentity(display_name=medicine),
            overview=FactualSection(
                text=(
                    f"DrugInfo AI could not retrieve sufficient verified clinical evidence for '{medicine}' "
                    f"from authoritative sources at this time. This does not mean the medicine is unrecognised — "
                    f"the data may not yet be available in the connected knowledge base. "
                    f"Please consult official prescribing information, a pharmacist, or a licensed healthcare provider."
                ),
                source_ids=[],
            ),
            reviewed_at=now_iso,
            is_safety_warning=False,
            service_status=self.get_service_status(),
        )

    # ─── Main Research Pipeline ────────────────────────────────────────────────

    async def conduct_research(self, req: ResearchRequest) -> MedicationResearchResponse:
        logger.info(f"Conducting research for query: {req.query}, medicine_name: {req.medicine_name}")

        now_iso = datetime.datetime.utcnow().isoformat() + "Z"

        # 1. SAFETY TRIAGE — emergency and clinical-scope check (keep existing behaviour)
        is_unsafe, safety_msg = self.check_safety_and_clinical_scope(req.query)
        if is_unsafe:
            resp = self._build_safety_response(req, safety_msg, now_iso, intent="safety_alert")
            await db_service.save_research_record(
                request_id=resp.request_id,
                session_id=req.session_id,
                medicine_name=req.medicine_name or req.query[:60],
                query=req.query,
                summary_dict=resp.model_dump(),
                intent="safety_alert",
            )
            return resp

        # 2. INTENT CLASSIFICATION — BEFORE setting target_medicine
        from app.services.intent_service import intent_service
        from app.services.query_expansion import expand_retrieval_queries

        intent_result = await intent_service.classify(
            query=req.query,
            session_id=req.session_id,
            active_medicine=req.medicine_name,
            dialogue_history=None,
        )
        logger.info(
            f"[Research] Intent={intent_result.intent.value}, "
            f"medicines={intent_result.medicine_names}, "
            f"prescription_req={intent_result.user_requests_prescription}"
        )

        # 3. ROUTE NON-RESEARCH INTENTS immediately (no medicine lookup)
        intent_val = intent_result.intent.value

        if intent_val == "GENERAL_CONVERSATION":
            return self._build_conversational_response(
                req,
                "Hello! I'm DrugInfo AI — I provide verified educational information about medications. "
                "Ask me about any drug's uses, side effects, interactions, or precautions.",
                now_iso,
            )

        if intent_val in ("PRESCRIPTION_REQUEST", "PERSONAL_MEDICAL_ADVICE"):
            symptoms_str = (
                ", ".join(intent_result.symptoms)
                if intent_result.symptoms
                else "the reported condition"
            )
            safety_text = (
                f"I can share general educational information about medicines commonly used for {symptoms_str}, "
                f"but I cannot prescribe a specific tablet or determine which medication is right for you personally. "
                f"Please consult a qualified healthcare professional or pharmacist for personalised advice. "
                f"If your symptoms are severe or worsening, seek medical attention promptly."
            )
            return self._build_safety_response(req, safety_text, now_iso, intent="prescription_blocked")

        if intent_val == "SYMPTOM_QUERY":
            symptoms_str = (
                ", ".join(intent_result.symptoms)
                if intent_result.symptoms
                else "your symptoms"
            )
            return self._build_conversational_response(
                req,
                f"I understand you're experiencing {symptoms_str}. "
                f"I can explain general medication information for specific drugs, "
                f"but I cannot diagnose conditions or recommend which medication to take. "
                f"Please consult a doctor or pharmacist.",
                now_iso,
            )

        if intent_val == "UNCLEAR_QUERY" or intent_result.requires_clarification:
            return self._build_clarification_response(
                req,
                intent_result.clarification_prompt
                or "Could you please specify the medication name you would like to learn about?",
                now_iso,
            )

        # 4. EXTRACT TARGET MEDICINE — never use full query as medicine name
        if intent_result.medicine_names:
            target_medicine = intent_result.medicine_names[0]
        elif req.medicine_name:
            target_medicine = req.medicine_name
        else:
            return self._build_clarification_response(
                req,
                "Could you please specify which medication you'd like to look up?",
                now_iso,
            )

        # Guard: medicine name must be ≤4 words, never a sentence
        if len(target_medicine.split()) > 4:
            logger.warning(
                f"[Research] Rejected long 'medicine name': '{target_medicine}' — likely a sentence."
            )
            return self._build_clarification_response(
                req,
                "I couldn't identify a specific medication name in your query. "
                "Please type the drug name directly (e.g., 'Paracetamol', 'Ibuprofen').",
                now_iso,
            )

        # 5. QUERY EXPANSION — generate targeted search queries
        expanded_queries = expand_retrieval_queries(
            medicine_name=target_medicine,
            intent=intent_result.intent,
            second_medicine=(
                intent_result.medicine_names[1]
                if len(intent_result.medicine_names) > 1
                else None
            ),
        )
        primary_search_query = expanded_queries[0]
        logger.info(f"[Research] Expanded queries for '{target_medicine}': {expanded_queries[:3]}")

        # 6. MEMENTO — recall session memory for context
        prior_memories = await self.memento.recall_topic_memory(
            session_id=req.session_id,
            query=req.query,
            topic=target_medicine,
        )
        memory_context = None
        recalled_topics = []
        if prior_memories:
            recalled_topics = list(
                set([m.get("topic", "") for m in prior_memories if m.get("topic")])
            )
            memory_context = f"Session previously reviewed: {', '.join(recalled_topics)}"

        # 7. STAGE A — Query resolver (keeps existing semantic understanding)
        resolved_q = await query_resolver.resolve(
            query=req.query,
            session_id=req.session_id,
            active_medicine=target_medicine,
        )
        # Use our expanded primary query but fall back to resolver's if expansion is unavailable
        search_query_to_use = primary_search_query or resolved_q.search_query

        # 8. FIRECRAWL — retrieve evidence
        raw_sources = await self.firecrawl.search_and_scrape(target_medicine, search_query_to_use)

        # 9. SOURCE VALIDATION
        validated_sources = source_validator.deduplicate_and_rank(raw_sources)

        # 10. RETRIEVAL QUALITY CHECK — retry with second expanded query before giving up
        if not validated_sources or all(len(s.content) < 100 for s in validated_sources):
            logger.warning(
                f"[Research] Insufficient evidence for '{target_medicine}' on first query. "
                f"Retrying with alternate expanded query."
            )
            if len(expanded_queries) > 1:
                retry_sources = await self.firecrawl.search_and_scrape(
                    target_medicine, expanded_queries[1]
                )
                validated_sources = source_validator.deduplicate_and_rank(
                    retry_sources + (raw_sources or [])
                )

        if not validated_sources:
            logger.warning(f"[Research] No sources retrieved for '{target_medicine}' after retry.")
            return self._build_evidence_insufficient_response(req, target_medicine, now_iso)

        # 11. LLM STRUCTURED SUMMARIZATION
        summary_resp = await self.llm.generate_medication_summary(
            medicine_name=target_medicine,
            sources=validated_sources,
            query=req.query,
            memory_context=memory_context,
            detail_level=req.detail_level or "standard",
        )

        # 12. Verify citation IDs against retrieved sources
        valid_source_ids = {s.source_id for s in validated_sources}
        summary_resp.overview.source_ids = [
            s_id for s_id in summary_resp.overview.source_ids if s_id in valid_source_ids
        ]
        for use in summary_resp.documented_uses:
            use.source_ids = [s_id for s_id in use.source_ids if s_id in valid_source_ids]
        for se in summary_resp.side_effects:
            se.source_ids = [s_id for s_id in se.source_ids if s_id in valid_source_ids]
        for warn in summary_resp.warnings_and_precautions:
            warn.source_ids = [s_id for s_id in warn.source_ids if s_id in valid_source_ids]

        # Attach memory metadata & service status
        summary_resp.memory = MemoryContextMeta(
            used_previous_context=bool(prior_memories),
            previous_topic_reference=memory_context,
            memento_mode=self.memento.get_status().get("mode", "mock"),
            recalled_topics=recalled_topics,
        )
        summary_resp.service_status = self.get_service_status()

        # 13. PERSIST TO DATABASE
        await db_service.save_research_record(
            request_id=summary_resp.request_id,
            session_id=req.session_id,
            medicine_name=target_medicine,
            query=req.query,
            summary_dict=summary_resp.model_dump(),
            intent=req.intent,
        )
        source_docs = [
            {
                "source_id": s.source_id,
                "research_request_id": summary_resp.request_id,
                "url": s.url,
                "title": s.title,
                "domain": s.domain,
                "jurisdiction": s.jurisdiction,
                "source_type": s.source_type,
                "trust_tier": s.trust_tier,
                "content_hash": s.content_hash,
                "content": s.content,
                "published_or_updated_at": s.published_or_updated_at,
            }
            for s in validated_sources
        ]
        await db_service.save_source_documents(source_docs)

        # 14. INGEST INTO MEMENTO
        await self.memento.ingest_topic_memory(
            session_id=req.session_id,
            topic=target_medicine,
            questions=[req.query],
            summary_reference=summary_resp.request_id,
            source_references=[s.source_id for s in validated_sources],
            reviewed_at=summary_resp.reviewed_at,
        )

        return summary_resp

    async def answer_follow_up(self, req: FollowUpRequest) -> FollowUpAnswerResponse:
        logger.info(f"Answering follow-up question for {req.medicine_name}: {req.query}")

        # Check safety
        is_unsafe, safety_msg = self.check_safety_and_clinical_scope(req.query)
        if is_unsafe:
            now_iso = datetime.datetime.utcnow().isoformat() + "Z"
            return FollowUpAnswerResponse(
                answer_id=f"alert-{uuid.uuid4().hex[:8]}",
                medicine_name=req.medicine_name,
                question=req.query,
                answer=f"SAFETY NOTICE: {safety_msg}",
                requires_new_search=False,
                created_at=now_iso
            )

        # Stage A: Query Resolution & Context Understanding
        resolved_q = await query_resolver.resolve(
            query=req.query,
            session_id=req.session_id,
            active_medicine=req.medicine_name,
            request_id=req.request_id
        )

        if resolved_q.clarification_needed:
            now_iso = datetime.datetime.utcnow().isoformat() + "Z"
            return FollowUpAnswerResponse(
                answer_id=f"ans-clarify-{uuid.uuid4().hex[:8]}",
                medicine_name=req.medicine_name or "Unspecified",
                question=req.query,
                answer=resolved_q.clarification_prompt or "Could you clarify which medication you are inquiring about?",
                requires_new_search=False,
                clarification_needed=True,
                clarification_prompt=resolved_q.clarification_prompt,
                created_at=now_iso
            )

        # Retrieve prior context & sources
        cached_sources = []
        if req.request_id:
            db_sources = await db_service.get_sources_for_request(req.request_id)
            for d in db_sources:
                cached_sources.append(NormalizedSource(
                    source_id=d["source_id"],
                    title=d["title"],
                    url=d["url"],
                    domain=d["domain"],
                    jurisdiction=d.get("jurisdiction"),
                    source_type=d["source_type"],
                    published_or_updated_at=d.get("published_or_updated_at"),
                    retrieved_at=d.get("retrieved_at", datetime.datetime.utcnow().isoformat()),
                    content=d.get("snippet", ""),
                    trust_tier=d.get("trust_tier", "A")
                ))

        # Always retrieve targeted evidence using the resolved search query via Firecrawl
        fresh_sources = await self.firecrawl.search_and_scrape(req.medicine_name, resolved_q.search_query)
        sources = source_validator.deduplicate_and_rank(fresh_sources + cached_sources)

        # Check Memento topic memory
        prior_memories = await self.memento.recall_topic_memory(
            session_id=req.session_id,
            query=req.query,
            topic=req.medicine_name
        )
        mem_ctx = f"Reviewed on {prior_memories[0]['reviewed_at']}" if prior_memories else None

        ans_response = await self.llm.answer_follow_up(
            medicine_name=req.medicine_name,
            question=req.query,
            sources=sources,
            resolved_query=resolved_q,
            memory_context=mem_ctx,
            detail_level=req.detail_level or "standard"
        )

        # Save question to DB
        await db_service.save_conversation_question(
            question_id=ans_response.answer_id,
            session_id=req.session_id,
            medicine_name=req.medicine_name,
            question=req.query,
            answer_json=ans_response.model_dump(),
            research_request_id=req.request_id
        )

        return ans_response

    async def compare_medications(self, req: CompareRequest) -> MedicationComparisonResponse:
        logger.info(f"Comparing medications: {req.medicine_a} vs {req.medicine_b}")
        
        # Conduct research for both medicines in parallel or sequence
        req_a = ResearchRequest(
            query=f"Overview of {req.medicine_a}",
            medicine_name=req.medicine_a,
            session_id=req.session_id,
            detail_level=req.detail_level
        )
        req_b = ResearchRequest(
            query=f"Overview of {req.medicine_b}",
            medicine_name=req.medicine_b,
            session_id=req.session_id,
            detail_level=req.detail_level
        )

        med_a_res = await self.conduct_research(req_a)
        med_b_res = await self.conduct_research(req_b)

        comparison_notes = [
            f"Both medications ({req.medicine_a.title()} and {req.medicine_b.title()}) have independent regulatory approvals and therapeutic indications.",
            "Differences in documented active ingredients, mechanism of action, and adverse effect profiles should be evaluated with a qualified healthcare provider.",
            "This educational comparison does not state or imply that one medication is superior, preferred, or appropriate for any specific patient."
        ]

        now_iso = datetime.datetime.utcnow().isoformat() + "Z"
        return MedicationComparisonResponse(
            comparison_id=f"cmp-{uuid.uuid4().hex[:8]}",
            medicine_a=med_a_res,
            medicine_b=med_b_res,
            comparison_notes=comparison_notes,
            compared_at=now_iso
        )

    async def refresh_source_changes(self, request_id: str, session_id: Optional[str] = None) -> SourceRefreshResponse:
        """
        Re-checks source URLs, computes content hashes, identifies changes,
        and generates a versioned update if needed.
        """
        logger.info(f"Refreshing source change detection for request_id: {request_id}")
        record_data = await db_service.get_research_record(request_id)
        if not record_data:
            raise ValueError(f"Research record {request_id} not found.")

        medicine_name = record_data["medicine_name"]
        parent_version = record_data.get("version", 1)
        sess_id = session_id or record_data["session_id"]

        # Fetch original stored sources
        original_sources = await db_service.get_sources_for_request(request_id)
        original_hashes = {s["url"]: s.get("content_hash") for s in original_sources}

        # Re-fetch sources
        new_sources = await self.firecrawl.search_and_scrape(medicine_name)
        new_validated = source_validator.deduplicate_and_rank(new_sources)

        changed_urls = []
        for s in new_validated:
            old_hash = original_hashes.get(s.url)
            if old_hash and s.content_hash and old_hash != s.content_hash:
                changed_urls.append(s.url)

        now_iso = datetime.datetime.utcnow().isoformat() + "Z"
        has_changes = len(changed_urls) > 0 or len(new_validated) != len(original_sources)

        new_research_record = None
        if has_changes or True:  # Generate a refreshed version record
            diff_summary = (
                f"Source check completed on {now_iso}. "
                + (f"Content changes detected across {len(changed_urls)} authoritative source(s)." if changed_urls else "Source content remains consistent with previous review.")
            )

            # Generate new versioned research record
            new_research_record = await self.llm.generate_medication_summary(
                medicine_name=medicine_name,
                sources=new_validated,
                query=record_data["query"],
                memory_context=f"Refreshed version from prior record {request_id} (Version {parent_version})",
                detail_level="standard"
            )

            # Save new record in DB with incremented version and parent link
            await db_service.save_research_record(
                request_id=new_research_record.request_id,
                session_id=sess_id,
                medicine_name=medicine_name,
                query=record_data["query"],
                summary_dict=new_research_record.model_dump(),
                intent="source_refresh",
                version=parent_version + 1,
                parent_request_id=request_id
            )

            # Save check log
            await db_service.log_source_change_check(
                check_id=f"chk-{uuid.uuid4().hex[:8]}",
                request_id=request_id,
                has_changes=has_changes,
                changed_urls=changed_urls,
                diff_summary=diff_summary
            )

        return SourceRefreshResponse(
            request_id=new_research_record.request_id if new_research_record else request_id,
            previous_request_id=request_id,
            checked_at=now_iso,
            has_changes=has_changes,
            changed_sources=changed_urls,
            change_summary=diff_summary,
            new_research_record=new_research_record
        )

    async def identify_medication_image(self, request: ImageIdentificationRequest) -> ImageIdentificationResponse:
        logger.info(f"Visual identification requested for session: {request.session_id}")
        
        # Parse base64 string
        raw_b64 = request.image_base64
        mime_type = "image/jpeg"
        if "," in raw_b64:
            header, encoded = raw_b64.split(",", 1)
            if "image/png" in header:
                mime_type = "image/png"
            elif "image/webp" in header:
                mime_type = "image/webp"
            elif "image/gif" in header:
                mime_type = "image/gif"
            image_bytes = base64.b64decode(encoded)
        else:
            image_bytes = base64.b64decode(raw_b64)

        # Call LLM multimodal identification
        llm = self.llm
        if hasattr(llm, "identify_medication_from_image"):
            analysis = await llm.identify_medication_from_image(
                image_bytes=image_bytes,
                mime_type=mime_type,
                additional_notes=request.additional_notes
            )
        else:
            analysis = {
                "identified_medicine": None,
                "analysis_summary": "Configured LLM adapter does not support image analysis."
            }

        identified_med = analysis.get("identified_medicine")
        research_result = None

        # Auto-conduct full evidence-based research if identified
        if request.auto_research and identified_med and identified_med.strip():
            try:
                research_req = ResearchRequest(
                    query=f"Explain {identified_med.strip()}",
                    medicine_name=identified_med.strip(),
                    intent="medicine_overview",
                    session_id=request.session_id,
                    detail_level="standard"
                )
                research_result = await self.conduct_research(research_req)
            except Exception as e:
                logger.error(f"Failed to auto-conduct research for identified med {identified_med}: {e}")

        return ImageIdentificationResponse(
            identified_medicine=identified_med,
            brand_name=analysis.get("brand_name"),
            active_ingredients=analysis.get("active_ingredients") or [],
            dosage_strength=analysis.get("dosage_strength"),
            confidence_level=analysis.get("confidence_level", "undetermined"),
            packaging_details=analysis.get("packaging_details"),
            detected_warnings=analysis.get("detected_warnings"),
            analysis_summary=analysis.get("analysis_summary", "Medication visual analysis complete."),
            research_result=research_result
        )

orchestrator = ResearchOrchestrator()
