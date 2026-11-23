from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from app.services.database_service import db_service
from app.adapters.memento_adapter import MementoAdapterFactory
from app.core.logging import logger

router = APIRouter(prefix="/api/history", tags=["History"])

@router.get("/{session_id}")
async def get_session_history(session_id: str):
    try:
        data = await db_service.get_session_history(session_id)
        # Also include memento session topics
        memento = MementoAdapterFactory.get_adapter()
        memento_topics = await memento.get_session_topics(session_id)
        data["memento_topics"] = memento_topics
        data["memento_status"] = memento.get_status()
        return data
    except Exception as e:
        logger.error(f"Error fetching history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{session_id}")
async def clear_session_history(session_id: str):
    try:
        await db_service.clear_session_history(session_id)
        memento = MementoAdapterFactory.get_adapter()
        await memento.clear_session_memory(session_id)
        return {
            "status": "success",
            "message": f"Topic history and persistent memory for session {session_id} cleared successfully."
        }
    except Exception as e:
        logger.error(f"Error clearing history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
