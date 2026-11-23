"""
DrugInfo AI – Pipeline Regression Tests
Covers: intent classification, entity extraction, medicine retrieval, hallucination prevention.
Run:  $env:PYTHONPATH="backend"; python -m pytest backend/tests/test_pipeline_regression.py -v
"""
import pytest
import asyncio
import sys
import os

# Ensure backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def event_loop_policy():
    """Use default event loop policy."""
    return asyncio.DefaultEventLoopPolicy()


# ---------------------------------------------------------------------------
# Intent Classifier Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_greeting_classified_as_general_conversation():
    """Greeting must be GENERAL_CONVERSATION with no medicine extracted."""
    from app.services.intent_service import intent_service, IntentType
    result = await intent_service.classify("Hello, how are you?")
    assert result.intent == IntentType.GENERAL_CONVERSATION
    assert result.medicine_names == [], f"Expected no medicines, got {result.medicine_names}"


@pytest.mark.asyncio
async def test_prescription_request_blocked_no_monograph():
    """'I have a fever. Can you prescribe a tablet?' must NOT extract full sentence as medicine."""
    from app.services.intent_service import intent_service, IntentType
    result = await intent_service.classify("I have a fever. Can you prescribe a tablet?")
    assert result.intent == IntentType.PRESCRIPTION_REQUEST, (
        f"Expected PRESCRIPTION_REQUEST, got {result.intent.value}"
    )
    # Critical: medicine_names must be EMPTY — no sentence-as-drug
    assert result.medicine_names == [], (
        f"FAIL: Full sentence interpreted as medicine: {result.medicine_names}"
    )
    assert result.user_requests_prescription is True


@pytest.mark.asyncio
async def test_paracetamol_uses_classified_correctly():
    """'What is paracetamol used for?' must be MEDICINE_INFORMATION with Paracetamol extracted."""
    from app.services.intent_service import intent_service, IntentType
    result = await intent_service.classify("What is paracetamol used for?")
    assert result.intent in (IntentType.MEDICINE_INFORMATION,), (
        f"Expected MEDICINE_INFORMATION, got {result.intent.value}"
    )
    meds_lower = [m.lower() for m in result.medicine_names]
    assert "paracetamol" in meds_lower, f"Paracetamol not extracted. Got: {result.medicine_names}"


@pytest.mark.asyncio
async def test_aceclofenac_paracetamol_interaction():
    """'Can I take aceclofenac with paracetamol?' must be DRUG_INTERACTION with both drugs."""
    from app.services.intent_service import intent_service, IntentType
    result = await intent_service.classify("Can I take aceclofenac with paracetamol?")
    assert result.intent == IntentType.DRUG_INTERACTION, (
        f"Expected DRUG_INTERACTION, got {result.intent.value}"
    )
    meds_lower = [m.lower() for m in result.medicine_names]
    assert "aceclofenac" in meds_lower, f"Aceclofenac not extracted. Got: {result.medicine_names}"
    assert "paracetamol" in meds_lower, f"Paracetamol not extracted. Got: {result.medicine_names}"


@pytest.mark.asyncio
async def test_pronoun_resolution_uses_active_medicine():
    """'What are its side effects?' with active_medicine=Paracetamol must resolve to Paracetamol."""
    from app.services.intent_service import intent_service, IntentType
    result = await intent_service.classify(
        "What are its side effects?", active_medicine="Paracetamol"
    )
    assert result.intent in (IntentType.SIDE_EFFECTS, IntentType.MEDICINE_INFORMATION), (
        f"Expected SIDE_EFFECTS or MEDICINE_INFORMATION, got {result.intent.value}"
    )
    assert result.resolved_medicine == "Paracetamol", (
        f"Expected resolved_medicine='Paracetamol', got {result.resolved_medicine!r}"
    )


@pytest.mark.asyncio
async def test_cetirizine_uses():
    """'What is cetirizine used for?' must correctly classify and extract Cetirizine."""
    from app.services.intent_service import intent_service, IntentType
    result = await intent_service.classify("What is cetirizine used for?")
    assert result.intent == IntentType.MEDICINE_INFORMATION
    meds_lower = [m.lower() for m in result.medicine_names]
    assert "cetirizine" in meds_lower, f"Cetirizine not extracted. Got: {result.medicine_names}"


@pytest.mark.asyncio
async def test_omeprazole_side_effects():
    """'What are the side effects of omeprazole?' must be SIDE_EFFECTS."""
    from app.services.intent_service import intent_service, IntentType
    result = await intent_service.classify("What are the side effects of omeprazole?")
    assert result.intent in (IntentType.SIDE_EFFECTS, IntentType.MEDICINE_INFORMATION), (
        f"Expected SIDE_EFFECTS or MEDICINE_INFORMATION, got {result.intent.value}"
    )
    meds_lower = [m.lower() for m in result.medicine_names]
    assert "omeprazole" in meds_lower, f"Omeprazole not extracted. Got: {result.medicine_names}"


# ---------------------------------------------------------------------------
# Firecrawl / Mock Retrieval Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_aceclofenac_retrieves_real_indications():
    """
    REGRESSION: aceclofenac must return authoritative source content (not hallucinated text),
    so Gemini can answer 'What is aceclofenac used for?' with real clinical indications.
    """
    from app.adapters.firecrawl_adapter import MockFirecrawlAdapter
    adapter = MockFirecrawlAdapter()
    sources = await adapter.search_and_scrape(
        "aceclofenac", "aceclofenac therapeutic indications"
    )
    assert len(sources) >= 1, "No sources returned for aceclofenac"
    combined = " ".join([s.content for s in sources]).lower()
    # Must contain at least one real clinical indication from the SmPC
    assert any(
        kw in combined
        for kw in ["osteoarthritis", "rheumatoid", "anti-inflammatory", "ankylosing", "musculoskeletal"]
    ), f"Real indications not found. Source content snippet: {combined[:500]}"


@pytest.mark.asyncio
async def test_no_hallucinated_content_for_unknown_drug():
    """
    Unknown medicine must return empty source list — NOT a hallucinated paragraph.
    This prevents Gemini from generating fake indications.
    """
    from app.adapters.firecrawl_adapter import MockFirecrawlAdapter
    adapter = MockFirecrawlAdapter()
    sources = await adapter.search_and_scrape("xyz_nonexistent_drug_12345")
    assert sources == [], (
        f"Expected empty sources for unknown drug, got {len(sources)} sources. "
        f"First content: {sources[0].content[:200] if sources else 'N/A'}"
    )


@pytest.mark.asyncio
async def test_paracetamol_retrieves_indications():
    """Paracetamol therapeutic indications query must return source content."""
    from app.adapters.firecrawl_adapter import MockFirecrawlAdapter
    adapter = MockFirecrawlAdapter()
    sources = await adapter.search_and_scrape(
        "paracetamol", "paracetamol therapeutic indications"
    )
    assert len(sources) >= 1, "No sources returned for paracetamol"
    combined = " ".join([s.content for s in sources]).lower()
    assert any(kw in combined for kw in ["pain", "fever", "analgesic", "antipyretic", "headache"]), (
        f"Paracetamol indications not found. Snippet: {combined[:400]}"
    )


# ---------------------------------------------------------------------------
# Query Expansion Tests
# ---------------------------------------------------------------------------

def test_query_expansion_uses_intent():
    """Query expansion for MEDICINE_INFORMATION must include 'therapeutic indications'."""
    from app.services.query_expansion import expand_retrieval_queries
    from app.schemas.requests import IntentType
    queries = expand_retrieval_queries("Aceclofenac", IntentType.MEDICINE_INFORMATION)
    assert len(queries) >= 3, f"Expected ≥3 queries, got {len(queries)}"
    combined = " ".join(queries).lower()
    assert "therapeutic" in combined or "indications" in combined or "approved uses" in combined, (
        f"Indication-focused queries not found: {queries}"
    )


def test_query_expansion_drug_interaction():
    """Drug interaction expansion must name both drugs."""
    from app.services.query_expansion import expand_retrieval_queries
    from app.schemas.requests import IntentType
    queries = expand_retrieval_queries(
        "Aceclofenac", IntentType.DRUG_INTERACTION, second_medicine="Paracetamol"
    )
    combined = " ".join(queries).lower()
    assert "aceclofenac" in combined
    assert "paracetamol" in combined


def test_query_expansion_side_effects():
    """Side effects expansion must reference SmPC or adverse effects."""
    from app.services.query_expansion import expand_retrieval_queries
    from app.schemas.requests import IntentType
    queries = expand_retrieval_queries("Omeprazole", IntentType.SIDE_EFFECTS)
    combined = " ".join(queries).lower()
    assert any(kw in combined for kw in ["adverse", "side effect", "smpc", "4.8"]), (
        f"Side-effects focused queries not found: {queries}"
    )
