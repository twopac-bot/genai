import React, { useState } from 'react';
import {
  Shield,
  AlertCircle,
  FileText,
  Clock,
  BookOpen,
  Pill,
  RefreshCw,
  MessageSquare,
  Scale,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Database,
  History,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Printer,
} from 'lucide-react';
import { MedicationResearchResponse, SourceSummary } from '../types/medication';
import { SourceCitation } from './SourceCitation';
import { ConflictNotice } from './ConflictNotice';
import { SafetyNotice } from './SafetyNotice';

interface MedicationSummaryProps {
  data: MedicationResearchResponse;
  onRefreshSources?: () => void;
  onAskFollowUp?: (medName: string) => void;
  onCompare?: (medName: string) => void;
  isRefreshing?: boolean;
}

export const MedicationSummary: React.FC<MedicationSummaryProps> = ({
  data,
  onRefreshSources,
  onAskFollowUp,
  onCompare,
  isRefreshing = false,
}) => {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleToggleSpeech = () => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel();
      const textToRead = `${data.medicine.display_name}. Educational Overview: ${data.overview.text}. Key indications: ${data.documented_uses.map(u => u.text).join('. ')}. Key warnings: ${data.warnings_and_precautions.map(w => w.text).join('. ')}.`;
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.rate = 0.95;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatItemText = (text: string) => {
    const colonIdx = text.indexOf(':');
    if (colonIdx > 0 && colonIdx < 30) {
      const prefix = text.substring(0, colonIdx);
      const rest = text.substring(colonIdx + 1);
      return (
        <span>
          <span className="font-bold text-white">{prefix}:</span>
          <span>{rest}</span>
        </span>
      );
    }
    return <span>{text}</span>;
  };

  // If safety warning returned (e.g. overdose / personalized prescription)
  if (data.is_safety_warning) {
    return (
      <div className="max-w-4xl mx-auto my-6">
        <SafetyNotice type="emergency" message={data.safety_guidance || data.overview.text} />
      </div>
    );
  }

  const { medicine, overview, documented_uses, side_effects, warnings_and_precautions, interactions, storage_information, limitations, source_conflicts, sources, memory, reviewed_at } = data;

  const boxedWarnings = warnings_and_precautions.filter((w) =>
    w.text.toLowerCase().includes('boxed warning')
  );
  const generalWarnings = warnings_and_precautions.filter(
    (w) => !w.text.toLowerCase().includes('boxed warning')
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Monograph Header Card */}
      <div className="bg-[#101720] rounded-3xl p-6 sm:p-7 border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-teal-950 text-teal-300 border border-teal-700/60 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Pill className="w-3 h-3 text-teal-400" />
                <span>Clinical Educational Monograph</span>
              </span>
              {medicine.jurisdiction && (
                <span className="bg-[#131d27] text-slate-300 border border-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                  Jurisdiction: {medicine.jurisdiction}
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              {medicine.display_name}
            </h1>
            {medicine.generic_name && medicine.generic_name !== medicine.display_name && (
              <p className="text-xs text-slate-400 font-medium">
                Generic Active Ingredient: <span className="text-teal-300 font-semibold">{medicine.generic_name}</span>
              </p>
            )}
            {medicine.brand_name && (
              <p className="text-xs text-slate-400">
                Documented Brands / Trade: <span className="text-slate-200">{medicine.brand_name}</span>
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSpeech}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors border cursor-pointer ${
                isSpeaking
                  ? 'bg-amber-950 text-amber-300 border-amber-600/40'
                  : 'bg-[#131d27] hover:bg-[#1a2634] text-slate-300 border-slate-700'
              }`}
              title="Listen to audio overview"
            >
              {isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-amber-400" /> : <Volume2 className="w-3.5 h-3.5 text-teal-400" />}
              <span>{isSpeaking ? 'Stop Audio' : 'Read Aloud'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-[#131d27] hover:bg-[#1a2634] text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              title="Print or Save PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Print / PDF</span>
            </button>

            {onRefreshSources && (
              <button
                type="button"
                onClick={onRefreshSources}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 bg-[#131d27] hover:bg-[#1a2634] text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                title="Verify if published source content has changed."
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-teal-400' : 'text-slate-400'}`} />
                <span>{isRefreshing ? 'Checking...' : 'Check Freshness'}</span>
              </button>
            )}

            {onAskFollowUp && (
              <button
                type="button"
                onClick={() => onAskFollowUp(medicine.display_name)}
                className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Ask Question</span>
              </button>
            )}

            {onCompare && (
              <button
                type="button"
                onClick={() => onCompare(medicine.display_name)}
                className="inline-flex items-center gap-1.5 bg-[#131d27] hover:bg-[#1a2634] text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5 text-teal-400" />
                <span>Compare</span>
              </button>
            )}
          </div>
        </div>

        {/* Reviewed date and memory badge */}
        <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Reviewed: <strong className="text-slate-200">{new Date(reviewed_at).toLocaleDateString()}</strong></span>
          </div>

          {memory && memory.used_previous_context && (
            <div className="flex items-center gap-1.5 text-teal-300 bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-800/60 text-[11px]">
              <History className="w-3 h-3 text-teal-400" />
              <span>Grounded with Memento topic memory</span>
            </div>
          )}
        </div>
      </div>

      {/* Disagreement / Conflict Notice */}
      <ConflictNotice conflicts={source_conflicts} />

      {/* Regulatory Boxed Warning */}
      {boxedWarnings.length > 0 && (
        <div className="bg-red-950/25 border border-red-600/40 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <h3 className="text-xs font-black text-red-200 tracking-wider uppercase">
              Regulatory Boxed Warning (Black Box Alert)
            </h3>
          </div>
          <div className="space-y-2.5">
            {boxedWarnings.map((bw, idx) => (
              <div key={idx} className="text-xs text-red-200 font-medium leading-relaxed bg-black/40 p-3.5 rounded-2xl border border-red-500/20">
                {bw.text}
                <SourceCitation sourceIds={bw.source_ids} sources={sources} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 1: Overview */}
      <div className="bg-[#101720] rounded-3xl p-6 space-y-3 border border-slate-800">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-teal-400" />
          <span>Educational Overview</span>
        </h2>
        <p className="text-sm text-slate-200 leading-relaxed font-normal">
          {overview.text}
          <SourceCitation sourceIds={overview.source_ids} sources={sources} />
        </p>
      </div>

      {/* Section 2: Documented Indications & Uses */}
      <div className="bg-[#101720] rounded-3xl p-6 space-y-3 border border-slate-800">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-400" />
          <span>Documented Indications & Clinical Uses</span>
        </h2>
        {documented_uses.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No specific indication texts extracted in available excerpts.</p>
        ) : (
          <ul className="space-y-2.5">
            {documented_uses.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 flex-shrink-0" />
                <div>
                  {formatItemText(item.text)}
                  <SourceCitation sourceIds={item.source_ids} sources={sources} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Section 3: Adverse Effects & Side Effects */}
      <div className="bg-[#101720] rounded-3xl p-6 space-y-3 border border-slate-800">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span>Reported Adverse Reactions & Side Effects</span>
        </h2>
        {side_effects.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No specific adverse effects recorded in retrieved excerpts.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {side_effects.map((item, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
                  item.classification === 'serious'
                    ? 'bg-red-950/20 border-red-500/30 text-red-200'
                    : 'bg-[#131d27] border-slate-800 text-slate-200'
                }`}
              >
                <span className="font-medium">{formatItemText(item.text)}</span>
                <SourceCitation sourceIds={item.source_ids} sources={sources} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 4: General Warnings & Precautions */}
      {generalWarnings.length > 0 && (
        <div className="bg-[#101720] rounded-3xl p-6 space-y-3 border border-slate-800">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-400" />
            <span>Precautions & Special Considerations</span>
          </h2>
          <ul className="space-y-2.5">
            {generalWarnings.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 flex-shrink-0" />
                <div>
                  {formatItemText(item.text)}
                  <SourceCitation sourceIds={item.source_ids} sources={sources} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 5: Notable Interactions & Storage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Interactions */}
        <div className="bg-[#101720] rounded-3xl p-6 space-y-3 border border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-300" />
            <span>Notable Drug & Food Interactions</span>
          </h3>
          {interactions.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              Specific drug interaction tables were not detailed in the extracted excerpts.
            </p>
          ) : (
            <div className="space-y-2.5 text-xs text-slate-200">
              {interactions.map((inter, idx) => (
                <div key={idx} className="p-3 bg-[#131d27] border border-slate-700 rounded-2xl text-slate-200">
                  {formatItemText(inter.text)}
                  <SourceCitation sourceIds={inter.source_ids} sources={sources} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Storage */}
        <div className="bg-[#101720] rounded-3xl p-6 space-y-3 border border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-teal-400" />
            <span>Storage & Handling</span>
          </h3>
          {storage_information ? (
            <div className="text-xs text-slate-200 leading-relaxed p-3 bg-[#131d27] rounded-2xl border border-slate-800">
              {storage_information.text}
              <SourceCitation sourceIds={storage_information.source_ids} sources={sources} />
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              Storage instructions not explicitly detailed in the retrieved source pages. Follow original pharmacy packaging label.
            </p>
          )}
        </div>
      </div>

      {/* Section 6: Authoritative Sources Audit Table */}
      <div className="bg-[#101720] rounded-3xl overflow-hidden border border-slate-800">
        <button
          type="button"
          onClick={() => setSourcesExpanded(!sourcesExpanded)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[#141e2a] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-bold text-white">
              Verified Public Healthcare Sources ({sources.length})
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span>{sourcesExpanded ? 'Collapse' : 'Inspect Audit Sources'}</span>
            {sourcesExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {sourcesExpanded && (
          <div className="p-6 pt-0 space-y-3 border-t border-slate-800">
            <div className="divide-y divide-slate-800 text-xs">
              {sources.map((src, i) => (
                <div key={src.source_id || i} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 font-bold">[{src.source_id || i + 1}]</span>
                      <span className="font-bold text-white">{src.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                      <span>{src.domain}</span>
                      <span>•</span>
                      <span>Retrieved: {new Date(src.retrieved_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 font-semibold"
                  >
                    <span>Inspect Source</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 7: Limitations & Evidence Boundaries */}
      {limitations.length > 0 && (
        <div className="bg-[#101720] rounded-3xl p-6 border border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-300">
            <AlertCircle className="w-4 h-4 text-slate-400" />
            <span>Evidence Boundaries & Missing Information:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1">
            {limitations.map((lim, idx) => (
              <li key={idx}>{lim}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Mandatory Clinical Disclaimer */}
      <SafetyNotice type="disclaimer" />
    </div>
  );
};
