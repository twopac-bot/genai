from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from enum import Enum

class IntentType(str, Enum):
    MEDICINE_INFORMATION = "MEDICINE_INFORMATION"
    SIDE_EFFECTS = "SIDE_EFFECTS"
    DRUG_INTERACTION = "DRUG_INTERACTION"
    MEDICINE_COMPARISON = "MEDICINE_COMPARISON"
    PERSONAL_MEDICAL_ADVICE = "PERSONAL_MEDICAL_ADVICE"
    PRESCRIPTION_REQUEST = "PRESCRIPTION_REQUEST"
    SYMPTOM_QUERY = "SYMPTOM_QUERY"
    IMAGE_MEDICINE_IDENTIFICATION = "IMAGE_MEDICINE_IDENTIFICATION"
    DOCUMENT_QUESTION = "DOCUMENT_QUESTION"
    GENERAL_CONVERSATION = "GENERAL_CONVERSATION"
    UNCLEAR_QUERY = "UNCLEAR_QUERY"

class IntentClassificationResult(BaseModel):
    intent: IntentType = Field(
        default=IntentType.MEDICINE_INFORMATION,
        description="Classified user intent from the 11 supported clinical intents."
    )
    medicine_names: List[str] = Field(
        default_factory=list,
        description="Clean, extracted active ingredient or brand names. NEVER whole sentences or symptoms."
    )
    symptoms: List[str] = Field(
        default_factory=list,
        description="Reported clinical symptoms (e.g., 'fever', 'headache', 'chest pain')."
    )
    user_requests_prescription: bool = Field(
        default=False,
        description="Whether the user asks to prescribe, recommend, or choose a medication."
    )
    requires_clarification: bool = Field(
        default=False,
        description="Whether the input is ambiguous or contains an unclear drug name."
    )
    clarification_prompt: Optional[str] = Field(
        None,
        description="Polite prompt asking user to clarify medicine name or intent."
    )
    confidence: float = Field(
        default=1.0,
        description="Classification confidence score between 0.0 and 1.0."
    )
    explanation: Optional[str] = Field(
        None,
        description="Brief clinical reasoning for the intent assignment."
    )
    resolved_medicine: Optional[str] = Field(
        None,
        description="Primary resolved medicine name after pronoun resolution."
    )
    search_queries: List[str] = Field(
        default_factory=list,
        description="Expanded targeted search queries for authoritative medical sources."
    )

class ResolvedQuery(BaseModel):
    intent: str = Field(
        default="general_medication_question",
        description="Identified user clinical inquiry intent."
    )
    medicines: List[str] = Field(default_factory=list, description="Extracted or resolved medication names.")
    resolved_question: str = Field(..., description="De-anaphorized self-contained question.")
    search_required: bool = Field(default=True, description="Whether live/authoritative web retrieval is required.")
    search_query: str = Field(..., description="Optimized query string for authoritative source search.")
    clarification_needed: bool = Field(default=False, description="Whether input is ambiguous and requires user clarification.")
    clarification_prompt: Optional[str] = Field(None, description="Polite clarifying question to ask the user if needed.")
    intent_classification: Optional[IntentClassificationResult] = Field(
        None,
        description="Full structured intent classification and entity extraction."
    )

class ResearchRequest(BaseModel):
    query: str = Field(..., description="User's natural-language medication research request or name.")
    medicine_name: Optional[str] = Field(None, description="Identified or explicit medicine name.")
    intent: Literal["medicine_overview", "follow_up", "compare"] = Field("medicine_overview", description="Research intent.")
    session_id: str = Field(..., description="Opaque session identifier.")
    language: Optional[str] = Field("en", description="Target response language.")
    detail_level: Optional[Literal["simple", "standard", "detailed"]] = Field("standard", description="Level of medical explanation detail.")

class FollowUpRequest(BaseModel):
    query: str = Field(..., description="Follow-up question about a previously researched medicine.")
    medicine_name: str = Field(..., description="Subject medicine name.")
    session_id: str = Field(..., description="Opaque session identifier.")
    request_id: Optional[str] = Field(None, description="Previous research record ID if available.")
    detail_level: Optional[Literal["simple", "standard", "detailed"]] = Field("standard")

class CompareRequest(BaseModel):
    medicine_a: str = Field(..., description="First medicine name.")
    medicine_b: str = Field(..., description="Second medicine name.")
    session_id: str = Field("default-session", description="Opaque session identifier.")
    detail_level: Optional[Literal["simple", "standard", "detailed"]] = Field("standard")

class RefreshRequest(BaseModel):
    session_id: Optional[str] = Field(None, description="Session ID requesting the refresh.")

class ImageIdentificationRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image or Data URL of medication/package photo.")
    session_id: str = Field(..., description="Opaque session identifier.")
    additional_notes: Optional[str] = Field(None, description="Optional extra notes or context from the user.")
    auto_research: bool = Field(True, description="Whether to automatically conduct full research once identified.")
