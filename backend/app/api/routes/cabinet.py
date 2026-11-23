from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date

from app.core.logging import logger
from app.services.database_service import db_service

router = APIRouter(prefix="/api/cabinet", tags=["cabinet"])

def calculate_expiry_status(expiry_str: str) -> Dict[str, Any]:
    """Calculates days remaining and alert level from an expiry string (YYYY-MM-DD or MM/YYYY)."""
    try:
        clean_str = expiry_str.strip()
        target_date = None

        if len(clean_str) == 10 and clean_str.count("-") == 2:
            target_date = datetime.strptime(clean_str, "%Y-%m-%d").date()
        elif len(clean_str) == 7 and clean_str.count("-") == 1:
            # YYYY-MM
            target_date = datetime.strptime(f"{clean_str}-28", "%Y-%m-%d").date()
        elif "/" in clean_str:
            parts = clean_str.split("/")
            if len(parts) == 2:
                # MM/YYYY
                month, year = int(parts[0]), int(parts[1])
                target_date = date(year, month, 28)
            elif len(parts) == 3:
                # DD/MM/YYYY or MM/DD/YYYY
                month, day, year = int(parts[0]), int(parts[1]), int(parts[2])
                target_date = date(year, month, day)

        if not target_date:
            return {
                "parsed_date": expiry_str,
                "days_remaining": None,
                "status": "unspecified",
                "alert_message": "Date format not recognized. Please verify manually."
            }

        today = date.today()
        days_diff = (target_date - today).days

        if days_diff < 0:
            return {
                "parsed_date": target_date.isoformat(),
                "days_remaining": days_diff,
                "status": "expired",
                "alert_message": f"Expired {abs(days_diff)} days ago. Do not use."
            }
        elif days_diff <= 15:
            return {
                "parsed_date": target_date.isoformat(),
                "days_remaining": days_diff,
                "status": "expiring_critical",
                "alert_message": f"Expires in {days_diff} days! Replacement recommended."
            }
        elif days_diff <= 60:
            return {
                "parsed_date": target_date.isoformat(),
                "days_remaining": days_diff,
                "status": "expiring_soon",
                "alert_message": f"Expiring soon: {days_diff} days remaining."
            }
        else:
            return {
                "parsed_date": target_date.isoformat(),
                "days_remaining": days_diff,
                "status": "active",
                "alert_message": f"Valid for {days_diff} days."
            }
    except Exception as e:
        return {
            "parsed_date": expiry_str,
            "days_remaining": None,
            "status": "unspecified",
            "alert_message": f"Could not parse date: {str(e)}"
        }

class CabinetItemCreate(BaseModel):
    medicine_name: str = Field(..., description="Name of the medicine")
    brand_name: Optional[str] = None
    generic_name: Optional[str] = None
    dosage_strength: Optional[str] = None
    manufacturer: Optional[str] = None
    batch_number: Optional[str] = None
    mfg_date: Optional[str] = None
    expiry_date: str = Field(..., description="Expiration date (e.g. YYYY-MM-DD or MM/YYYY)")
    packaging_type: Optional[str] = "strip"
    notes: Optional[str] = None
    image_data: Optional[str] = None
    session_id: str = Field("default-session", description="Session identifier")

class CabinetItemUpdate(BaseModel):
    medicine_name: Optional[str] = None
    brand_name: Optional[str] = None
    dosage_strength: Optional[str] = None
    manufacturer: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    notes: Optional[str] = None
    session_id: str = Field("default-session")

@router.post("")
async def add_cabinet_item(item: CabinetItemCreate):
    """
    FEATURE 6: Medicine Expiry Tracker.
    Saves a medicine into the user's persistent cabinet with expiry tracking.
    """
    try:
        saved = await db_service.save_cabinet_item(item.model_dump())
        status_info = calculate_expiry_status(saved["expiry_date"])
        saved["expiry_analysis"] = status_info
        return {
            "status": "success",
            "item": saved
        }
    except Exception as e:
        logger.error(f"Error adding medicine to cabinet: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save medicine: {str(e)}")

@router.get("")
async def list_cabinet_items(session_id: str = "default-session"):
    """
    Lists all saved medicines in the cabinet, annotated with live expiry countdown and alerts.
    """
    try:
        raw_items = await db_service.get_cabinet_items(session_id)
        annotated = []
        for item in raw_items:
            analysis = calculate_expiry_status(item["expiry_date"])
            item["expiry_analysis"] = analysis
            annotated.append(item)

        # Sort so expired and expiring-soon items appear at the very top
        def sort_key(x):
            d = x["expiry_analysis"].get("days_remaining")
            return d if d is not None else 99999

        annotated.sort(key=sort_key)
        return {
            "status": "success",
            "total_items": len(annotated),
            "cabinet": annotated
        }
    except Exception as e:
        logger.error(f"Error listing cabinet items: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch cabinet: {str(e)}")

@router.put("/{item_id}")
async def update_cabinet_item(item_id: str, updates: CabinetItemUpdate):
    """Allows manual date correction or detail updates for a cabinet item."""
    try:
        clean_updates = {k: v for k, v in updates.model_dump().items() if v is not None}
        updated = await db_service.update_cabinet_item(item_id, updates.session_id, clean_updates)
        if not updated:
            raise HTTPException(status_code=404, detail="Cabinet item not found.")
        
        updated["expiry_analysis"] = calculate_expiry_status(updated["expiry_date"])
        return {"status": "success", "item": updated}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating cabinet item: {e}")
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")

@router.delete("/{item_id}")
async def delete_cabinet_item(item_id: str, session_id: str = "default-session"):
    """Removes a medicine from the cabinet."""
    try:
        deleted = await db_service.delete_cabinet_item(item_id, session_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Cabinet item not found.")
        return {"status": "success", "message": "Medicine removed from cabinet."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting cabinet item: {e}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
