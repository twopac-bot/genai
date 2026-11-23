import React, { useState } from 'react';
import { MedicationResearchResponse, FollowUpAnswerResponse, SourceRefreshResponse } from '../types/medication';
import { MedicationSummary } from '../components/MedicationSummary';
import { MessageSquare, Send, Activity, RefreshCw, CheckCircle2, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';

interface ResearchResultProps {
  data: MedicationResearchResponse;
  sessionId: string;
  onBackToSearch: () => void;
  onCompare: (medName: string) => void;
  onUpdateData: (newData: MedicationResearchResponse) => void;
}

export const ResearchResult: React.FC<ResearchResultProps> = ({
  data,
  sessionId,
  onBackToSearch,
  onCompare,
  onUpdateData,
}) => {
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [followUpAnswers, setFollowUpAnswers] = useState<FollowUpAnswerResponse[]>([]);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshModalData, setRefreshModalData] = useState<SourceRefreshResponse | null>(null);

  const handleAskFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isAsking) return;

    setIsAsking(true);
    setFollowUpError(null);
    try {
      const resp = await api.askFollowUp(
        question.trim(),
        data.medicine.display_name,
        sessionId,
        data.request_id
      );
      setFollowUpAnswers((prev) => [resp, ...prev]);
      setQuestion('');
    } catch (err: any) {
      setFollowUpError(err.message || 'Failed to answer follow-up.');
    } finally {
      setIsAsking(false);
    }
  };

  const handleRefreshSources = async () => {
    setIsRefreshing(true);
    try {
      const res = await api.refreshResearch(data.request_id, sessionId);
      setRefreshModalData(res);
      if (res.new_research_record) {
        onUpdateData(res.new_research_record);
      }
    } catch (err: any) {
      alert(`Refresh check failed: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button & Request Meta */}
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToSearch}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#131d27] hover:bg-[#1a2634] border border-slate-700 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Search</span>
        </button>
        <span className="text-[11px] text-slate-500 font-mono">ID: {data.request_id}</span>
      </div>

      {/* Main Medication Monograph */}
      <MedicationSummary
        data={data}
        onRefreshSources={handleRefreshSources}
        onAskFollowUp={() => {
          const el = document.getElementById('follow-up-section');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
        onCompare={onCompare}
        isRefreshing={isRefreshing}
      />

      {/* Freshness Check Modal */}
      {refreshModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#101720] rounded-3xl max-w-lg w-full p-6 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-teal-400" />
              <h3 className="text-base font-bold text-white">Source Freshness & Change Analysis</h3>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed bg-[#0b1015] p-3.5 rounded-2xl border border-slate-800">
              {refreshModalData.change_summary}
            </div>
            {refreshModalData.has_changes ? (
              <div className="text-xs text-amber-200 bg-amber-950/30 p-3 rounded-xl border border-amber-600/30">
                A new version record was automatically created to preserve previous review history.
              </div>
            ) : (
              <div className="text-xs text-teal-300 bg-teal-950/40 p-3 rounded-xl border border-teal-700/60 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400" />
                <span>Original source documents remain identical to previous review.</span>
              </div>
            )}
            <div className="text-right">
              <button
                type="button"
                onClick={() => setRefreshModalData(null)}
                className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Question Section */}
      <div id="follow-up-section" className="max-w-4xl mx-auto bg-[#101720] rounded-3xl p-6 sm:p-7 space-y-4 border border-slate-800">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
          <MessageSquare className="w-5 h-5 text-teal-400" />
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Ask an Educational Follow-up</h3>
            <p className="text-xs text-slate-400">
              Grounded in retrieved {data.medicine.display_name} monographs & Memento session memory.
            </p>
          </div>
        </div>

        {/* Question Form */}
        <form onSubmit={handleAskFollowUp} className="flex gap-2">
          <input
            type="text"
            className="flex-1 py-3 px-4 text-xs sm:text-sm text-slate-100 placeholder-slate-500 bg-[#0b1015] border border-slate-700 rounded-2xl focus:outline-none focus:border-teal-500"
            placeholder={`Ask about ${data.medicine.display_name} (e.g., "Can I take it with food?", "What if I am pregnant?")...`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isAsking}
          />
          <button
            type="submit"
            disabled={isAsking || !question.trim()}
            className="bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs px-5 py-3 rounded-2xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {isAsking ? <Activity className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
            <span>Ask</span>
          </button>
        </form>

        {followUpError && (
          <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-2xl text-xs text-red-300">
            {followUpError}
          </div>
        )}

        {/* List of Follow-up Answers */}
        {followUpAnswers.length > 0 && (
          <div className="space-y-4 pt-3 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Educational Follow-up Answers:
            </h4>
            <div className="space-y-3">
              {followUpAnswers.map((ans, idx) => (
                <div key={idx} className="bg-[#0b1015] border border-slate-800 rounded-2xl p-4.5 space-y-2">
                  <div className="text-xs font-semibold text-teal-300 flex items-start gap-1.5">
                    <span className="font-bold">Q:</span>
                    <span>{ans.question}</span>
                  </div>
                  <div className="text-xs text-slate-200 leading-relaxed font-normal">
                    {ans.answer}
                  </div>
                  {ans.sources.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-400">
                      <span>Sources:</span>
                      <div className="flex flex-wrap gap-1">
                        {ans.sources.map((s, si) => (
                          <a
                            key={si}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#131d27] border border-slate-700 text-teal-300 px-2 py-0.5 rounded text-[10px] hover:text-white transition-colors"
                          >
                            [{s.domain}]
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
