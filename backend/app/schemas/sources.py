from pydantic import BaseModel, Field
from typing import Optional, Literal

class NormalizedSource(BaseModel):
    source_id: str = Field(..., description="Internal unique identifier for the source.")
    title: str = Field(..., description="Source title or publication name.")
    url: str = Field(..., description="Canonical URL of the source page.")
    domain: str = Field(..., description="Domain name of the source.")
    jurisdiction: Optional[str] = Field(None, description="Geographic/regulatory jurisdiction (e.g. US, UK, IN, WHO).")
    source_type: Literal[
        "official_label",
        "regulatory_agency",
        "public_health_service",
        "authoritative_reference",
        "medical_monograph",
        "patient_education",
        "other"
    ] = Field("authoritative_reference", description="Classified source type.")
    published_or_updated_at: Optional[str] = Field(None, description="Original publication or update date from source.")
    retrieved_at: str = Field(..., description="ISO-8601 retrieval timestamp.")
    content: str = Field(..., description="Extracted textual content or monograph excerpt.")
    trust_tier: Literal["A", "B", "C"] = Field("A", description="A=Regulator/Official, B=Major Public Health/Hospital, C=General Patient Ed.")
    content_hash: Optional[str] = Field(None, description="SHA-256 hash of extracted content for freshness detection.")

class SourceSummary(BaseModel):
    source_id: str
    title: str
    url: str
    domain: str
    jurisdiction: Optional[str] = None
    source_type: str
    published_or_updated_at: Optional[str] = None
    retrieved_at: str
    trust_tier: Optional[str] = "A"
