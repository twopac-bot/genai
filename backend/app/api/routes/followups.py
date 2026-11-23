from fastapi import APIRouter, HTTPException
from app.schemas.requests import FollowUpRequest
from app.schemas.medication import FollowUpAnswerResponse
from app.services.research_orchestrator import orchestrator
from app.core.logging import logger

router = APIRouter(prefix="/api/follow-up", tags=["Follow-up"])

@router.post("", response_model=FollowUpAnswerResponse)
async def ask_follow_up(request: FollowUpRequest):
    try:
        return await orchestrator.answer_follow_up(request)
    except Exception as e:
        logger.error(f"Error answering follow-up: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
