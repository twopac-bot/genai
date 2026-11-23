from fastapi import APIRouter, HTTPException
from app.schemas.requests import CompareRequest
from app.schemas.medication import MedicationComparisonResponse
from app.services.research_orchestrator import orchestrator
from app.core.logging import logger

router = APIRouter(prefix="/api/compare", tags=["Compare"])

@router.post("", response_model=MedicationComparisonResponse)
async def compare_medicines(request: CompareRequest):
    try:
        return await orchestrator.compare_medications(request)
    except Exception as e:
        logger.error(f"Error comparing medications: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
