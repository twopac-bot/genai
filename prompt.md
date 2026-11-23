# DrugInfo AI --- Full Project Specification

## 1. Project overview

**Project name:** DrugInfo AI: Medication Information Assistant

**Purpose:** Build a web application that gathers publicly available
medication information from authoritative sources, turns the retrieved
evidence into clear, structured educational summaries, and maintains
persistent topic history.

DrugInfo AI is an **educational information tool**, not a diagnostic,
prescribing, or treatment system. It must not tell users what medicine
to start, stop, or change, and must not provide personalized treatment
or dosage recommendations.

### Core idea

-   **Firecrawl:** discovers and extracts current public web
    information.
-   **LLM:** converts source evidence into a structured, readable
    educational summary.
-   **Memento:** provides persistent memory for previously reviewed
    medication topics and recurring questions.
-   **Database:** stores durable application records, source
    snapshots/metadata, and research history.
-   **Frontend:** lets users search, ask follow-up questions, inspect
    citations, and revisit history.

Do not assume a particular Memento SDK, endpoint, package, or schema.
First inspect the supplied project environment and the official
documentation/repository available to the developer. Implement a small
Memento adapter around the verified interface. If the exact Memento
product or credentials are not available, create a clearly isolated
interface and a mock/local development adapter; document what must be
configured. Do not fabricate API calls.

## 2. Primary user journey

1.  User enters a medicine name or an educational question.
2.  Backend validates and classifies the request.
3.  Backend checks Memento for relevant prior topic history.
4.  Firecrawl searches for current evidence from an allowlist of trusted
    sources.
5.  Backend extracts and normalizes source content, retaining URLs,
    titles, source dates where available, and retrieval timestamps.
6.  Source validation checks domain trust, relevance, freshness,
    duplication, and conflicting statements.
7.  LLM receives only the retrieved evidence plus relevant memory and
    produces schema-valid structured educational content.
8.  Backend validates the LLM output and verifies that citations refer
    to retrieved documents.
9.  Research record is saved to the database and relevant memory is
    written to Memento.
10. Frontend displays the summary, source references,
    uncertainty/conflict notices, and prior topic history.

Memory is context, not evidence. A remembered summary must never be
treated as current medical truth. Re-fetch sources for new/current
questions and clearly identify when a response uses historical material.

## 3. Functional requirements

### 3.1 Medicine search

Support: - Search by generic medicine name. - Search by brand name. -
Ask a question about a medicine. - Compare two medicines at the level of
published educational information.

Do not infer that two brand names contain the same active ingredient
without evidence. Ask a concise clarification when the medicine identity
is ambiguous (for example, different formulations or products sharing a
brand name).

### 3.2 Firecrawl retrieval

Use Firecrawl for search and/or scraping according to its currently
documented API.

Prioritize authoritative sources, such as: - Official regulator and
government health agency pages. - Official product/medication labels and
public drug-label databases. - Recognized public health services and
national health information services. - Reputable medical reference
services for patient education.

Potential source examples include DailyMed, MedlinePlus, NHS, FDA, and
relevant Indian government/regulatory sources where applicable. Do not
imply that a US source is Indian regulatory guidance. Label jurisdiction
clearly.

Requirements: - Maintain a configurable source allowlist and source
priority. - Search for the exact medicine and relevant synonyms/active
ingredients. - Scrape only relevant pages; avoid indiscriminate
crawling. - Respect robots.txt, website terms, rate limits, access
restrictions, and Firecrawl policies. - Do not bypass logins, paywalls,
CAPTCHAs, or access controls. - Store canonical URL, page title, domain,
jurisdiction (if known), source type, source publication/update date (if
present), retrieval timestamp, and extracted text. - Deduplicate
identical or near-identical pages. - Do not treat search snippets as
sufficient evidence for important medication claims. - If no reliable
source is found, say so rather than filling gaps from model knowledge.

Suggested normalized source object:

``` json
{
  "source_id": "internal-id",
  "title": "Official medication information",
  "url": "https://example.org/medicine",
  "domain": "example.org",
  "jurisdiction": "US",
  "source_type": "official_label",
  "published_or_updated_at": null,
  "retrieved_at": "ISO-8601 timestamp",
  "content": "Extracted source text",
  "trust_tier": "A"
}
```

The above is an internal application schema, not a claim about
Firecrawl's native response.

### 3.3 Source validation and evidence handling

Create a source-validation layer before LLM generation.

It should: - Rank official regulator/label sources above general
informational pages. - Preserve jurisdiction and source type. - Flag
old, undated, inaccessible, or low-confidence sources. - Detect when
sources disagree. - Keep claims linked to the source passages that
support them. - Avoid presenting a source's absence of information as
proof that a risk does not exist. - Mark unavailable fields as
`not_found_in_sources` or equivalent. - Avoid making up publication
dates, URLs, source names, or evidence.

If sources conflict, show a conflict notice and summarize the differing
source statements with citations. Do not silently choose one.

### 3.4 LLM structured summarization

Use a provider abstraction so the LLM can be configured for a supported
model/provider without rewriting the application.

The LLM must: - Use retrieved evidence as the factual basis. - Explain
medical terminology in plain language. - Separate documented uses,
adverse effects, warnings, precautions, interactions, and storage
information. - Distinguish common effects from serious warnings only
when the sources make that distinction. - Preserve uncertainty and
source disagreement. - Avoid personalized diagnosis, prescribing,
treatment, or dosage advice. - Return strict JSON matching the
application's schema. - Include source IDs for each factual section or
claim. - Mark unsupported or unavailable fields clearly.

Do not ask the LLM to invent missing information. Validate JSON with
Pydantic (or an equivalent schema validator). Retry once with validation
errors if appropriate; if still invalid, return a safe processing error
rather than malformed content.

### 3.5 Memento persistent memory

Memento should support: - Previously reviewed medicine topics. -
Relevant previous questions. - Summaries and their review timestamps. -
Source identifiers/URLs associated with the previous review. - Topic
relationships and recurring educational interests, if supported by the
verified Memento product.

Before integration: 1. Identify the exact Memento product/framework and
version. 2. Read its official documentation. 3. Confirm authentication,
memory creation, retrieval, update, deletion, and metadata support. 4.
Implement only verified APIs and schemas. 5. Keep all Memento-specific
code inside a `MementoAdapter`.

Suggested logical memory payload (adapt to the actual Memento API):

``` json
{
  "user_or_session_key": "opaque-user-or-session-id",
  "topic": "Example medicine",
  "questions": ["What is it used for?"],
  "summary_reference": "research-record-id",
  "source_references": ["source-id-1"],
  "reviewed_at": "ISO-8601 timestamp",
  "memory_type": "medication_topic_history"
}
```

Privacy and safety: - Do not store sensitive personal health details by
default. - Do not collect patient history, diagnoses, prescriptions, or
identifiable medical records for this educational use case. - Use opaque
user/session identifiers. - Provide a way to clear a user's topic
history where supported. - Do not put API keys, secrets, or raw
credentials in memory. - Memory retrieval must be scoped to the current
user/session and access-controlled. - Do not expose one user's memories
to another user.

If Memento is unavailable, the application must still run using a
documented local mock adapter, and the UI must not falsely claim that
persistent Memento memory is active.

### 3.6 Database

Use a database for durable application state. MongoDB or PostgreSQL is
acceptable; choose one and explain the choice.

Suggested entities/collections: - `users_or_sessions` -
`research_records` - `source_documents` - `conversation_questions` -
`source_change_checks` - `feedback` (optional)

A research record should link the query, normalized medicine identity,
structured summary, source IDs, created/reviewed timestamps, model
metadata, and validation status.

Do not rely on Memento as the only database.

### 3.7 Frontend pages

Build a polished, responsive interface with:

1.  **Home/Dashboard**
    -   DrugInfo AI title and concise educational disclaimer.
    -   Medicine search input.
    -   Recent topics.
    -   Clear explanation of what the tool can and cannot do.
2.  **Research Results**
    -   Medicine name and identity/formulation if known.
    -   Overview.
    -   Documented uses.
    -   Side effects/adverse reactions.
    -   Warnings and precautions.
    -   Interactions (only if supported by evidence).
    -   Storage information (only if supported by evidence).
    -   Source citations beside relevant content.
    -   Retrieval/review dates.
    -   Source disagreement and missing-data notices.
3.  **Ask a Follow-up**
    -   Natural-language question field.
    -   Answers grounded in current retrieved evidence and relevant
        prior topic context.
    -   Clearly state when a new source lookup is needed.
4.  **Research History**
    -   Previously researched topics.
    -   Previous questions.
    -   Review dates.
    -   Source links.
    -   Open previous summary.
    -   Re-check sources action.
5.  **Comparison**
    -   Compare two medicines' documented information in separate
        columns.
    -   Show sources for each side.
    -   Do not conclude which medicine is better or suitable for the
        user.
6.  **Settings/Privacy**
    -   Explain what history is stored.
    -   Clear history option where supported.
    -   Do not expose secrets or internal configuration.

## 4. Input and output contracts

### 4.1 Main request input

Example application API request:

``` json
{
  "query": "Explain the publicly documented information about Example Medicine",
  "medicine_name": "Example Medicine",
  "intent": "medicine_overview",
  "session_id": "opaque-session-id",
  "language": "en",
  "detail_level": "standard"
}
```

Fields: - `query` (required): user's natural-language request. -
`medicine_name` (optional): identified medicine name. - `intent`
(required): `medicine_overview`, `follow_up`, or `compare`. -
`session_id` (required for session history): opaque identifier. -
`language` (optional, default English). - `detail_level` (optional:
`simple`, `standard`, `detailed`).

For a comparison, use a separate validated payload with two medicine
names. Never accept a request to generate personalized treatment advice.

### 4.2 Structured response output

Use a Pydantic schema equivalent to:

``` json
{
  "request_id": "uuid",
  "medicine": {
    "display_name": "Example Medicine",
    "generic_name": null,
    "brand_name": null,
    "active_ingredients": [],
    "formulation": null,
    "jurisdiction": null
  },
  "overview": {
    "text": "Evidence-based educational overview.",
    "source_ids": ["source-id-1"]
  },
  "documented_uses": [
    {
      "text": "Use stated in the cited source.",
      "source_ids": ["source-id-1"]
    }
  ],
  "side_effects": [
    {
      "text": "Effect stated in the cited source.",
      "classification": "as_stated_by_source",
      "source_ids": ["source-id-1"]
    }
  ],
  "warnings_and_precautions": [
    {
      "text": "Warning stated in the cited source.",
      "source_ids": ["source-id-1"]
    }
  ],
  "interactions": [],
  "storage_information": null,
  "limitations": [],
  "source_conflicts": [],
  "sources": [
    {
      "source_id": "source-id-1",
      "title": "Source title",
      "url": "https://example.org",
      "domain": "example.org",
      "jurisdiction": "US",
      "source_type": "official_label",
      "published_or_updated_at": null,
      "retrieved_at": "ISO-8601 timestamp"
    }
  ],
  "memory": {
    "used_previous_context": false,
    "previous_topic_reference": null
  },
  "reviewed_at": "ISO-8601 timestamp",
  "disclaimer": "Educational information only; not personalized medical advice."
}
```

This is the application's target output contract. Do not copy example
medicine facts into real responses. Every factual item must be supported
by its cited source IDs.

### 4.3 Error and low-evidence output

Return explicit states for: - Medicine name ambiguous. - No
authoritative sources found. - Sources unavailable. - Conflicting
evidence. - LLM output failed schema validation. - Firecrawl/Memento
provider unavailable. - Rate limit or network error.

Never return a confident-looking empty or fabricated summary.

## 5. Suggested backend architecture

Use a modular FastAPI backend:

``` text
backend/
  app/
    main.py
    api/
      routes/
        research.py
        history.py
        followups.py
        compare.py
    core/
      config.py
      logging.py
      security.py
    schemas/
      requests.py
      medication.py
      sources.py
    services/
      research_orchestrator.py
      firecrawl_service.py
      source_validator.py
      llm_service.py
      memory_service.py
      database_service.py
    adapters/
      firecrawl_adapter.py
      memento_adapter.py
      llm_adapter.py
    repositories/
      research_repository.py
      source_repository.py
    tests/
```

Suggested API routes: - `POST /api/research` --- conduct a medicine
information research request. - `POST /api/follow-up` --- answer a
follow-up using current evidence and relevant memory. -
`POST /api/compare` --- compare documented information for two
medicines. - `GET /api/history/{session_id}` --- retrieve topic
history. - `GET /api/research/{request_id}` --- retrieve a saved
research record. - `POST /api/research/{request_id}/refresh` ---
re-check source pages. - `DELETE /api/history/{session_id}` --- clear
history where supported.

Use proper authentication/authorization if accounts are implemented. Do
not rely on a user-supplied session ID alone for access control in a
public deployment.

## 6. Suggested frontend architecture

Use React with TypeScript and Tailwind CSS.

Suggested structure:

``` text
frontend/
  src/
    components/
      SearchBar.tsx
      MedicationSummary.tsx
      SourceCitation.tsx
      SafetyNotice.tsx
      HistoryList.tsx
      ConflictNotice.tsx
    pages/
      Dashboard.tsx
      ResearchResult.tsx
      FollowUp.tsx
      History.tsx
      Compare.tsx
      Settings.tsx
    services/
      api.ts
    types/
      medication.ts
```

Design: - Clean healthcare/research dashboard. - Readable typography and
accessible contrast. - Responsive desktop and mobile layouts. - Clear
visual distinction between evidence, source notes, limitations, and
disclaimer. - Never use visual design to imply clinical approval or
personalized suitability.

## 7. Source freshness and change detection

When a user reopens a previous topic: 1. Retrieve the previous research
record and Memento context. 2. Re-fetch the original source URLs using
Firecrawl where allowed. 3. Compare normalized content or content
hashes. 4. Identify changed sections. 5. Re-run source validation and
LLM summarization if material changes are detected. 6. Save a new
research version; do not overwrite the audit history. 7. Display both
the previous review date and the new retrieval date.

A changed webpage does not automatically mean medication guidance
changed. Describe the detected page/content change accurately and avoid
overstating its clinical significance.

## 8. Safety, privacy, and quality requirements

Mandatory: - No diagnosis. - No personalized prescribing or treatment
recommendations. - No instructions to start, stop, or change
medication. - No personalized dosage calculations. - No fabricated
claims, citations, URLs, dates, or source details. - No unsupported
inference from missing data. - Clear educational-only disclaimer. -
Source citations attached to factual claims. - Jurisdiction labels for
regulatory sources. - Explicit uncertainty and contradiction notices. -
User/session memory isolation. - Secrets in environment variables, never
committed to source control. - Input validation, rate limiting, safe
logging, and error handling. - Avoid logging sensitive user health
information. - Respect website terms and scraping restrictions.

For urgent symptoms, poisoning, suspected overdose, or a possible
serious reaction, do not attempt to manage the situation through the
summarizer. Display a clear instruction to contact local emergency
services or a qualified healthcare professional/poison information
service promptly.

## 9. Testing requirements

Create automated tests for: - Medicine-name validation and ambiguous
matches. - Firecrawl adapter success, timeout, and failure. - Source
allowlist and source ranking. - Duplicate source removal. - Missing
dates and missing content. - Conflicting source statements. - LLM schema
validation. - Citation IDs that do not exist. - Memory retrieval and
user/session isolation. - Memory unavailable fallback. - History
persistence across restarts. - Source refresh and version history. -
Unsafe/personalized medical-advice requests. - Empty or low-quality
retrieval results.

Use mocked Firecrawl, LLM, database, and Memento adapters in unit tests.
Add a small end-to-end test with mocked external services. Never make
tests depend on live medical content or real credentials.

## 10. Environment configuration

Create `.env.example` with placeholders only:

``` env
APP_ENV=development
API_HOST=127.0.0.1
API_PORT=8000
DATABASE_URL=
FIRECRAWL_API_KEY=
LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=
MEMENTO_ENABLED=false
MEMENTO_API_KEY=
MEMENTO_BASE_URL=
```

Only include Memento variables that match the verified integration. Do
not assume a base URL or key format. Add `.env` to `.gitignore`.

## 11. Development sequence

Build in this order:

1.  Inspect the existing repository and identify what is already
    implemented.
2.  Confirm the exact Memento product and read its official integration
    instructions.
3.  Define Pydantic request/response schemas and source evidence model.
4.  Build FastAPI endpoints and database persistence.
5.  Implement Firecrawl retrieval with an allowlist and mocked tests.
6.  Implement source validation and evidence tracking.
7.  Implement LLM structured generation and output validation.
8.  Implement Memento adapter and memory retrieval/write operations.
9.  Build React pages and connect them to the API.
10. Add history, source refresh, conflict notices, and comparison.
11. Run tests, linting, and type checks.
12. Document local setup, environment variables, limitations, and
    deployment.

## 12. Definition of done

The project is complete when: - A user can search for a medicine. -
Firecrawl retrieves relevant information from trusted public sources. -
The system preserves source URLs and retrieval dates. - The LLM
generates valid structured educational content. - Each factual section
has supporting citations. - Missing or conflicting information is
visibly identified. - Memento can retrieve and store relevant topic
history using its verified integration. - The application has a working
local fallback if Memento credentials are unavailable. - Users can
revisit prior research and request a source refresh. - No component
presents the system as a doctor or gives personalized treatment
advice. - Setup instructions and automated tests are included.

## 13. Important implementation instruction

Do not build a superficial UI-only demo. Implement the actual end-to-end
data flow, but use adapters and mock mode when credentials are missing.
Do not fabricate successful external API calls. Clearly show whether the
app is using live Firecrawl/Memento services or development mocks.

Before making large changes, inspect the repository, summarize the
current state, and then implement incrementally. Keep code modular,
typed, documented, and testable.
