import pytest
import pytest_asyncio
from app.schemas.requests import FollowUpRequest, ResearchRequest
from app.services.research_orchestrator import orchestrator
from app.services.query_resolver import query_resolver
from app.services.database_service import db_service

@pytest_asyncio.fixture(autouse=True)
async def init_db():
    await db_service.init_db()
    yield

# Test 1: Initial: Explain Cetirizine. Follow-up: Can I take it with Paracetamol?
# Expected: Identify Cetirizine and Paracetamol and initiate targeted interaction retrieval.
@pytest.mark.asyncio
async def test_followup_interaction_identification():
    resolved = await query_resolver.resolve(
        query="Can I take it with Paracetamol?",
        session_id="test-session-fu1",
        active_medicine="Cetirizine"
    )
    assert "Cetirizine" in resolved.medicines
    assert "Paracetamol" in resolved.medicines
    assert resolved.intent == "drug_interaction"
    assert "Cetirizine" in resolved.resolved_question
    assert "Paracetamol" in resolved.resolved_question
    assert resolved.search_required is True

# Test 2: Initial: Explain Ibuprofen. Follow-up: What are its side effects?
# Expected: Identify Ibuprofen and retrieve relevant adverse-effect evidence.
@pytest.mark.asyncio
async def test_followup_side_effects_resolution():
    resolved = await query_resolver.resolve(
        query="What are its side effects?",
        session_id="test-session-fu2",
        active_medicine="Ibuprofen"
    )
    assert "Ibuprofen" in resolved.medicines
    assert resolved.intent == "side_effects"
    assert "Ibuprofen" in resolved.resolved_question

# Test 3: Initial: Explain Cetirizine. Follow-up: What about its precautions?
# Expected: Resolve the reference and retrieve precaution information.
@pytest.mark.asyncio
async def test_followup_precautions_resolution():
    resolved = await query_resolver.resolve(
        query="What about its precautions?",
        session_id="test-session-fu3",
        active_medicine="Cetirizine"
    )
    assert "Cetirizine" in resolved.medicines
    assert resolved.intent == "precautions"
    assert "Cetirizine" in resolved.resolved_question

# Test 4: Initial: Explain Paracetamol. Follow-up: Compare it with Ibuprofen.
# Expected: Identify both medicines and retrieve separate supporting sources.
@pytest.mark.asyncio
async def test_followup_compare_resolution():
    resolved = await query_resolver.resolve(
        query="Compare it with Ibuprofen",
        session_id="test-session-fu4",
        active_medicine="Paracetamol"
    )
    assert "Paracetamol" in resolved.medicines
    assert "Ibuprofen" in resolved.medicines
    assert resolved.intent == "medicine_comparison"

# Test 5: No previous context. Question: Can I take it with another medicine?
# Expected: Ask the user to identify the medicine.
@pytest.mark.asyncio
async def test_followup_unambiguous_clarification_prompt():
    resolved = await query_resolver.resolve(
        query="Can I take it with another medicine?",
        session_id="test-session-fu5",
        active_medicine=None
    )
    assert resolved.clarification_needed is True
    assert resolved.clarification_prompt is not None

    # Test that answer_follow_up handles clarification gracefully
    resp = await orchestrator.answer_follow_up(FollowUpRequest(
        medicine_name="",
        query="Can I take it with another medicine?",
        session_id="test-session-fu5"
    ))
    assert resp.clarification_needed is True
    assert any(term in resp.answer.lower() for term in ["clarify", "which medication", "name of the medication", "please tell me", "what medicine", "specify"])
