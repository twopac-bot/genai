import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Shield, Server, Key, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface SettingsProps {
  sessionId: string;
  onUpdateSessionId: (newId: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ sessionId, onUpdateSessionId }) => {
  const [inputSession, setInputSession] = useState(sessionId);
  const [healthData, setHealthData] = useState<any>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  const fetchHealth = async () => {
    setIsLoadingHealth(true);
    try {
      const data = await api.getHealth();
      setHealthData(data);
    } catch (err) {
      console.error('Failed to load health:', err);
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSession.trim()) return;
    onUpdateSessionId(inputSession.trim());
    alert(`Active session switched to: ${inputSession.trim()}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      {/* Title */}
      <div className="border-b border-white/[0.08] pb-5">
        <div className="flex items-center gap-2 mb-2 text-sky-400 text-xs font-semibold uppercase tracking-wider">
          <SettingsIcon className="w-3.5 h-3.5" />
          <span>System Configuration & Privacy</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Settings & Environment Status
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Inspect backend service integrations, privacy safeguards, and manage session identifiers.
        </p>
      </div>

      {/* Session Management */}
      <div className="glass-panel rounded-3xl border border-white/[0.08] shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/20 text-sky-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Session Isolation & Opaque User Key</h3>
            <p className="text-xs text-slate-400">
              Each session maintains strictly isolated Memento memory and research history.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSession} className="flex gap-2">
          <input
            type="text"
            className="flex-1 py-2.5 px-3.5 text-xs font-mono text-white placeholder-slate-500 bg-white/[0.04] border border-white/10 rounded-2xl focus:outline-none focus:border-sky-500/60"
            value={inputSession}
            onChange={(e) => setInputSession(e.target.value)}
            placeholder="Enter opaque session ID..."
          />
          <button
            type="submit"
            className="bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold px-5 py-2.5 rounded-2xl transition-all cursor-pointer"
          >
            Apply Session
          </button>
        </form>
      </div>

      {/* Live Service Status */}
      <div className="glass-panel rounded-3xl border border-white/[0.08] shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/20 text-sky-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Live vs Mock Adapter Status</h3>
              <p className="text-xs text-slate-400">
                Transparent verification of all backend integration providers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchHealth}
            disabled={isLoadingHealth}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all cursor-pointer"
            title="Refresh Health"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingHealth ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {healthData?.services ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Firecrawl */}
            <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06] text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">Firecrawl Web Retrieval</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  healthData.services.firecrawl.mock ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30' : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {healthData.services.firecrawl.mode.toUpperCase()}
                </span>
              </div>
              <div className="text-slate-400 font-mono text-[11px] truncate">
                Provider: {healthData.services.firecrawl.provider}
              </div>
              {healthData.services.firecrawl.notice && (
                <div className="text-[11px] text-slate-500 italic">
                  {healthData.services.firecrawl.notice}
                </div>
              )}
            </div>

            {/* Memento */}
            <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06] text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">Memento Memory</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  healthData.services.memento.mock ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30' : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {healthData.services.memento.mode.toUpperCase()}
                </span>
              </div>
              <div className="text-slate-400 font-mono text-[11px] truncate">
                Provider: {healthData.services.memento.provider}
              </div>
              {healthData.services.memento.notice && (
                <div className="text-[11px] text-slate-500 italic">
                  {healthData.services.memento.notice}
                </div>
              )}
            </div>

            {/* LLM */}
            <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06] text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">Gemini LLM Engine</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  healthData.services.llm.mock ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30' : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {healthData.services.llm.mode.toUpperCase()}
                </span>
              </div>
              <div className="text-slate-400 font-mono text-[11px] truncate">
                Provider: {healthData.services.llm.provider}
              </div>
            </div>

            {/* Database */}
            <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06] text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">Application Database</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
                  CONNECTED
                </span>
              </div>
              <div className="text-slate-400 font-mono text-[11px] truncate">
                Storage: {healthData.services.database.url}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 py-4 text-center">Loading adapter statuses...</div>
        )}
      </div>

      {/* Privacy & Safety Policies */}
      <div className="glass-panel rounded-3xl border border-white/[0.08] shadow-xl p-6 space-y-3 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Privacy & Healthcare Compliance Policy</span>
        </div>
        <p className="leading-relaxed">
          1. <strong className="text-slate-200">No Personal Health Information (PHI):</strong> DrugInfo AI does not request, log, or store identifiable personal medical records, health conditions, or diagnostic charts.
        </p>
        <p className="leading-relaxed">
          2. <strong className="text-slate-200">Opaque Memory Scoping:</strong> All topic memories stored in Memento are scoped strictly to the current session identifier and are never exposed across different sessions or users.
        </p>
        <p className="leading-relaxed">
          3. <strong className="text-slate-200">Data Erasure:</strong> Users can delete all session topic memories and research history at any time from the History page.
        </p>
      </div>
    </div>
  );
};
