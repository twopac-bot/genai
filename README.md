# DrugInfo AI – Medication Information Assistant

An evidence-grounded AI medication information assistant that gathers publicly available medication information from authoritative public healthcare sources (FDA, DailyMed, MedlinePlus, NHS, CDSCO, WHO), produces structured educational summaries, maintains persistent topic history using **Memento**, and retrieves live web evidence using **Firecrawl**.

> **Important Clinical Scope:** DrugInfo AI is an **educational research tool**, not a diagnostic or prescribing system. It does not provide personalized medical advice, diagnose conditions, or prescribe dosages. Acute emergencies and overdose questions are immediately redirected to local emergency services.

---

## 1. System Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │   React + TypeScript + Tailwind CSS UI       │
                  │  (Dashboard, Results, Comparison, History)   │
                  └──────────────────────┬───────────────────────┘
                                         │ HTTP REST
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │             FastAPI Backend                  │
                  │   /api/research, /api/follow-up, /compare    │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┼────────────────────────┐
                 ▼                       ▼                        ▼
        ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
        │ Firecrawl Engine │    │  Memento Memory  │    │ Async SQLite/PG  │
        │ Search & Scrape  │    │  Topic History   │    │ Research Records │
        │ Trusted Sources  │    │ Bitemporal Store │    │ Source Audit Logs│
        └──────────────────┘    └──────────────────┘    └──────────────────┘
```

### Core Components
- **Firecrawl Integration:** Searches and extracts text from verified authoritative health domains (`fda.gov`, `dailymed.nlm.nih.gov`, `medlineplus.gov`, `nhs.uk`, `who.int`, `cdsco.gov.in`). Includes an allowlist filter, trust tiers (Tier A/B/C), content hash freshness tracking, and a high-fidelity monograph mock adapter when API keys are not supplied.
- **Memento Integration:** Integrates with the official `memento-memory` bitemporal knowledge graph framework (`MemoryStore`), maintaining persistent, session-isolated topic history, previous queries, review timestamps, and citation IDs. Includes an isolated `LocalMementoAdapter` fallback for development environments.
- **Source Validation & Freshness Detection:** Deduplicates documents by canonical URL and SHA-256 content hashes, detects source disagreements/conflicts (e.g. food interactions, pregnancy safety differences across regulators), and creates versioned records upon source updates.
- **LLM Structured Summarization:** Grounded strictly in retrieved evidence, validates output using Pydantic schemas, attaches citation IDs to each factual section, highlights FDA boxed warnings, and leaves missing data explicitly marked.
- **Frontend Dashboard:** Modern healthcare UI with medicine search, quick-picks, interactive structured monographs, side-by-side neutral medication comparisons, persistent history review, and live/mock adapter status indicators.

---

## 2. Directory Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── research.py     # POST /api/research, GET /api/research/{id}, POST /refresh
│   │   │       ├── followups.py    # POST /api/follow-up
│   │   │       ├── compare.py      # POST /api/compare
│   │   │       ├── history.py      # GET /api/history/{session_id}, DELETE /api/history/{session_id}
│   │   │       └── health.py       # GET /api/health
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic BaseSettings environment configuration
│   │   │   └── logging.py          # Structured logging
│   │   ├── schemas/
│   │   │   ├── requests.py         # Request schemas (ResearchRequest, FollowUpRequest, etc.)
│   │   │   ├── medication.py       # MedicationResearchResponse, FactualSection, Conflicts
│   │   │   └── sources.py          # NormalizedSource, SourceSummary
│   │   ├── services/
│   │   │   ├── research_orchestrator.py # Core workflow orchestrator & safety triage
│   │   │   ├── source_validator.py      # Allowlist, trust tiers, deduplication, conflict detection
│   │   │   └── database_service.py      # Async SQLAlchemy persistence
│   │   ├── adapters/
│   │   │   ├── firecrawl_adapter.py     # Live Firecrawl client & Monograph Mock adapter
│   │   │   ├── memento_adapter.py       # Official Memento MemoryStore & Local session adapter
│   │   │   └── llm_adapter.py           # Provider abstraction (OpenAI / Gemini / Evidence Extractor)
│   │   └── repositories/
│   │       └── models.py           # SQLAlchemy models (sessions, research_records, source_documents)
│   ├── tests/
│   │   ├── test_druginfo.py        # 12 comprehensive unit and integration tests
│   │   └── test_api_endpoints.py   # Full HTTP end-to-end API test suite
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── MedicationSummary.tsx
│   │   │   ├── SourceCitation.tsx
│   │   │   ├── ConflictNotice.tsx
│   │   │   ├── SafetyNotice.tsx
│   │   │   └── HistoryList.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ResearchResult.tsx
│   │   │   ├── Compare.tsx
│   │   │   ├── History.tsx
│   │   │   └── Settings.tsx
│   │   ├── services/
│   │   │   └── api.ts              # Frontend API client
│   │   ├── types/
│   │   │   └── medication.ts       # TypeScript schemas
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── prompt.md                       # Project specification
└── README.md
```

---

## 3. Setup and Installation

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### Backend Setup
1. Open a terminal in the root directory:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Configure your keys if available:
   ```env
   APP_ENV=development
   API_HOST=127.0.0.1
   API_PORT=8000
   DATABASE_URL=sqlite+aiosqlite:///./druginfo.db
   FIRECRAWL_API_KEY=
   LLM_PROVIDER=mock
   LLM_API_KEY=
   MEMENTO_ENABLED=false
   ```
   *(If `FIRECRAWL_API_KEY` or `MEMENTO_API_KEY` are left blank, high-fidelity mock adapters will run transparently with clear status indicators in the UI).*

4. Run the automated test suite:
   ```bash
   $env:PYTHONPATH="backend"; pytest backend/tests/ -v
   ```

5. Start the backend server:
   ```bash
   $env:PYTHONPATH="backend"; uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

### Frontend Setup
1. In another terminal:
   ```bash
   cd frontend
   npm install
   ```
2. Build or start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend runs at `http://localhost:5173`.
   
   *(Alternatively, run `npm run build` in `frontend`; the FastAPI backend serves the compiled app at `http://127.0.0.1:8000/` directly).*

---

## 4. Key Workflows

### 1. Research a Medication
- Search for any medicine (e.g. `Metformin`, `Paracetamol`, `Lisinopril`, `Amoxicillin`, `Atorvastatin`, `Ibuprofen`).
- Inspect the structured monograph: generic/brand identities, documented uses, common vs serious boxed warnings, interactions, storage, and limitations.
- View inline citation pills (e.g. `[medlineplus.gov]`, `[accessdata.fda.gov]`, `[nhs.uk]`) linked to verified URLs.

### 2. Follow-up Questions
- Ask conversational questions (e.g. *"Can I drink alcohol while taking metformin?"* or *"Is this safe in pregnancy?"*).
- Answers are grounded strictly in the retrieved evidence and prior Memento topic context.

### 3. Neutral Comparison
- Compare two medicines side-by-side (e.g. *Paracetamol vs Ibuprofen*).
- Compares indications, adverse effects, and precautions from official sources without recommending clinical superiority.

### 4. Source Freshness & Change Detection
- Click **"Check Freshness"** on any monograph.
- Re-fetches the original source pages, calculates SHA-256 content hashes, detects content changes, and generates an updated version record while preserving the historical audit trail.

### 5. Persistent History & Session Isolation
- Navigate to **History** to revisit previously researched topics and questions.
- Clear history at any time with the **"Clear History"** action.

---

## 5. Automated Tests

The backend test suite in `backend/tests/` verifies all functional and safety requirements:
1. `test_source_allowlist_and_tiers` – Source allowlist and trust tiers (A, B, C)
2. `test_deduplicate_and_rank` – Deduplication by URL and hash, ranking Tier A above Tier B
3. `test_conflicting_source_statements` – Contradiction and conflict detection
4. `test_mock_firecrawl_retrieval` – Firecrawl adapter retrieval and error handling
5. `test_memento_session_isolation` – Strict user/session memory isolation in Memento
6. `test_safety_triage_alerts` – Immediate triage of overdose and personalized advice queries
7. `test_end_to_end_research_orchestration` – Full research orchestration and Pydantic schema validation
8. `test_medication_comparison` – Dual medication comparison
9. `test_follow_up_question` – Grounded follow-up question answering
10. `test_source_refresh_and_version_history` – Content freshness hash diff and version increment
11. `test_history_persistence_and_clearing` – Session history persistence and erasure
12. `test_unknown_medication_low_evidence` – Safe handling of unknown medicines
13. `test_api_health_endpoint` – Health check route with provider status
14. `test_api_research_and_history_flow` – End-to-end FastAPI HTTP client flow
