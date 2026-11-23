export interface MedicineIdentity {
  display_name: string;
  generic_name?: string | null;
  brand_name?: string | null;
  active_ingredients: string[];
  formulation?: string | null;
  jurisdiction?: string | null;
}

export interface FactualSection {
  text: string;
  source_ids: string[];
}

export interface SideEffectSection {
  text: string;
  classification: 'common' | 'serious' | 'boxed_warning' | 'as_stated_by_source' | string;
  source_ids: string[];
}

export interface DifferingView {
  source_id: string;
  source_title: string;
  statement: string;
}

export interface SourceConflict {
  topic: string;
  description: string;
  differing_views: DifferingView[];
}

export interface SourceSummary {
  source_id: string;
  title: string;
  url: string;
  domain: string;
  jurisdiction?: string | null;
  source_type: string;
  published_or_updated_at?: string | null;
  retrieved_at: string;
  trust_tier?: 'A' | 'B' | 'C' | string;
}

export interface MemoryContextMeta {
  used_previous_context: boolean;
  previous_topic_reference?: string | null;
  memento_mode: string;
  recalled_topics: string[];
}

export interface ServiceStatusMeta {
  firecrawl: {
    mode: string;
    provider: string;
    connected: boolean;
    mock: boolean;
    notice?: string;
  };
  memento: {
    mode: string;
    provider: string;
    connected: boolean;
    mock: boolean;
    notice?: string;
  };
  llm: {
    mode: string;
    provider: string;
    connected: boolean;
    mock: boolean;
    notice?: string;
  };
  database: {
    url: string;
    status: string;
  };
}

export interface MedicationResearchResponse {
  request_id: string;
  medicine: MedicineIdentity;
  overview: FactualSection;
  documented_uses: FactualSection[];
  side_effects: SideEffectSection[];
  warnings_and_precautions: FactualSection[];
  interactions: FactualSection[];
  storage_information?: FactualSection | null;
  limitations: string[];
  source_conflicts: SourceConflict[];
  sources: SourceSummary[];
  memory: MemoryContextMeta;
  reviewed_at: string;
  disclaimer: string;
  service_status?: ServiceStatusMeta;
  is_safety_warning?: boolean;
  safety_guidance?: string | null;
}

export interface FollowUpAnswerResponse {
  answer_id: string;
  medicine_name: string;
  question: string;
  answer: string;
  source_ids: string[];
  sources: SourceSummary[];
  requires_new_search: boolean;
  memory_context_used: boolean;
  created_at: string;
  disclaimer: string;
  resolved_query?: {
    intent: string;
    medicines: string[];
    resolved_question: string;
    search_required: boolean;
    search_query: string;
    clarification_needed: boolean;
    clarification_prompt?: string | null;
  } | null;
  clarification_needed?: boolean;
  clarification_prompt?: string | null;
}

export interface MedicationComparisonResponse {
  comparison_id: string;
  medicine_a: MedicationResearchResponse;
  medicine_b: MedicationResearchResponse;
  comparison_notes: string[];
  disclaimer: string;
  compared_at: string;
}

export interface SourceRefreshResponse {
  request_id: string;
  previous_request_id: string;
  checked_at: string;
  has_changes: boolean;
  changed_sources: string[];
  change_summary: string;
  new_research_record?: MedicationResearchResponse | null;
}

export interface SessionHistory {
  session_id: string;
  research_records: Array<{
    request_id: string;
    medicine_name: string;
    query: string;
    created_at: string;
    version: number;
    summary_overview: string;
  }>;
  questions: Array<{
    id: string;
    medicine_name: string;
    question: string;
    answer_preview: string;
    created_at: string;
    research_request_id?: string;
  }>;
  memento_topics?: Array<{
    topic: string;
    reviewed_at: string;
    summary_reference: string;
  }>;
  memento_status?: any;
}

export interface ImageIdentificationResponse {
  identified_medicine?: string | null;
  brand_name?: string | null;
  active_ingredients: string[];
  dosage_strength?: string | null;
  confidence_level: 'high' | 'medium' | 'low' | 'undetermined';
  packaging_details?: string | null;
  detected_warnings?: string | null;
  analysis_summary: string;
  research_result?: MedicationResearchResponse | null;
}
