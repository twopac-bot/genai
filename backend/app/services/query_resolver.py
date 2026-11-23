from typing import Optional, List, Dict, Any
from app.schemas.requests import ResolvedQuery
from app.adapters.llm_adapter import LLMAdapterFactory
from app.services.database_service import db_service
from app.adapters.memento_adapter import MementoAdapterFactory
from app.core.logging import logger

class QueryResolverService:
    def __init__(self):
        self.memento = MementoAdapterFactory.get_adapter()

    async def resolve(
        self,
        query: str,
        session_id: str,
        active_medicine: Optional[str] = None,
        request_id: Optional[str] = None
    ) -> ResolvedQuery:
        """
        Stage A: Understands user intent, identifies medication entities,
        resolves anaphoric references (it, this, both), and generates optimized search queries.
        """
        logger.info(f"Resolving query for session '{session_id}': '{query}', active med: '{active_medicine}'")
        
        # 1. Fetch recent conversation history from DB
        history_data = await db_service.get_session_history(session_id)
        recent_questions = [
            {"question": q["question"], "medicine": q["medicine_name"]}
            for q in history_data.get("questions", [])[-3:]
        ]

        # 2. Recall Memento memory context
        memories = await self.memento.recall_topic_memory(session_id=session_id, query=query, topic=active_medicine)
        memento_ctx = None
        if memories:
            topics = list(set([m.get("topic") for m in memories if m.get("topic")]))
            memento_ctx = f"Prior topics reviewed in session: {', '.join(topics)}"

        # 3. Use active LLM adapter to resolve query
        llm = LLMAdapterFactory.get_adapter()
        if hasattr(llm, "resolve_query"):
            resolved = await llm.resolve_query(
                query=query,
                conversation_history=recent_questions,
                memento_context=memento_ctx,
                active_medicine=active_medicine
            )
            return resolved

        # Fallback heuristic
        from app.adapters.gemini_adapter import GeminiAdapter
        dummy_gemini = GeminiAdapter(api_key="")
        return dummy_gemini._heuristic_resolve_query(query, active_medicine)

query_resolver = QueryResolverService()
