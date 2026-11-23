from fastapi import APIRouter, HTTPException, File, UploadFile, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.core.logging import logger
from app.schemas.requests import ResearchRequest, FollowUpRequest
from app.adapters.llm_adapter import LLMAdapterFactory
from app.services.database_service import db_service
from app.services.research_orchestrator import orchestrator as research_orchestrator

router = APIRouter(prefix="/api/assistant", tags=["assistant"])

class TranslationRequest(BaseModel):
    content: Dict[str, Any] = Field(..., description="Educational content JSON to translate")
    target_language: str = Field("hi", description="Target language code: 'hi' (Hindi), 'te' (Telugu), or 'en' (English)")

class BookmarkRequest(BaseModel):
    request_id: str = Field(..., description="Research record ID to bookmark")
    medicine_name: str = Field(..., description="Medicine display name")
    session_id: str = Field("default-session", description="Session identifier")

class VoiceProcessRequest(BaseModel):
    transcript: str = Field(..., description="Transcribed voice text from microphone")
    language: str = Field("en", description="Speech language: 'en', 'hi', or 'te'")
    session_id: str = Field("default-session", description="Session identifier")
    active_medicine: Optional[str] = Field(None, description="Currently active conversation topic")

@router.post("/translate")
async def translate_content(req: TranslationRequest):
    """
    FEATURE 10: Multilingual Medical Explanations.
    Translates educational content into Hindi ('hi') or Telugu ('te')
    while strictly preserving medicine names, active ingredients, dosages, warnings, and source citations.
    """
    try:
        llm = LLMAdapterFactory.get_adapter()
        if hasattr(llm, "translate_medical_content"):
            translated = await llm.translate_medical_content(
                content=req.content,
                target_language=req.target_language
            )
        else:
            translated = req.content

        return {
            "status": "success",
            "target_language": req.target_language,
            "translated_content": translated
        }
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

@router.get("/knowledge-graph/{request_id}")
async def get_knowledge_graph(request_id: str):
    """
    FEATURE 7: Medication Knowledge Graph.
    Constructs an interactive node-edge graph connecting:
    Medicine -> Active Ingredients, Indications, Side Effects, Warnings, Interactions, and Sources.
    """
    try:
        rec = await db_service.get_research_record(request_id)
        if not rec or not rec.get("summary"):
            raise HTTPException(status_code=404, detail="Research monograph not found.")

        llm = LLMAdapterFactory.get_adapter()
        if hasattr(llm, "extract_knowledge_graph"):
            graph_data = await llm.extract_knowledge_graph(rec["summary"])
        else:
            med_name = rec.get("medicine_name", "Medicine")
            graph_data = {
                "medicine_name": med_name,
                "nodes": [{"id": "med-1", "label": med_name, "type": "medicine", "verified": True}],
                "edges": []
            }

        return {
            "status": "success",
            "request_id": request_id,
            "graph": graph_data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Knowledge graph extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Knowledge graph error: {str(e)}")

@router.get("/faqs/{request_id}")
async def get_faqs(request_id: str):
    """
    FEATURE 12: Medical FAQ Generator.
    Generates 6-8 verified educational FAQs directly backed by the retrieved source paragraphs.
    """
    try:
        rec = await db_service.get_research_record(request_id)
        if not rec or not rec.get("summary"):
            raise HTTPException(status_code=404, detail="Research monograph not found.")

        llm = LLMAdapterFactory.get_adapter()
        if hasattr(llm, "generate_faqs"):
            faqs = await llm.generate_faqs(rec["summary"])
        else:
            faqs = []

        return {
            "status": "success",
            "request_id": request_id,
            "medicine_name": rec.get("medicine_name"),
            "faqs": faqs
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"FAQ generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"FAQ generation error: {str(e)}")

@router.post("/voice/transcribe")
async def transcribe_voice_audio(
    file: UploadFile = File(...),
    language: str = Form("en"),
):
    """
    Transcribes audio recorded from browser microphone using Gemini Vision/Audio.
    Fallback for browsers where Web Speech API is blocked or unavailable.
    """
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file provided.")
        
        mime_type = file.content_type or "audio/webm"
        llm = LLMAdapterFactory.get_adapter()
        if hasattr(llm, "transcribe_audio"):
            transcript = await llm.transcribe_audio(audio_bytes, mime_type=mime_type, language=language)
        else:
            transcript = ""
        
        return {
            "status": "success",
            "transcript": transcript,
            "language": language
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Audio transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@router.post("/voice/process")
async def process_voice_interaction(req: VoiceProcessRequest):
    """
    FEATURE 5: Voice Medication Assistant.
    Processes user speech transcription through intent classifier first, then research pipeline.
    Returns verified clinical answer and prepares text-to-speech audio transcript in the chosen language.
    """
    query = req.transcript.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Voice transcript was empty.")

    try:
        # 1. INTENT CLASSIFICATION FIRST — prevents full sentences becoming medicine names
        from app.services.intent_service import intent_service
        intent_result = await intent_service.classify(
            query=query,
            session_id=req.session_id,
            active_medicine=req.active_medicine,
        )
        logger.info(
            f"[VoiceRoute] Intent={intent_result.intent.value}, "
            f"medicines={intent_result.medicine_names}, "
            f"prescription_req={intent_result.user_requests_prescription}"
        )

        intent_val = intent_result.intent.value

        # 2. Handle non-research intents immediately
        if intent_val == "GENERAL_CONVERSATION":
            answer_text = (
                "Hello! I'm DrugInfo AI — I provide verified educational information about medications. "
                "You can ask me about any drug's uses, side effects, interactions, or precautions."
            )
            return {
                "status": "success",
                "transcript": query,
                "language": req.language,
                "active_medicine": req.active_medicine,
                "answer_text": answer_text,
                "spoken_audio_text": answer_text,
                "monograph": None,
            }

        if intent_val in ("PRESCRIPTION_REQUEST", "PERSONAL_MEDICAL_ADVICE"):
            symptoms_str = (
                ", ".join(intent_result.symptoms) if intent_result.symptoms else "the reported symptoms"
            )
            answer_text = (
                f"I can share general educational information about medicines commonly used for {symptoms_str}, "
                f"but I cannot prescribe a specific medication or determine which is right for you personally. "
                f"Please consult a qualified healthcare professional or pharmacist."
            )
            return {
                "status": "success",
                "transcript": query,
                "language": req.language,
                "active_medicine": req.active_medicine,
                "answer_text": answer_text,
                "spoken_audio_text": answer_text,
                "monograph": None,
            }

        if intent_val == "SYMPTOM_QUERY":
            symptoms_str = (
                ", ".join(intent_result.symptoms) if intent_result.symptoms else "your symptoms"
            )
            answer_text = (
                f"I understand you're experiencing {symptoms_str}. "
                f"I can explain general medication information for specific drugs, "
                f"but I cannot diagnose conditions or recommend which medication to take. "
                f"Please consult a doctor or pharmacist."
            )
            return {
                "status": "success",
                "transcript": query,
                "language": req.language,
                "active_medicine": req.active_medicine,
                "answer_text": answer_text,
                "spoken_audio_text": answer_text,
                "monograph": None,
            }

        if intent_val == "UNCLEAR_QUERY" or intent_result.requires_clarification:
            clarification = (
                intent_result.clarification_prompt
                or "Could you please repeat the medication name? I want to make sure I understood correctly."
            )
            return {
                "status": "clarification_needed",
                "transcript": query,
                "language": req.language,
                "active_medicine": req.active_medicine,
                "answer_text": clarification,
                "spoken_audio_text": clarification,
                "monograph": None,
            }

        # 3. For medicine-related intents, route through research pipeline
        # Use intent_result.medicine_names if available, otherwise active_medicine
        resolved_medicine = (
            intent_result.medicine_names[0]
            if intent_result.medicine_names
            else req.active_medicine
        )

        if resolved_medicine and req.active_medicine and intent_val in ("SIDE_EFFECTS", "DRUG_INTERACTION", "MEDICINE_INFORMATION", "MEDICINE_COMPARISON"):
            # Try follow-up first if medicine matches active context
            if resolved_medicine.lower() == (req.active_medicine or "").lower():
                try:
                    followup_ans = await research_orchestrator.answer_follow_up(
                        FollowUpRequest(
                            query=query,
                            medicine_name=req.active_medicine,
                            session_id=req.session_id,
                        )
                    )
                    answer_text = followup_ans.answer
                    active_med = req.active_medicine
                    research_monograph = None
                except Exception:
                    research_monograph = await research_orchestrator.conduct_research(
                        ResearchRequest(
                            query=query,
                            medicine_name=resolved_medicine,
                            session_id=req.session_id,
                        )
                    )
                    answer_text = research_monograph.overview.text
                    active_med = research_monograph.medicine.display_name
            else:
                research_monograph = await research_orchestrator.conduct_research(
                    ResearchRequest(
                        query=query,
                        medicine_name=resolved_medicine,
                        session_id=req.session_id,
                    )
                )
                answer_text = research_monograph.overview.text
                active_med = research_monograph.medicine.display_name
        else:
            research_monograph = await research_orchestrator.conduct_research(
                ResearchRequest(
                    query=query,
                    medicine_name=resolved_medicine,
                    session_id=req.session_id,
                )
            )
            answer_text = research_monograph.overview.text
            active_med = research_monograph.medicine.display_name

        # Multilingual handling if Hindi or Telugu
        spoken_text = answer_text
        if req.language in ["hi", "te"]:
            llm = LLMAdapterFactory.get_adapter()
            if hasattr(llm, "translate_medical_content"):
                translated_obj = await llm.translate_medical_content(
                    content={"text": answer_text},
                    target_language=req.language
                )
                spoken_text = translated_obj.get("text", answer_text)

        return {
            "status": "success",
            "transcript": query,
            "language": req.language,
            "active_medicine": active_med,
            "answer_text": answer_text,
            "spoken_audio_text": spoken_text,
            "monograph": research_monograph
        }
    except Exception as e:
        logger.error(f"Voice interaction processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Voice processing failed: {str(e)}")

# FEATURE 11: Bookmarks
@router.post("/bookmarks")
async def add_bookmark(req: BookmarkRequest):
    """Saves a research bookmark for quick retrieval."""
    try:
        bm = await db_service.add_bookmark(req.session_id, req.request_id, req.medicine_name)
        return {"status": "success", "bookmark": bm}
    except Exception as e:
        logger.error(f"Error saving bookmark: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to bookmark: {str(e)}")

@router.delete("/bookmarks/{bookmark_id}")
async def remove_bookmark(bookmark_id: str, session_id: str = "default-session"):
    """Deletes a research bookmark."""
    try:
        deleted = await db_service.remove_bookmark(bookmark_id, session_id)
        return {"status": "success", "deleted": deleted}
    except Exception as e:
        logger.error(f"Error deleting bookmark: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete bookmark: {str(e)}")
