import pytest
import pytest_asyncio
import asyncio
import os
import uuid
from typing import List

from app.schemas.requests import ResearchRequest, FollowUpRequest, CompareRequest
from app.schemas.sources import NormalizedSource
from app.schemas.medication import MedicationResearchResponse
from app.services.source_validator import SourceValidator, source_validator
from app.adapters.firecrawl_adapter import MockFirecrawlAdapter, LiveFirecrawlAdapter
from app.adapters.memento_adapter import LocalMementoAdapter, LiveMementoAdapter
from app.adapters.llm_adapter import RuleBasedEvidenceSummarizer
from app.services.research_orchestrator import ResearchOrchestrator
from app.services.database_service import DatabaseService, db_service

@pytest_asyncio.fixture(autouse=True)
async def initialize_db():
    await db_service.init_db()
    yield

@pytest.fixture
def mock_firecrawl():
    return MockFirecrawlAdapter()

@pytest.fixture
def local_memento(tmp_path):
    db_file = str(tmp_path / "test_memento.db")
    return LocalMementoAdapter(db_file=db_file)

@pytest.fixture
def llm_summarizer():
    return RuleBasedEvidenceSummarizer()

@pytest.fixture
def test_db_service(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path}/test_druginfo.db"
    return DatabaseService(db_url=db_url)

@pytest.fixture
def orchestrator_instance(mock_firecrawl, local_memento, llm_summarizer):
    return ResearchOrchestrator(
        firecrawl_adapter=mock_firecrawl,
        memento_adapter=local_memento,
        llm_adapter=llm_summarizer
    )

# 1. Test source allowlist & domain metadata
def test_source_allowlist_and_tiers():
    validator = SourceValidator()
    assert validator.is_allowed_domain("fda.gov") is True
    assert validator.is_allowed_domain("accessdata.fda.gov") is True
    assert validator.is_allowed_domain("medlineplus.gov") is True
    assert validator.is_allowed_domain("nhs.uk") is True
    assert validator.is_allowed_domain("who.int") is True
    assert validator.is_allowed_domain("randomblog.com") is False

    fda_meta = validator.get_domain_metadata("fda.gov")
    assert fda_meta["tier"] == "A"
    assert fda_meta["jurisdiction"] == "US"

    nhs_meta = validator.get_domain_metadata("nhs.uk")
    assert nhs_meta["tier"] == "A"
    assert nhs_meta["jurisdiction"] == "UK"

# 2. Test duplicate source removal and ranking
def test_deduplicate_and_rank():
    validator = SourceValidator()
    s1 = NormalizedSource(
        source_id="s1",
        title="FDA Drug Label",
        url="https://accessdata.fda.gov/label1",
        domain="accessdata.fda.gov",
        jurisdiction="US",
        source_type="official_label",
        published_or_updated_at="2023-01-01",
        retrieved_at="2026-01-01T00:00:00Z",
        content="Metformin hydrochloride 500mg tablets.",
        trust_tier="A"
    )
    s2 = NormalizedSource(
        source_id="s2",
        title="FDA Duplicate Label",
        url="https://accessdata.fda.gov/label1/",  # duplicate normalized url
        domain="accessdata.fda.gov",
        jurisdiction="US",
        source_type="official_label",
        published_or_updated_at="2023-01-01",
        retrieved_at="2026-01-01T00:00:00Z",
        content="Metformin hydrochloride 500mg tablets.",  # duplicate content
        trust_tier="A"
    )
    s3 = NormalizedSource(
        source_id="s3",
        title="WebMD Metformin Article",
        url="https://webmd.com/drugs/metformin",
        domain="webmd.com",
        jurisdiction="US",
        source_type="patient_education",
        published_or_updated_at=None,
        retrieved_at="2026-01-01T00:00:00Z",
        content="WebMD general patient guide for metformin.",
        trust_tier="B"
    )

    ranked = validator.deduplicate_and_rank([s3, s1, s2])
    # Should deduplicate s2 and rank Tier A (s1) above Tier B (s3)
    assert len(ranked) == 2
    assert ranked[0].source_id == "s1"
    assert ranked[1].source_id == "s3"

# 3. Test conflict detection between sources
def test_conflicting_source_statements():
    validator = SourceValidator()
    s_pro = NormalizedSource(
        source_id="s_grapefruit_pro",
        title="Label Warning",
        url="https://fda.gov/grapefruit",
        domain="fda.gov",
        source_type="official_label",
        retrieved_at="2026-01-01T00:00:00Z",
        content="Avoid grapefruit as grapefruit interaction may increase plasma concentrations.",
        trust_tier="A"
    )
    s_con = NormalizedSource(
        source_id="s_grapefruit_con",
        title="General Guide",
        url="https://example.com/guide",
        domain="example.com",
        source_type="patient_education",
        retrieved_at="2026-01-01T00:00:00Z",
        content="Grapefruit does not affect this formulation and can be taken normally.",
        trust_tier="B"
    )
    conflicts = validator.detect_conflicts([s_pro, s_con])
    assert len(conflicts) > 0
    assert "Grapefruit" in conflicts[0].topic
    assert len(conflicts[0].differing_views) == 2

# 4. Test Mock Firecrawl Adapter retrieval
@pytest.mark.asyncio
async def test_mock_firecrawl_retrieval(mock_firecrawl):
    # Known medication
    sources = await mock_firecrawl.search_and_scrape("Metformin")
    assert len(sources) >= 2
    assert any("fda" in s.domain or "medlineplus" in s.domain for s in sources)
    assert all(s.trust_tier in ["A", "B", "C"] for s in sources)

    # Empty / bogus query
    empty_sources = await mock_firecrawl.search_and_scrape("unknown_xyz123_invalid")
    assert len(empty_sources) == 0

# 5. Test Memento session isolation and memory persistence
@pytest.mark.asyncio
async def test_memento_session_isolation(local_memento):
    session_a = "user-alice-session"
    session_b = "user-bob-session"

    # Ingest topic for Alice
    await local_memento.ingest_topic_memory(
        session_id=session_a,
        topic="Metformin",
        questions=["What are the side effects of Metformin?"],
        summary_reference="req-1234",
        source_references=["src-1", "src-2"],
        reviewed_at="2026-05-01T10:00:00Z"
    )

    # Ingest different topic for Bob
    await local_memento.ingest_topic_memory(
        session_id=session_b,
        topic="Amoxicillin",
        questions=["Can I take Amoxicillin with food?"],
        summary_reference="req-5678",
        source_references=["src-3"],
        reviewed_at="2026-05-01T11:00:00Z"
    )

    # Alice recalls Metformin
    alice_memories = await local_memento.recall_topic_memory(session_id=session_a, query="Metformin", topic="Metformin")
    assert len(alice_memories) == 1
    assert alice_memories[0]["topic"] == "metformin"
    assert alice_memories[0]["user_or_session_key"] == session_a

    # Bob must NOT see Alice's Metformin memory
    bob_alice_probe = await local_memento.recall_topic_memory(session_id=session_b, query="Metformin", topic="Metformin")
    assert len(bob_alice_probe) == 0

    # Bob recalls Amoxicillin
    bob_memories = await local_memento.recall_topic_memory(session_id=session_b, query="Amoxicillin", topic="Amoxicillin")
    assert len(bob_memories) == 1
    assert bob_memories[0]["topic"] == "amoxicillin"

    # Clear Alice session
    await local_memento.clear_session_memory(session_a)
    alice_post_clear = await local_memento.recall_topic_memory(session_id=session_a, query="Metformin", topic="Metformin")
    assert len(alice_post_clear) == 0

    # Bob's data remains intact
    bob_check = await local_memento.recall_topic_memory(session_id=session_b, query="Amoxicillin", topic="Amoxicillin")
    assert len(bob_check) == 1

# 6. Test Safety Filter and Emergency Redirection
def test_safety_triage_alerts(orchestrator_instance):
    # Emergency overdose
    is_unsafe, msg = orchestrator_instance.check_safety_and_clinical_scope("I took an overdose of paracetamol")
    assert is_unsafe is True
    assert "URGENT SAFETY ALERT" in msg

    # Personalized prescription request
    is_unsafe, msg = orchestrator_instance.check_safety_and_clinical_scope("What dose should I start taking for my blood pressure?")
    assert is_unsafe is True
    assert "CLINICAL SCOPE NOTICE" in msg

    # Safe educational request
    is_unsafe, msg = orchestrator_instance.check_safety_and_clinical_scope("What is lisinopril used for?")
    assert is_unsafe is False
    assert msg is None

# 7. Test End-to-End Research Orchestration and Schema Validation
@pytest.mark.asyncio
async def test_end_to_end_research_orchestration(orchestrator_instance):
    req = ResearchRequest(
        query="Explain documented uses and warnings for Metformin",
        medicine_name="Metformin",
        intent="medicine_overview",
        session_id="test-session-e2e",
        detail_level="standard"
    )
    result = await orchestrator_instance.conduct_research(req)

    # Validate schema
    assert isinstance(result, MedicationResearchResponse)
    assert result.medicine.display_name.lower() == "metformin"
    assert len(result.documented_uses) > 0
    assert len(result.side_effects) > 0
    assert len(result.warnings_and_precautions) > 0
    assert len(result.sources) > 0

    # Check citation ID grounding
    valid_ids = {s.source_id for s in result.sources}
    for use in result.documented_uses:
        assert all(s_id in valid_ids for s_id in use.source_ids)
    for warn in result.warnings_and_precautions:
        assert all(s_id in valid_ids for s_id in warn.source_ids)

    # Disclaimer present
    assert "Educational information only" in result.disclaimer

# 8. Test Medication Comparison
@pytest.mark.asyncio
async def test_medication_comparison(orchestrator_instance):
    req = CompareRequest(
        medicine_a="Paracetamol",
        medicine_b="Ibuprofen",
        session_id="test-session-compare"
    )
    comparison = await orchestrator_instance.compare_medications(req)
    assert comparison.medicine_a.medicine.display_name.lower() in ["paracetamol", "acetaminophen"]
    assert comparison.medicine_b.medicine.display_name.lower() == "ibuprofen"
    assert len(comparison.comparison_notes) >= 3
    assert "does not state or imply that one medication is superior" in comparison.comparison_notes[2]

# 9. Test Follow-up Question Grounding
@pytest.mark.asyncio
async def test_follow_up_question(orchestrator_instance):
    # First research
    await orchestrator_instance.conduct_research(ResearchRequest(
        query="Metformin",
        medicine_name="Metformin",
        session_id="test-session-fu"
    ))

    # Ask relevant follow-up
    fu_req = FollowUpRequest(
        query="Can I drink alcohol while taking metformin?",
        medicine_name="Metformin",
        session_id="test-session-fu"
    )
    fu_resp = await orchestrator_instance.answer_follow_up(fu_req)
    assert "alcohol" in fu_resp.answer.lower()
    assert len(fu_resp.source_ids) > 0

# 10. Test Source Refresh and Version History
@pytest.mark.asyncio
async def test_source_refresh_and_version_history(orchestrator_instance):
    # Initial research
    res = await orchestrator_instance.conduct_research(ResearchRequest(
        query="Atorvastatin",
        medicine_name="Atorvastatin",
        session_id="test-session-refresh"
    ))
    initial_req_id = res.request_id

    # Refresh sources
    refresh_res = await orchestrator_instance.refresh_source_changes(initial_req_id, session_id="test-session-refresh")
    assert refresh_res.previous_request_id == initial_req_id
    assert refresh_res.new_research_record is not None
    assert refresh_res.new_research_record.request_id != initial_req_id

    # Verify new record in database
    new_db_rec = await db_service.get_research_record(refresh_res.new_research_record.request_id)
    assert new_db_rec is not None
    assert new_db_rec["version"] == 2
    assert new_db_rec["parent_request_id"] == initial_req_id

# 11. Test History Persistence across sessions
@pytest.mark.asyncio
async def test_history_persistence_and_clearing(orchestrator_instance):
    sess_id = "test-session-persist"
    await orchestrator_instance.conduct_research(ResearchRequest(
        query="Amoxicillin",
        medicine_name="Amoxicillin",
        session_id=sess_id
    ))

    history_data = await db_service.get_session_history(sess_id)
    assert len(history_data["research_records"]) >= 1
    assert history_data["research_records"][0]["medicine_name"].lower() == "amoxicillin"

    # Clear history
    await db_service.clear_session_history(sess_id)
    history_cleared = await db_service.get_session_history(sess_id)
    assert len(history_cleared["research_records"]) == 0

# 12. Test Empty or Unknown Medication
@pytest.mark.asyncio
async def test_unknown_medication_low_evidence(orchestrator_instance):
    res = await orchestrator_instance.conduct_research(ResearchRequest(
        query="unknown_fake_drug_xyz123",
        medicine_name="unknown_fake_drug_xyz123",
        session_id="test-session-empty"
    ))
    assert len(res.sources) == 0
    assert "No authoritative" in res.overview.text
    assert len(res.limitations) > 0
