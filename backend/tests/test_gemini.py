import pytest
import os
import json
from unittest.mock import MagicMock, AsyncMock, patch

from app.adapters.gemini_adapter import GeminiAdapter
from app.schemas.sources import NormalizedSource
from app.schemas.requests import ResolvedQuery
from app.schemas.medication import MedicationResearchResponse

def test_gemini_missing_api_key():
    adapter = GeminiAdapter(api_key="")
    status = adapter.get_status()
    assert status["connected"] is False
    assert adapter.client is None

def test_gemini_heuristic_resolution():
    adapter = GeminiAdapter(api_key="")
    # Pronoun resolution with active medicine
    res = adapter._heuristic_resolve_query(
        query="Can I take it with Paracetamol?",
        active_medicine="Cetirizine"
    )
    assert isinstance(res, ResolvedQuery)
    assert "Cetirizine" in res.medicines
    assert "Paracetamol" in res.medicines
    assert res.intent == "drug_interaction"
    assert "Cetirizine" in res.resolved_question

def test_gemini_clarification_on_ambiguous_reference():
    adapter = GeminiAdapter(api_key="")
    # Ambiguous question without prior context
    res = adapter._heuristic_resolve_query(
        query="Can I take it with another medicine?",
        active_medicine=None
    )
    assert res.clarification_needed is True
    assert res.clarification_prompt is not None

@pytest.mark.asyncio
async def test_gemini_structured_summary_generation_mock():
    # Test handling of mock/live client with structured payload
    sources = [
        NormalizedSource(
            source_id="src-fda-test",
            title="FDA Monograph",
            url="https://fda.gov/test",
            domain="fda.gov",
            jurisdiction="US",
            source_type="official_label",
            published_or_updated_at="2024-01-01",
            retrieved_at="2026-01-01T00:00:00Z",
            content="Cetirizine is an antihistamine used for relief of allergic rhinitis.",
            trust_tier="A"
        )
    ]
    
    adapter = GeminiAdapter(api_key="test-dummy-key")
    # Mock client generate_content
    mock_resp = MagicMock()
    mock_resp.text = json.dumps({
        "medicine": {
            "display_name": "Cetirizine",
            "generic_name": "Cetirizine HCl",
            "active_ingredients": ["Cetirizine"]
        },
        "overview": {
            "text": "Cetirizine is an antihistamine.",
            "source_ids": ["src-fda-test"]
        },
        "documented_uses": [{"text": "Allergic rhinitis", "source_ids": ["src-fda-test"]}],
        "side_effects": [{"text": "Drowsiness", "classification": "common", "source_ids": ["src-fda-test"]}],
        "warnings_and_precautions": [],
        "interactions": [],
        "storage_information": None,
        "limitations": [],
        "source_conflicts": []
    })
    
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_resp
    adapter.client = mock_client

    result = await adapter.generate_medication_summary(
        medicine_name="Cetirizine",
        sources=sources,
        query="Explain Cetirizine"
    )
    assert isinstance(result, MedicationResearchResponse)
    assert result.medicine.display_name == "Cetirizine"
    assert len(result.documented_uses) == 1
    assert result.documented_uses[0].source_ids == ["src-fda-test"]
