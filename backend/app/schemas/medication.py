from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from .sources import SourceSummary

class MedicineIdentity(BaseModel):
    display_name: str
    generic_name: Optional[str] = None
    brand_name: Optional[str] = None
    active_ingredients: List[str] = Field(default_factory=list)
    formulation: Optional[str] = None
    jurisdiction: Optional[str] = None

class FactualSection(BaseModel):
    text: str
    source_ids: List[str] = Field(default_factory=list)

class SideEffectSection(BaseModel):
    text: str
    classification: str = Field(default="as_stated_by_source")  # common, serious, boxed_warning, as_stated_by_source
    source_ids: List[str] = Field(default_factory=list)

class DifferingView(BaseModel):
    source_id: str
    source_title: str
    statement: str

class SourceConflict(BaseModel):
    topic: str
    description: str
    differing_views: List[DifferingView] = Field(default_factory=list)

class MemoryContextMeta(BaseModel):
    used_previous_context: bool = False
    previous_topic_reference: Optional[str] = None
    memento_mode: str = "mock"  # "live", "local_adapter", "disabled"
    recalled_topics: List[str] = Field(default_factory=list)

class ServiceStatusMeta(BaseModel):
    firecrawl: Dict[str, Any]
    memento: Dict[str, Any]
    llm: Dict[str, Any]
    database: Dict[str, Any]

class MedicationResearchResponse(BaseModel):
    request_id: str
    medicine: MedicineIdentity
    overview: FactualSection
    documented_uses: List[FactualSection] = Field(default_factory=list)
    side_effects: List[SideEffectSection] = Field(default_factory=list)
    warnings_and_precautions: List[FactualSection] = Field(default_factory=list)
    interactions: List[FactualSection] = Field(default_factory=list)
    storage_information: Optional[FactualSection] = None
    limitations: List[str] = Field(default_factory=list)
    source_conflicts: List[SourceConflict] = Field(default_factory=list)
    sources: List[SourceSummary] = Field(default_factory=list)
    memory: MemoryContextMeta = Field(default_factory=MemoryContextMeta)
    reviewed_at: str
    disclaimer: str = (
        "Educational information only; not personalized medical advice. "
        "DrugInfo AI does not diagnose, prescribe, or recommend medications or dosages. "
        "Always consult a qualified healthcare professional or emergency services for medical decisions."
    )
    service_status: Optional[ServiceStatusMeta] = None
    is_safety_warning: bool = False
    safety_guidance: Optional[str] = None

class FollowUpAnswerResponse(BaseModel):
    answer_id: str
    medicine_name: str
    question: str
    answer: str
    source_ids: List[str] = Field(default_factory=list)
    sources: List[SourceSummary] = Field(default_factory=list)
    requires_new_search: bool = False
    memory_context_used: bool = False
    resolved_query: Optional[Dict[str, Any]] = None
    clarification_needed: bool = False
    clarification_prompt: Optional[str] = None
    created_at: str
    disclaimer: str = (
        "Educational information only; not personalized medical advice. "
        "Consult a qualified healthcare provider for clinical decisions."
    )

class MedicationComparisonResponse(BaseModel):
    comparison_id: str
    medicine_a: MedicationResearchResponse
    medicine_b: MedicationResearchResponse
    comparison_notes: List[str]
    disclaimer: str = (
        "Educational comparison of publicly documented information only. "
        "Does not conclude whether one medicine is superior or suitable for any individual."
    )
    compared_at: str

class SourceRefreshResponse(BaseModel):
    request_id: str
    previous_request_id: str
    checked_at: str
    has_changes: bool
    changed_sources: List[str]
    change_summary: str
    new_research_record: Optional[MedicationResearchResponse] = None

class ImageIdentificationResponse(BaseModel):
    identified_medicine: Optional[str] = None
    brand_name: Optional[str] = None
    active_ingredients: List[str] = []
    dosage_strength: Optional[str] = None
    confidence_level: str = "undetermined"
    packaging_details: Optional[str] = None
    detected_warnings: Optional[str] = None
    analysis_summary: str
    research_result: Optional[MedicationResearchResponse] = None
