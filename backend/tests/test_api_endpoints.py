import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.database_service import db_service

@pytest_asyncio.fixture(autouse=True)
async def init_db():
    await db_service.init_db()
    yield

@pytest.mark.asyncio
async def test_api_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "firecrawl" in data["services"]
        assert "memento" in data["services"]

@pytest.mark.asyncio
async def test_api_research_and_history_flow():
    session_id = "test-e2e-api-session"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. POST /api/research
        research_payload = {
            "query": "Metformin",
            "medicine_name": "Metformin",
            "intent": "medicine_overview",
            "session_id": session_id,
            "detail_level": "standard"
        }
        res = await client.post("/api/research", json=research_payload)
        assert res.status_code == 200
        research_data = res.json()
        request_id = research_data["request_id"]
        assert request_id is not None
        assert research_data["medicine"]["display_name"].lower() == "metformin"
        assert len(research_data["sources"]) > 0

        # 2. GET /api/research/{request_id}
        get_res = await client.get(f"/api/research/{request_id}")
        assert get_res.status_code == 200
        assert get_res.json()["request_id"] == request_id

        # 3. POST /api/follow-up
        fu_payload = {
            "query": "Is metformin safe in pregnancy?",
            "medicine_name": "Metformin",
            "session_id": session_id,
            "request_id": request_id
        }
        fu_res = await client.post("/api/follow-up", json=fu_payload)
        assert fu_res.status_code == 200
        assert fu_res.json()["medicine_name"] == "Metformin"

        # 4. POST /api/compare
        cmp_payload = {
            "medicine_a": "Metformin",
            "medicine_b": "Lisinopril",
            "session_id": session_id
        }
        cmp_res = await client.post("/api/compare", json=cmp_payload)
        assert cmp_res.status_code == 200
        cmp_data = cmp_res.json()
        assert cmp_data["medicine_a"]["medicine"]["display_name"].lower() == "metformin"
        assert cmp_data["medicine_b"]["medicine"]["display_name"].lower() == "lisinopril"

        # 5. POST /api/research/{request_id}/refresh
        ref_res = await client.post(f"/api/research/{request_id}/refresh", json={"session_id": session_id})
        assert ref_res.status_code == 200
        ref_data = ref_res.json()
        assert ref_data["previous_request_id"] == request_id

        # 6. GET /api/history/{session_id}
        hist_res = await client.get(f"/api/history/{session_id}")
        assert hist_res.status_code == 200
        hist_data = hist_res.json()
        assert len(hist_data["research_records"]) >= 1

        # 7. DELETE /api/history/{session_id}
        del_res = await client.delete(f"/api/history/{session_id}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "success"

        # Confirm history is empty
        hist_post_del = await client.get(f"/api/history/{session_id}")
        assert len(hist_post_del.json()["research_records"]) == 0
