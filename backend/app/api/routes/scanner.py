import base64
import re
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.core.logging import logger
from app.schemas.requests import ResearchRequest
from app.adapters.llm_adapter import LLMAdapterFactory
from app.services.research_orchestrator import orchestrator as research_orchestrator
from app.services.database_service import db_service

router = APIRouter(prefix="/api/scanner", tags=["scanner"])

def parse_base64_image(image_str: str):
    """Parses base64 data URL into raw bytes and mime type."""
    if not image_str:
        raise ValueError("Image data is empty.")
    
    mime_type = "image/jpeg"
    if image_str.startswith("data:"):
        match = re.match(r"data:([^;]+);base64,(.+)", image_str)
        if match:
            mime_type = match.group(1)
            raw_base64 = match.group(2)
        else:
            parts = image_str.split(",")
            raw_base64 = parts[1] if len(parts) > 1 else parts[0]
    else:
        raw_base64 = image_str

    image_bytes = base64.b64decode(raw_base64)
    return image_bytes, mime_type

class PackagingScanRequest(BaseModel):
    image_data: str = Field(..., description="Base64 encoded packaging image or data URL")
    notes: Optional[str] = Field(None, description="Optional user notes or observed context")
    session_id: str = Field("default-session", description="Opaque session identifier")

class ConfirmPackagingRequest(BaseModel):
    medicine_name: str = Field(..., description="Confirmed or manually corrected medicine name")
    brand_name: Optional[str] = None
    generic_name: Optional[str] = None
    dosage_strength: Optional[str] = None
    manufacturer: Optional[str] = None
    batch_number: Optional[str] = None
    mfg_date: Optional[str] = None
    expiry_date: Optional[str] = None
    packaging_type: Optional[str] = "strip"
    notes: Optional[str] = None
    image_data: Optional[str] = None
    save_to_cabinet: bool = Field(False, description="Whether to also save in the Medicine Cabinet Expiry Tracker")
    session_id: str = Field("default-session", description="Session identifier")

class PrescriptionScanRequest(BaseModel):
    image_data: str = Field(..., description="Base64 encoded prescription image or data URL")
    notes: Optional[str] = Field(None, description="Optional physician/clinic notes")
    session_id: str = Field("default-session", description="Session identifier")

@router.post("/packaging")
async def scan_packaging(req: PackagingScanRequest):
    """
    FEATURE 1: Medicine Packaging Scanner.
    Extracts medicine name, active ingredients, batch, mfg date, expiry, manufacturer,
    and flags uncertain OCR fields for user verification.
    """
    try:
        image_bytes, mime_type = parse_base64_image(req.image_data)
        llm = LLMAdapterFactory.get_adapter()
        
        if hasattr(llm, "scan_packaging_detailed"):
            extraction = await llm.scan_packaging_detailed(
                image_bytes=image_bytes,
                mime_type=mime_type,
                additional_notes=req.notes
            )
        else:
            extraction = await llm.identify_medication_from_image(
                image_bytes=image_bytes,
                mime_type=mime_type,
                additional_notes=req.notes
            )
            extraction["batch_number"] = None
            extraction["mfg_date"] = None
            extraction["expiry_date"] = None
            extraction["uncertain_fields"] = []
            extraction["confidence_score"] = 0.8
            extraction["requires_user_confirmation"] = True

        return {
            "status": "success",
            "extraction": extraction,
            "session_id": req.session_id,
        }
    except Exception as e:
        logger.error(f"Error scanning packaging: {e}")
        raise HTTPException(status_code=500, detail=f"Packaging scan failed: {str(e)}")

@router.post("/confirm")
async def confirm_packaging_and_research(req: ConfirmPackagingRequest):
    """
    Confirms user-verified packaging details, searches official healthcare sources via Firecrawl,
    returns the complete educational monograph, and optionally saves to the Medicine Cabinet Expiry Tracker.
    """
    try:
        # 1. Optionally save to Expiry Tracker cabinet
        cabinet_item = None
        if req.save_to_cabinet and req.expiry_date:
            cabinet_item = await db_service.save_cabinet_item({
                "session_id": req.session_id,
                "medicine_name": req.medicine_name,
                "brand_name": req.brand_name,
                "generic_name": req.generic_name,
                "dosage_strength": req.dosage_strength,
                "manufacturer": req.manufacturer,
                "batch_number": req.batch_number,
                "mfg_date": req.mfg_date,
                "expiry_date": req.expiry_date,
                "packaging_type": req.packaging_type or "strip",
                "notes": req.notes,
                "image_data": req.image_data[:2000] if req.image_data else None,
            })

        # 2. Conduct official healthcare monograph research
        search_query = req.generic_name or req.medicine_name
        research_req = ResearchRequest(
            query=f"{search_query} indications side effects precautions",
            medicine_name=req.medicine_name,
            session_id=req.session_id,
            detail_level="standard"
        )
        monograph = await research_orchestrator.conduct_research(research_req)

        return {
            "status": "success",
            "monograph": monograph,
            "cabinet_saved": cabinet_item is not None,
            "cabinet_item": cabinet_item
        }
    except Exception as e:
        logger.error(f"Error confirming packaging: {e}")
        raise HTTPException(status_code=500, detail=f"Confirmation and research failed: {str(e)}")

@router.post("/prescription")
async def scan_prescription(req: PrescriptionScanRequest):
    """
    FEATURE 2: Prescription Image Explainer.
    Decodes handwriting, extracts readable text, identifies medications,
    explains medical abbreviations, and flags ambiguous entries.
    """
    try:
        image_bytes, mime_type = parse_base64_image(req.image_data)
        llm = LLMAdapterFactory.get_adapter()

        if hasattr(llm, "explain_prescription"):
            result = await llm.explain_prescription(
                image_bytes=image_bytes,
                mime_type=mime_type,
                additional_notes=req.notes
            )
        else:
            result = {
                "raw_transcription": "OCR extraction unavailable in basic mode.",
                "identified_medications": [],
                "medical_abbreviations": [],
                "unclear_handwriting_flags": [{"section": "Image", "text_fragment": "", "reason": "Requires vision model", "recommendation": "Consult pharmacist"}],
                "structured_sections": [],
                "clinical_safety_notice": "Prescription explanation unavailable."
            }

        return {
            "status": "success",
            "prescription_analysis": result,
            "session_id": req.session_id
        }
    except Exception as e:
        logger.error(f"Error explaining prescription: {e}")
        raise HTTPException(status_code=500, detail=f"Prescription explanation failed: {str(e)}")
