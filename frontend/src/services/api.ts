import {
  MedicationResearchResponse,
  FollowUpAnswerResponse,
  MedicationComparisonResponse,
  SourceRefreshResponse,
  SessionHistory,
  ImageIdentificationResponse,
} from '../types/medication';

const API_BASE = '/api';

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Failed to fetch system health status.');
    return res.json();
  },

  async conductResearch(
    query: string,
    medicineName?: string,
    sessionId: string = 'default-session',
    detailLevel: 'simple' | 'standard' | 'detailed' = 'standard'
  ): Promise<MedicationResearchResponse> {
    const res = await fetch(`${API_BASE}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        medicine_name: medicineName || query,
        intent: 'medicine_overview',
        session_id: sessionId,
        language: 'en',
        detail_level: detailLevel,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to conduct medication research.');
    }
    return res.json();
  },

  async getResearchRecord(requestId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/research/${requestId}`);
    if (!res.ok) throw new Error('Research record not found.');
    return res.json();
  },

  async refreshResearch(
    requestId: string,
    sessionId?: string
  ): Promise<SourceRefreshResponse> {
    const res = await fetch(`${API_BASE}/research/${requestId}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to refresh source change analysis.');
    }
    return res.json();
  },

  async askFollowUp(
    query: string,
    medicineName: string,
    sessionId: string = 'default-session',
    requestId?: string
  ): Promise<FollowUpAnswerResponse> {
    const res = await fetch(`${API_BASE}/follow-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        medicine_name: medicineName,
        session_id: sessionId,
        request_id: requestId,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to answer follow-up question.');
    }
    return res.json();
  },

  async compareMedications(
    medicineA: string,
    medicineB: string,
    sessionId: string = 'default-session'
  ): Promise<MedicationComparisonResponse> {
    const res = await fetch(`${API_BASE}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        medicine_a: medicineA,
        medicine_b: medicineB,
        session_id: sessionId,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to compare medications.');
    }
    return res.json();
  },

  async getSessionHistory(sessionId: string): Promise<SessionHistory> {
    const res = await fetch(`${API_BASE}/history/${sessionId}`);
    if (!res.ok) throw new Error('Failed to retrieve session history.');
    return res.json();
  },

  async clearSessionHistory(sessionId: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/history/${sessionId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to clear session history.');
    return res.json();
  },

  async identifyImage(
    imageBase64: string,
    notes?: string,
    sessionId: string = 'default-session',
    autoResearch: boolean = true
  ): Promise<ImageIdentificationResponse> {
    const res = await fetch(`${API_BASE}/research/identify-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: imageBase64,
        session_id: sessionId,
        additional_notes: notes,
        auto_research: autoResearch,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to identify medication from image.');
    }
    return res.json();
  },

  // FEATURE 1: Medicine Packaging Scanner
  async scanPackaging(imageData: string, notes?: string, sessionId: string = 'default-session') {
    const res = await fetch(`${API_BASE}/scanner/packaging`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_data: imageData, notes, session_id: sessionId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to scan medication packaging.');
    }
    return res.json();
  },

  async confirmPackaging(data: {
    medicine_name: string;
    brand_name?: string;
    generic_name?: string;
    dosage_strength?: string;
    manufacturer?: string;
    batch_number?: string;
    mfg_date?: string;
    expiry_date?: string;
    packaging_type?: string;
    notes?: string;
    image_data?: string;
    save_to_cabinet?: boolean;
    session_id?: string;
  }) {
    const res = await fetch(`${API_BASE}/scanner/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: 'default-session', ...data }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to confirm packaging.');
    }
    return res.json();
  },

  // FEATURE 2: Prescription Explainer
  async scanPrescription(imageData: string, notes?: string, sessionId: string = 'default-session') {
    const res = await fetch(`${API_BASE}/scanner/prescription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_data: imageData, notes, session_id: sessionId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to explain prescription image.');
    }
    return res.json();
  },

  // FEATURE 3: Multi-Drug Interaction Explorer
  async analyzeMultiDrugInteractions(medicines: string[], sessionId: string = 'default-session') {
    const res = await fetch(`${API_BASE}/interactions/multi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicines, session_id: sessionId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to analyze drug interactions.');
    }
    return res.json();
  },

  // FEATURE 4: Medical Document Summarizer
  async uploadMedicalDocument(file: File, sessionId: string = 'default-session') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId);
    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to upload medical document.');
    }
    return res.json();
  },

  async listDocuments(sessionId: string = 'default-session') {
    const res = await fetch(`${API_BASE}/documents?session_id=${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error('Failed to list uploaded documents.');
    return res.json();
  },

  async getDocument(documentId: string) {
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(documentId)}`);
    if (!res.ok) throw new Error('Failed to retrieve document.');
    return res.json();
  },

  async askDocumentQuestion(documentId: string, question: string, sessionId: string = 'default-session') {
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(documentId)}/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, session_id: sessionId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to answer document question.');
    }
    return res.json();
  },

  // FEATURE 5: Voice Medication Assistant
  async transcribeAudio(audioBlob: Blob, language: string = 'en') {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('language', language);
    const res = await fetch(`${API_BASE}/assistant/voice/transcribe`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Audio transcription failed.');
    }
    return res.json();
  },

  async processVoice(transcript: string, language: string = 'en', sessionId: string = 'default-session', activeMedicine?: string) {
    const res = await fetch(`${API_BASE}/assistant/voice/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, language, session_id: sessionId, active_medicine: activeMedicine }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to process voice interaction.');
    }
    return res.json();
  },

  // FEATURE 6: Medicine Expiry Tracker
  async getCabinetItems(sessionId: string = 'default-session') {
    const res = await fetch(`${API_BASE}/cabinet?session_id=${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error('Failed to fetch medicine cabinet.');
    return res.json();
  },

  async addCabinetItem(item: {
    medicine_name: string;
    brand_name?: string;
    generic_name?: string;
    dosage_strength?: string;
    manufacturer?: string;
    batch_number?: string;
    mfg_date?: string;
    expiry_date: string;
    packaging_type?: string;
    notes?: string;
    image_data?: string;
    session_id?: string;
  }) {
    const res = await fetch(`${API_BASE}/cabinet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: 'default-session', ...item }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to add medicine to cabinet.');
    }
    return res.json();
  },

  async updateCabinetItem(itemId: string, updates: any, sessionId: string = 'default-session') {
    const res = await fetch(`${API_BASE}/cabinet/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, ...updates }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update cabinet item.');
    }
    return res.json();
  },

  async deleteCabinetItem(itemId: string, sessionId: string = 'default-session') {
    const res = await fetch(`${API_BASE}/cabinet/${encodeURIComponent(itemId)}?session_id=${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to remove medicine from cabinet.');
    return res.json();
  },

  // FEATURE 7: Knowledge Graph
  async getKnowledgeGraph(requestId: string) {
    const res = await fetch(`${API_BASE}/assistant/knowledge-graph/${encodeURIComponent(requestId)}`);
    if (!res.ok) throw new Error('Failed to fetch knowledge graph.');
    return res.json();
  },

  // FEATURE 10: Multilingual Translation
  async translateContent(content: any, targetLanguage: 'hi' | 'te' | 'en') {
    const res = await fetch(`${API_BASE}/assistant/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, target_language: targetLanguage }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to translate content.');
    }
    return res.json();
  },

  // FEATURE 11: Bookmarks
  async addBookmark(sessionId: string, requestId: string, medicineName: string) {
    const res = await fetch(`${API_BASE}/assistant/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, request_id: requestId, medicine_name: medicineName }),
    });
    if (!res.ok) throw new Error('Failed to add bookmark.');
    return res.json();
  },

  async removeBookmark(bookmarkId: string, sessionId: string = 'default-session') {
    const res = await fetch(`${API_BASE}/assistant/bookmarks/${encodeURIComponent(bookmarkId)}?session_id=${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to remove bookmark.');
    return res.json();
  },

  // FEATURE 12: FAQs
  async getFaqs(requestId: string) {
    const res = await fetch(`${API_BASE}/assistant/faqs/${encodeURIComponent(requestId)}`);
    if (!res.ok) throw new Error('Failed to generate FAQs.');
    return res.json();
  },
};
