import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Shield,
  Database,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import { api } from '../services/api';

interface DocumentAnalyzerPageProps {
  sessionId: string;
}

export const DocumentAnalyzerPage: React.FC<DocumentAnalyzerPageProps> = ({ sessionId }) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [activeDoc, setActiveDoc] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Q&A state
  const [question, setQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState<any[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  const fetchDocuments = async () => {
    try {
      const res = await api.listDocuments(sessionId);
      setDocuments(res.documents || []);
      if (!activeDoc && res.documents?.length > 0) {
        loadDocumentDetails(res.documents[0].id);
      }
    } catch (err: any) {
      console.warn('Could not fetch documents:', err);
    }
  };

  const loadDocumentDetails = async (docId: string) => {
    try {
      const res = await api.getDocument(docId);
      setActiveDoc(res.document);
      setQaHistory(res.questions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load document.');
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [sessionId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const res = await api.uploadMedicalDocument(file, sessionId);
      setActiveDoc(res.document);
      setQaHistory([]);
      await fetchDocuments();
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !activeDoc || isAsking) return;

    setIsAsking(true);
    const qText = question.trim();
    setQuestion('');
    try {
      const res = await api.askDocumentQuestion(activeDoc.id, qText, sessionId);
      setQaHistory((prev) => [...prev, res]);
    } catch (err: any) {
      setError(err.message || 'Failed to answer question.');
    } finally {
      setIsAsking(false);
    }
  };

  const summary = activeDoc?.summary;

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-teal-400" />
            <span>Medical Document Summarizer & Grounded Q&A</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Upload patient information leaflets, package inserts (PIL), or FDA drug monographs for grounded analysis.
          </p>
        </div>

        <label className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0">
          <Upload className="w-4 h-4" />
          <span>Upload PDF / Leaflet</span>
          <input type="file" accept=".pdf,.txt,.doc" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
        </label>
      </div>

      {isUploading && (
        <div className="p-4 bg-[#101720] border border-slate-800 rounded-2xl flex items-center justify-center gap-2 text-xs text-teal-300">
          <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
          <span>Extracting text and synthesizing structured medical summary...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-2xl text-xs text-red-200">
          {error}
        </div>
      )}

      {/* Document Selector Pills if multiple exist */}
      {documents.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] text-slate-500 font-semibold uppercase shrink-0">Uploaded:</span>
          {documents.map((d) => (
            <button
              key={d.id}
              onClick={() => loadDocumentDetails(d.id)}
              className={`text-xs px-3 py-1.5 rounded-xl transition-colors cursor-pointer truncate max-w-[200px] ${
                activeDoc?.id === d.id
                  ? 'bg-teal-950 text-teal-300 border border-teal-700/60 font-semibold'
                  : 'bg-[#101720] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {d.document_title || d.filename}
            </button>
          ))}
        </div>
      )}

      {/* Active Document Summary Card */}
      {summary ? (
        <div className="space-y-6">
          <div className="bg-[#101720] border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] bg-teal-950 text-teal-300 border border-teal-700/60 font-bold px-2 py-0.5 rounded-full uppercase">
                  Grounded Document Summary
                </span>
                <h2 className="text-xl font-bold text-white mt-1">
                  {summary.document_title || activeDoc.filename}
                </h2>
                {summary.medicine_name && (
                  <p className="text-xs text-teal-300 font-semibold mt-0.5">
                    Target Medicine: {summary.medicine_name} {summary.therapeutic_class ? `(${summary.therapeutic_class})` : ''}
                  </p>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Source: {activeDoc.filename}
              </span>
            </div>

            {/* Documented Uses */}
            {summary.documented_uses?.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <span className="font-bold text-white block flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-400" />
                  <span>Documented Indications:</span>
                </span>
                <ul className="space-y-1 text-slate-300 list-disc list-inside pl-1">
                  {summary.documented_uses.map((u: string, i: number) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Dosage Guidance */}
            {summary.dosage_and_administration?.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <span className="font-bold text-white block">Dosage & Administration Guidelines:</span>
                <ul className="space-y-1 text-slate-300 list-disc list-inside pl-1">
                  {summary.dosage_and_administration.map((d: string, i: number) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Adverse Reactions & Contraindications */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              {summary.adverse_effects?.length > 0 && (
                <div className="bg-[#141e2a] border border-slate-700/80 rounded-2xl p-4 space-y-2">
                  <span className="font-bold text-white block">Adverse Reactions:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.adverse_effects.map((ae: any, i: number) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 rounded text-[11px] border ${
                          ae.severity === 'serious'
                            ? 'bg-red-950/40 text-red-200 border-red-600/40'
                            : 'bg-[#101720] text-slate-300 border-slate-700'
                        }`}
                      >
                        {ae.effect || ae}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {summary.contraindications?.length > 0 && (
                <div className="bg-[#141e2a] border border-slate-700/80 rounded-2xl p-4 space-y-2">
                  <span className="font-bold text-white block text-amber-300">Contraindications:</span>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {summary.contraindications.map((c: string, i: number) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Storage */}
            {summary.storage_and_handling && (
              <div className="bg-[#0b1015] border border-slate-800 rounded-xl p-3 text-xs text-slate-300">
                <strong className="text-white">Storage Guidance: </strong>
                {summary.storage_and_handling}
              </div>
            )}
          </div>

          {/* Grounded Document Follow-up Q&A Section */}
          <div className="bg-[#101720] border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <MessageSquare className="w-5 h-5 text-teal-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Ask Questions Grounded in this Document</h3>
                <p className="text-[11px] text-slate-400">
                  Answers are derived strictly from {activeDoc.filename} without external internet extrapolation.
                </p>
              </div>
            </div>

            <form onSubmit={handleAskQuestion} className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={`Ask about ${summary.medicine_name || 'this leaflet'} (e.g. Can it be taken with milk? What are the storage requirements?)...`}
                className="flex-1 py-2.5 px-3.5 text-xs text-white placeholder-slate-500 bg-[#0b1015] border border-slate-800 rounded-xl focus:outline-none focus:border-teal-500"
                disabled={isAsking}
              />
              <button
                type="submit"
                disabled={isAsking || !question.trim()}
                className="bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isAsking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Ask</span>
              </button>
            </form>

            {/* Q&A Thread */}
            {qaHistory.length > 0 && (
              <div className="space-y-3 pt-2">
                {qaHistory.map((qa, i) => (
                  <div key={i} className="bg-[#0b1015] border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
                    <div className="font-semibold text-teal-300">Q: {qa.question}</div>
                    <div className="text-slate-200 leading-relaxed">{qa.answer}</div>
                    {qa.supporting_excerpt && (
                      <div className="bg-[#141e2a] border border-slate-800 p-2 rounded-lg text-[11px] text-slate-400 italic">
                        Excerpt: "{qa.supporting_excerpt}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-[#101720] border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <FileText className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Medical Document Loaded</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Upload an official patient information leaflet or FDA medication guide PDF above to extract structured clinical evidence and perform grounded Q&A.
          </p>
        </div>
      )}
    </div>
  );
};
