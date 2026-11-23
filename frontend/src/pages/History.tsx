import React, { useEffect, useState } from 'react';
import { History as HistoryIcon, Trash2, RefreshCw, Database } from 'lucide-react';
import { SessionHistory } from '../types/medication';
import { api } from '../services/api';
import { HistoryList } from '../components/HistoryList';

interface HistoryProps {
  sessionId: string;
  onSelectRecord: (requestId: string) => void;
  onSelectMedicine: (medName: string) => void;
}

export const History: React.FC<HistoryProps> = ({ sessionId, onSelectRecord, onSelectMedicine }) => {
  const [history, setHistory] = useState<SessionHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSessionHistory(sessionId);
      setHistory(data);
    } catch (err: any) {
      console.error('Failed to fetch history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [sessionId]);

  const handleClear = async () => {
    if (!window.confirm('Clear all research history and Memento memory for this session?')) return;
    setIsClearing(true);
    try {
      await api.clearSessionHistory(sessionId);
      await fetchHistory();
    } catch (err: any) {
      alert(`Clear failed: ${err.message}`);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-sky-500/10 text-sky-300 border border-sky-400/20 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <HistoryIcon className="w-3 h-3 text-sky-400" />
              <span>Memento Memory Session</span>
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Research History & Memory
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Session ID: <span className="text-slate-300 font-semibold">{sessionId}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchHistory}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-white/10 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={isClearing || !history || (history.research_records.length === 0 && history.questions.length === 0)}
            className="inline-flex items-center gap-1.5 bg-red-950/30 hover:bg-red-900/40 text-red-300 text-xs font-semibold px-4 py-2.5 rounded-xl border border-red-500/30 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Memory Status Info Banner */}
      {history?.memento_status && (
        <div className="glass-panel rounded-2xl border border-white/[0.08] p-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-sky-400" />
            <div>
              <span className="font-semibold text-slate-300">Memory Provider: </span>
              <span className="text-slate-400 font-mono">{history.memento_status.provider}</span>
            </div>
          </div>
          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
            history.memento_status.mock ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30' : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
          }`}>
            {history.memento_status.mode}
          </span>
        </div>
      )}

      {/* History List Component */}
      <HistoryList
        history={history}
        onSelectRecord={onSelectRecord}
        onSelectMedicine={onSelectMedicine}
        isLoading={isLoading}
      />
    </div>
  );
};
