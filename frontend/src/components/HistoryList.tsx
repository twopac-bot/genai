import React from 'react';
import { Clock, BookOpen, MessageSquare, ChevronRight, History } from 'lucide-react';
import { SessionHistory } from '../types/medication';

interface HistoryListProps {
  history: SessionHistory | null;
  onSelectRecord: (requestId: string) => void;
  onSelectMedicine: (medName: string) => void;
  isLoading?: boolean;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  history,
  onSelectRecord,
  onSelectMedicine,
  isLoading = false,
}) => {
  if (isLoading) {
    return <div className="text-center py-8 text-sm text-slate-400">Loading topic history...</div>;
  }

  if (!history || (history.research_records.length === 0 && history.questions.length === 0)) {
    return (
      <div className="glass-panel rounded-3xl p-10 border border-white/[0.08] text-center shadow-xl">
        <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h4 className="text-base font-bold text-white">No Research History Yet</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
          Searched medication monographs and questions in this session will be preserved in your Memento topic memory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Researched Medications */}
      {history.research_records.length > 0 && (
        <div className="glass-panel rounded-3xl border border-white/[0.08] shadow-xl p-5 sm:p-6">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-400" />
            <span>Researched Medications ({history.research_records.length})</span>
          </h3>
          <div className="divide-y divide-white/[0.06]">
            {history.research_records.map((rec) => (
              <div
                key={rec.request_id}
                onClick={() => onSelectRecord(rec.request_id)}
                className="py-3.5 px-3 flex items-center justify-between hover:bg-white/[0.04] rounded-2xl cursor-pointer transition-all group"
              >
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors flex items-center gap-2">
                    <span>{rec.medicine_name}</span>
                    {rec.version > 1 && (
                      <span className="text-[10px] bg-sky-500/10 text-sky-300 border border-sky-400/20 px-2 py-0.5 rounded-md font-mono">
                        v{rec.version}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 line-clamp-1">{rec.summary_overview}</div>
                  <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5 font-mono">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{new Date(rec.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-300 group-hover:translate-x-1 transition-all" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prior Educational Inquiries */}
      {history.questions.length > 0 && (
        <div className="glass-panel rounded-3xl border border-white/[0.08] shadow-xl p-5 sm:p-6">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-sky-400" />
            <span>Recent Follow-up Questions ({history.questions.length})</span>
          </h3>
          <div className="divide-y divide-white/[0.06]">
            {history.questions.map((q) => (
              <div
                key={q.id}
                onClick={() => onSelectMedicine(q.medicine_name)}
                className="py-3.5 px-3 flex items-center justify-between hover:bg-white/[0.04] rounded-2xl cursor-pointer transition-all group"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-sky-300 transition-colors">
                    Q: {q.question}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 line-clamp-1 italic">
                    {q.answer_preview}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1.5 font-mono">
                    Topic: <span className="text-slate-300 font-semibold">{q.medicine_name}</span> • {new Date(q.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-300 group-hover:translate-x-1 transition-all" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
