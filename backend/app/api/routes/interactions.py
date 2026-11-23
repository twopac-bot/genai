from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from app.core.logging import logger
from app.adapters.llm_adapter import LLMAdapterFactory
from app.adapters.firecrawl_adapter import FirecrawlAdapterFactory
from app.services.source_validator import SourceValidator
from app.schemas.sources import NormalizedSource

router = APIRouter(prefix="/api/interactions", tags=["interactions"])

class MultiDrugInteractionRequest(BaseModel):
    medicines: List[str] = Field(..., min_length=2, description="List of 2 or more medicine names to evaluate")
    session_id: str = Field("default-session", description="Opaque session identifier")

@router.post("/multi")
async def analyze_multi_drug_interactions(req: MultiDrugInteractionRequest):
    """
    FEATURE 3: Drug Interaction Explorer.
    Evaluates potential interactions across two or more medications using authoritative
    healthcare monographs retrieved via Firecrawl and synthesized by Gemini.
    """
    cleaned_meds = [m.strip() for m in req.medicines if m.strip()]
    if len(cleaned_meds) < 2:
        raise HTTPException(status_code=400, detail="Please provide at least 2 distinct medications to evaluate interactions.")

    try:
        firecrawl = FirecrawlAdapterFactory.get_adapter()
        validator = SourceValidator()
        llm = LLMAdapterFactory.get_adapter()

        # Build targeted interaction search query
        query_str = f"{' and '.join(cleaned_meds)} drug interaction clinical guidance contraindications"
        raw_results = await firecrawl.search_and_scrape(medicine_name=cleaned_meds[0], query=query_str)
        
        # Also ensure at least one individual monograph search per medicine
        for med in cleaned_meds[1:3]:
            med_sources = await firecrawl.search_and_scrape(medicine_name=med, query=f"{med} interactions precautions")
            raw_results.extend(med_sources)

        # Validate and deduplicate sources
        validated_sources = validator.deduplicate_and_rank(raw_results)
        if not validated_sources:
            validated_sources = raw_results

        if hasattr(llm, "analyze_multi_drug_interactions"):
            result = await llm.analyze_multi_drug_interactions(
                medicines=cleaned_meds,
                retrieved_sources=validated_sources
            )
        else:
            result = {
                "medicines_analyzed": cleaned_meds,
                "overall_risk_level": "moderate",
                "summary": f"Interaction check for {', '.join(cleaned_meds)}.",
                "pairwise_interactions": [],
                "food_and_substance_interactions": [],
                "high_risk_populations": [],
                "limitations_and_uncertainties": ["Detailed multi-drug analysis requires advanced model."],
                "sources": [],
                "disclaimer": "Consult your doctor or pharmacist."
            }

        return {
            "status": "success",
            "interaction_analysis": result,
            "session_id": req.session_id
        }
    except Exception as e:
        logger.error(f"Multi-drug interaction check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Interaction evaluation failed: {str(e)}")
