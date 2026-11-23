from typing import List, Dict, Optional
from app.schemas.requests import IntentType

def expand_retrieval_queries(medicine_name: str, intent: IntentType = IntentType.MEDICINE_INFORMATION, second_medicine: Optional[str] = None) -> List[str]:
    """
    Expands a user question into targeted retrieval queries across authoritative healthcare portals
    (FDA, NHS, MedlinePlus, MHRA, EMA, DailyMed).
    """
    clean_med = medicine_name.strip().title()

    if second_medicine:
        clean_med2 = second_medicine.strip().title()
        return [
            f"{clean_med} and {clean_med2} drug interaction authoritative guidance",
            f"{clean_med} {clean_med2} co-administration precautions NHS MedlinePlus",
            f"{clean_med} {clean_med2} safety contraindications",
            f"Taking {clean_med} with {clean_med2} pharmacology"
        ]

    if intent == IntentType.DRUG_INTERACTION:
        return [
            f"{clean_med} drug interactions clinical summary",
            f"{clean_med} food alcohol interactions warnings",
            f"{clean_med} contraindications with other medicines SmPC"
        ]

    if intent == IntentType.SIDE_EFFECTS:
        return [
            f"{clean_med} reported adverse effects SmPC section 4.8",
            f"{clean_med} common serious side effects patient information leaflet",
            f"{clean_med} risks warnings contraindications NHS MedlinePlus"
        ]

    # Default: Documented uses and indications query expansion (Requirement 1)
    return [
        f"{clean_med} therapeutic indications",
        f"{clean_med} approved uses",
        f"{clean_med} patient information leaflet",
        f"{clean_med} summary of product characteristics",
        f"{clean_med} clinical indications and precautions"
    ]
