import re
import json
import asyncio
from typing import List, Dict, Optional, Any
from app.core.logging import logger
from app.schemas.requests import IntentType, IntentClassificationResult

GREETING_PATTERNS = [
    r"^(hello|hi|hey|howdy|greetings|good\s+(morning|afternoon|evening|day)|how\s+are\s+you|what\'?s\s+up)\b",
    r"^who\s+are\s+you\b",
    r"^what\s+can\s+you\s+do\b",
    r"^help\b"
]

PRESCRIPTION_PATTERNS = [
    r"\b(can\s+you\s+prescribe|prescribe\s+(me|a|some)|give\s+me\s+a\s+prescription)\b",
    r"\b(which\s+(tablet|medicine|pill|drug|antibiotic)\s+(should|can)\s+i\s+take)\b",
    r"\b(what\s+(tablet|medicine|pill|drug)\s+(should|can)\s+i\s+(take|have|use))\b",
    r"\b(recommend\s+(me\s+)?a\s+(medicine|tablet|pill|drug))\b",
    r"\b(write\s+(me\s+)?a\s+prescription)\b",
    r"\b(suggest\s+(me\s+)?a\s+(tablet|medicine))\b",
    r"\b(what\s+should\s+i\s+take\s+for)\b"
]

SYMPTOM_PATTERNS = [
    r"\b(i\s+have|i\'?m\s+suffering\s+from|feeling|got)\s+(a\s+)?(fever|headache|cough|cold|stomach\s+pain|nausea|vomiting|sore\s+throat|body\s+ache|dizziness|runny\s+nose|diarrhea)\b",
    r"\b(my\s+(head|stomach|throat|chest|back|leg|body)\s+(hurts|is\s+aching))\b"
]

COMMON_MEDICINES = {
    "aceclofenac": "Aceclofenac",
    "paracetamol": "Paracetamol",
    "acetaminophen": "Paracetamol",
    "ibuprofen": "Ibuprofen",
    "aspirin": "Aspirin",
    "amoxicillin": "Amoxicillin",
    "cetirizine": "Cetirizine",
    "loratadine": "Loratadine",
    "metformin": "Metformin",
    "glipizide": "Glipizide",
    "lisinopril": "Lisinopril",
    "atorvastatin": "Atorvastatin",
    "omeprazole": "Omeprazole",
    "famotidine": "Famotidine",
    "ciprofloxacin": "Ciprofloxacin",
    "azithromycin": "Azithromycin",
    "pantoprazole": "Pantoprazole",
    "losartan": "Losartan",
    "amlodipine": "Amlodipine",
    "diclofenac": "Diclofenac",
    "naproxen": "Naproxen",
    "tramadol": "Tramadol"
}

KNOWN_SYMPTOMS = [
    "fever", "headache", "cough", "cold", "pain", "stomach pain",
    "nausea", "vomiting", "sore throat", "body ache", "dizziness",
    "diarrhea", "swelling", "inflammation", "arthritis", "osteoarthritis"
]

INTENT_SYSTEM_PROMPT = """You are the Clinical Intent Classifier and Medical Entity Extractor for DrugInfo AI.

Analyze the user's input with dialogue context and classify into EXACTLY ONE of these 11 intents:
- MEDICINE_INFORMATION: User is asking about a specific medicine's uses, indications, overview, formulation, etc.
- SIDE_EFFECTS: User is inquiring about reported adverse reactions, risks, or side effects of a medicine.
- DRUG_INTERACTION: User is asking whether two or more medicines can be taken together or interact with food/alcohol.
- MEDICINE_COMPARISON: User is asking to compare two distinct medications.
- PERSONAL_MEDICAL_ADVICE: User asks for medical diagnosis, treatment choices for their personal condition, or personalized dosages.
- PRESCRIPTION_REQUEST: User asks the AI to prescribe, choose, recommend, or suggest a medicine/tablet for their symptoms.
- SYMPTOM_QUERY: User reports symptoms (e.g., 'I have a fever and cough') without asking about a specific drug.
- IMAGE_MEDICINE_IDENTIFICATION: User requests identification of a pill packaging image.
- DOCUMENT_QUESTION: Question strictly grounded in an uploaded leaflet or document.
- GENERAL_CONVERSATION: Greetings (hello, hi), small talk, thank you, or general questions about what the AI can do.
- UNCLEAR_QUERY: Garbled, unidentifiable medicine name, or ambiguous gibberish.

STRICT MEDICAL EXTRACTION RULES:
1. NEVER interpret an entire user sentence, question, or symptom phrase as a medicine name!
   Example: "I have a fever. Can you prescribe a tablet?" -> medicine_names: [], symptoms: ["fever"], intent: "PRESCRIPTION_REQUEST", user_requests_prescription: true.
2. Only extract actual pharmaceutical active ingredients or verified brand names in 'medicine_names'.
3. If the user refers to 'it', 'this medicine', or 'its side effects', resolve using the provided active medication context.
4. If a drug name appears corrupted or made-up (e.g. from bad voice audio), set requires_clarification: true and intent: "UNCLEAR_QUERY". Do NOT invent a medicine!
5. Output strict valid JSON matching the requested schema.
"""

class IntentClassifierService:
    def __init__(self):
        pass

    def _extract_symptoms_rule_based(self, text: str) -> List[str]:
        t_lower = text.lower()
        found = []
        for s in KNOWN_SYMPTOMS:
            if re.search(r"\b" + re.escape(s) + r"\b", t_lower):
                found.append(s)
        return found

    def _extract_medicines_rule_based(self, text: str, active_med: Optional[str] = None) -> List[str]:
        t_lower = text.lower()
        found = []
        for m_key, m_name in COMMON_MEDICINES.items():
            if re.search(r"\b" + re.escape(m_key) + r"\b", t_lower):
                if m_name not in found:
                    found.append(m_name)
        
        # Check anaphoric references
        if not found and active_med and any(pron in t_lower for pron in [" it ", " it?", " its ", " this ", " that ", "this medicine", "this tablet"]):
            found.append(active_med)
            
        return found

    def _rule_based_classify(self, query: str, active_medicine: Optional[str] = None) -> IntentClassificationResult:
        q_clean = query.strip()
        q_lower = q_clean.lower()

        # 1. Greetings & General conversation
        for pat in GREETING_PATTERNS:
            if re.search(pat, q_lower):
                logger.info(f"Rule-based intent: GENERAL_CONVERSATION for '{query}'")
                return IntentClassificationResult(
                    intent=IntentType.GENERAL_CONVERSATION,
                    medicine_names=[],
                    symptoms=[],
                    user_requests_prescription=False,
                    requires_clarification=False,
                    confidence=0.99,
                    explanation="General greeting or introductory query."
                )

        # 2. Prescription Requests
        for pat in PRESCRIPTION_PATTERNS:
            if re.search(pat, q_lower):
                symptoms = self._extract_symptoms_rule_based(query)
                logger.info(f"Rule-based intent: PRESCRIPTION_REQUEST for '{query}' with symptoms: {symptoms}")
                return IntentClassificationResult(
                    intent=IntentType.PRESCRIPTION_REQUEST,
                    medicine_names=[],
                    symptoms=symptoms,
                    user_requests_prescription=True,
                    requires_clarification=False,
                    confidence=0.98,
                    explanation="User is asking the AI to prescribe or recommend a medication for symptoms."
                )

        # 3. Symptoms without medicines
        medicines = self._extract_medicines_rule_based(query, active_medicine)
        symptoms = self._extract_symptoms_rule_based(query)
        if symptoms and not medicines and any(p in q_lower for p in ["i have", "i feel", "suffering", "hurts", "ache", "symptom"]):
            logger.info(f"Rule-based intent: SYMPTOM_QUERY for '{query}'")
            return IntentClassificationResult(
                intent=IntentType.SYMPTOM_QUERY,
                medicine_names=[],
                symptoms=symptoms,
                user_requests_prescription=False,
                requires_clarification=False,
                confidence=0.95,
                explanation="User reports symptoms without identifying a target medication."
            )

        # 4. Drug Interactions (2+ medicines or interaction keywords)
        if len(medicines) >= 2 or any(k in q_lower for k in ["taken together", "take together", "interact", "interaction", "with food", "with alcohol"]):
            if medicines:
                logger.info(f"Rule-based intent: DRUG_INTERACTION for medicines: {medicines}")
                return IntentClassificationResult(
                    intent=IntentType.DRUG_INTERACTION,
                    medicine_names=medicines,
                    symptoms=symptoms,
                    user_requests_prescription=False,
                    requires_clarification=False,
                    confidence=0.96,
                    resolved_medicine=medicines[0],
                    explanation="User inquiry regarding drug-drug or drug-substance interactions."
                )

        # 5. Side Effects
        if any(k in q_lower for k in ["side effect", "adverse reaction", "adverse effect", "harmful effect", "risks of"]):
            target_med = medicines[0] if medicines else active_medicine
            if target_med:
                logger.info(f"Rule-based intent: SIDE_EFFECTS for '{target_med}'")
                return IntentClassificationResult(
                    intent=IntentType.SIDE_EFFECTS,
                    medicine_names=[target_med],
                    symptoms=symptoms,
                    user_requests_prescription=False,
                    requires_clarification=False,
                    confidence=0.97,
                    resolved_medicine=target_med,
                    explanation="User inquiry regarding medication side effects and adverse reactions."
                )

        # 6. Medicine Information (Uses, indications, precautions)
        if medicines:
            target_med = medicines[0]
            logger.info(f"Rule-based intent: MEDICINE_INFORMATION for '{target_med}'")
            return IntentClassificationResult(
                intent=IntentType.MEDICINE_INFORMATION,
                medicine_names=[target_med],
                symptoms=symptoms,
                user_requests_prescription=False,
                requires_clarification=False,
                confidence=0.95,
                resolved_medicine=target_med,
                explanation="User inquiry regarding documented medication indications and clinical monograph."
            )

        # 7. Unclear or ambiguous query
        logger.warning(f"Unclear query received: '{query}'. Flagging for clarification.")
        return IntentClassificationResult(
            intent=IntentType.UNCLEAR_QUERY,
            medicine_names=[],
            symptoms=symptoms,
            user_requests_prescription=False,
            requires_clarification=True,
            clarification_prompt="Could you please specify the medication name or question you would like to explore?",
            confidence=0.7,
            explanation="Could not identify target medication or recognized clinical intent."
        )

    async def classify(
        self,
        query: str,
        session_id: str = "default-session",
        active_medicine: Optional[str] = None,
        dialogue_history: Optional[List[Dict[str, str]]] = None
    ) -> IntentClassificationResult:
        """
        Main entry point for intent classification and entity extraction.
        Attempts Gemini structured extraction with guaranteed fallback to deterministic rule engine.
        """
        logger.info(f"[IntentClassifier] Classifying input: '{query}', active_medicine: '{active_medicine}'")
        
        # Check rule engine first for obvious fast-paths (greetings & prescription keywords)
        q_lower = query.strip().lower()
        for pat in GREETING_PATTERNS:
            if re.search(pat, q_lower):
                return self._rule_based_classify(query, active_medicine)

        for pat in PRESCRIPTION_PATTERNS:
            if re.search(pat, q_lower):
                return self._rule_based_classify(query, active_medicine)

        # Try Gemini Structured Classification
        try:
            from app.adapters.llm_adapter import LLMAdapterFactory
            llm = LLMAdapterFactory.get_adapter()
            if hasattr(llm, "client") and llm.client:
                from google.genai import types
                
                prompt = (
                    f"User Query: \"{query}\"\n"
                    f"Active Conversation Topic: {active_medicine or 'None'}\n"
                    f"Recent Dialogue Context: {json.dumps(dialogue_history or [])}\n\n"
                    f"Classify intent and extract entities into JSON matching this schema:\n"
                    f"{{\n"
                    f"  \"intent\": \"MEDICINE_INFORMATION|SIDE_EFFECTS|DRUG_INTERACTION|MEDICINE_COMPARISON|PERSONAL_MEDICAL_ADVICE|PRESCRIPTION_REQUEST|SYMPTOM_QUERY|IMAGE_MEDICINE_IDENTIFICATION|DOCUMENT_QUESTION|GENERAL_CONVERSATION|UNCLEAR_QUERY\",\n"
                    f"  \"medicine_names\": [\"CleanMedicineName\"],\n"
                    f"  \"symptoms\": [\"symptom\"],\n"
                    f"  \"user_requests_prescription\": false,\n"
                    f"  \"requires_clarification\": false,\n"
                    f"  \"clarification_prompt\": null,\n"
                    f"  \"confidence\": 0.95,\n"
                    f"  \"explanation\": \"brief reasoning\"\n"
                    f"}}"
                )

                config = types.GenerateContentConfig(
                    system_instruction=INTENT_SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.0
                )
                
                response = await asyncio.to_thread(
                    llm.client.models.generate_content,
                    model=getattr(llm, "model_name", "gemini-3.1-flash-lite"),
                    contents=prompt,
                    config=config
                )
                
                data = json.loads(response.text)
                
                # Sanitize extracted medicine names: NEVER allow full sentences
                raw_meds = data.get("medicine_names", [])
                clean_meds = []
                for m in raw_meds:
                    if isinstance(m, str) and len(m.split()) <= 4 and not any(w in m.lower() for w in ["i have", "can you", "prescribe", "tablet?", "fever"]):
                        clean_meds.append(m.title())

                intent_val = data.get("intent", "MEDICINE_INFORMATION")
                try:
                    typed_intent = IntentType(intent_val)
                except ValueError:
                    typed_intent = IntentType.MEDICINE_INFORMATION

                # Safety override: if sentence is a prescription request, enforce PRESCRIPTION_REQUEST
                if data.get("user_requests_prescription") or any(re.search(p, q_lower) for p in PRESCRIPTION_PATTERNS):
                    typed_intent = IntentType.PRESCRIPTION_REQUEST
                    clean_meds = []

                res = IntentClassificationResult(
                    intent=typed_intent,
                    medicine_names=clean_meds,
                    symptoms=data.get("symptoms", []),
                    user_requests_prescription=data.get("user_requests_prescription", False),
                    requires_clarification=data.get("requires_clarification", False),
                    clarification_prompt=data.get("clarification_prompt"),
                    confidence=float(data.get("confidence", 0.9)),
                    explanation=data.get("explanation"),
                    resolved_medicine=clean_meds[0] if clean_meds else active_medicine
                )
                logger.info(f"[IntentClassifier] LLM Classified: {res.intent}, medicines: {res.medicine_names}, symptoms: {res.symptoms}")
                return res
        except Exception as e:
            logger.warning(f"[IntentClassifier] LLM classification error: {e}. Falling back to rule-based classification.")

        return self._rule_based_classify(query, active_medicine)

intent_service = IntentClassifierService()
