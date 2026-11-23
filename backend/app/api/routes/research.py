from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any

from app.schemas.requests import ResearchRequest, RefreshRequest, ImageIdentificationRequest
from app.schemas.medication import MedicationResearchResponse, SourceRefreshResponse, ImageIdentificationResponse
from app.services.research_orchestrator import orchestrator
from app.services.database_service import db_service
from app.core.logging import logger

router = APIRouter(prefix="/api/research", tags=["Research"])

@router.post("", response_model=MedicationResearchResponse)
async def conduct_research(request: ResearchRequest):
    try:
        return await orchestrator.conduct_research(request)
    except Exception as e:
        logger.error(f"Error conducting research: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/identify-image", response_model=ImageIdentificationResponse)
async def identify_image(request: ImageIdentificationRequest):
    try:
        return await orchestrator.identify_medication_image(request)
    except Exception as e:
        logger.error(f"Error identifying medication image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{request_id}")
async def get_research_record(request_id: str):
    record = await db_service.get_research_record(request_id)
    if not record:
        raise HTTPException(status_code=404, detail="Research record not found.")
    return record

@router.post("/{request_id}/refresh", response_model=SourceRefreshResponse)
async def refresh_research(request_id: str, body: RefreshRequest = None):
    try:
        session_id = body.session_id if body else None
        return await orchestrator.refresh_source_changes(request_id, session_id=session_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Error refreshing research: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
