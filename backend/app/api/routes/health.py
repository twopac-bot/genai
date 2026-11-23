from fastapi import APIRouter
from app.services.research_orchestrator import orchestrator
from app.core.config import settings

router = APIRouter(prefix="/api/health", tags=["System Health"])

@router.get("")
async def get_health_status():
    service_status = orchestrator.get_service_status()
    return {
        "status": "healthy",
        "service": "DrugInfo AI - Medication Information Assistant",
        "app_env": settings.APP_ENV,
        "services": service_status.model_dump()
    }
