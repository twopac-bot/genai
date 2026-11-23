import React, { useState } from 'react';
import { Scale, Activity, Info, ArrowRight } from 'lucide-react';
import { MedicationComparisonResponse } from '../types/medication';
import { api } from '../services/api';
import { SourceCitation } from '../components/SourceCitation';
import { SafetyNotice } from '../components/SafetyNotice';

interface CompareProps {
  initialMedA?: string;
  initialMedB?: string;
  sessionId: string;
}

export const Compare: React.FC<CompareProps> = ({
  initialMedA = 'Paracetamol',
  initialMedB = 'Ibuprofen',
  sessionId,
}) => {
  const [medA, setMedA] = useState(initialMedA);
  const [medB, setMedB] = useState(initialMedB);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<MedicationComparisonResponse | null>(null);

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medA.trim() || !medB.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.compareMedications(medA.trim(), medB.trim(), sessionId);
      setComparison(res);
    } catch (err: any) {
      setError(err.message || 'Failed to compare medications.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 bg-[#111c24] text-teal-300 text-xs font-semibold px-3.5 py-1.5 rounded-full border border-teal-800/60">
          <Scale className="w-3.5 h-3.5 text-teal-400" />
          <span>Evidence-Based Monograph Comparison</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Compare Medications Side-by-Side
        </h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Review documented indications, adverse effects, and precautions side-by-side from authoritative healthcare monographs.
        </p>
      </div>

      {/* Comparison Input Form */}
      <div className="bg-[#101720] rounded-3xl p-6 sm:p-7 border border-slate-800">
        <form onSubmit={handleCompare} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Medicine A
              </label>
              <input
                type="text"
                className="w-full py-3 px-4 text-sm text-white placeholder-slate-500 bg-[#0b1015] border border-slate-700 rounded-2xl focus:outline-none focus:border-teal-500 transition-colors"
                placeholder="e.g. Paracetamol or Tylenol"
                value={medA}
                onChange={(e) => setMedA(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Medicine B
              </label>
              <input
                type="text"
                className="w-full py-3 px-4 text-sm text-white placeholder-slate-500 bg-[#0b1015] border border-slate-700 rounded-2xl focus:outline-none focus:border-teal-500 transition-colors"
                placeholder="e.g. Ibuprofen or Advil"
                value={medB}
                onChange={(e) => setMedB(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <span className="text-xs text-slate-400">
              Evaluates public monographs neutrally without prescribing clinical preference.
            </span>
            <button
              type="submit"
              disabled={isLoading || !medA.trim() || !medB.trim()}
              className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs px-6 py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Monographs...</span>
                </>
              ) : (
                <>
                  <Scale className="w-4 h-4" />
                  <span>Run Comparison</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-3.5 bg-red-950/30 border border-red-500/30 rounded-2xl text-xs text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6">
          {/* Comparison Notes Banner */}
          <div className="bg-[#101720] rounded-3xl p-5 border border-teal-800/50">
            <h3 className="text-xs font-bold text-teal-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-teal-400" />
              <span>Comparative Guidance & Monograph Evidence</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {comparison.comparison_notes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-teal-400 font-bold">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Side by Side Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column A */}
            <div className="bg-[#101720] rounded-3xl p-6 space-y-5 border border-slate-800">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] bg-[#131d27] text-slate-300 font-bold uppercase px-2.5 py-1 rounded-md border border-slate-700">
                  Medicine A
                </span>
                <h3 className="text-2xl font-bold text-white mt-2">
                  {comparison.medicine_a.medicine.display_name}
                </h3>
                <p className="text-xs text-slate-400">
                  {comparison.medicine_a.medicine.generic_name || comparison.medicine_a.medicine.display_name}
                </p>
              </div>

              {/* Overview */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Overview</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {comparison.medicine_a.overview.text}
                  <SourceCitation sourceIds={comparison.medicine_a.overview.source_ids} sources={comparison.medicine_a.sources} />
                </p>
              </div>

              {/* Uses */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Documented Uses</h4>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {comparison.medicine_a.documented_uses.map((u, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-teal-400 font-bold">•</span>
                      <span>{u.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Side effects */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Adverse Reactions</h4>
                <div className="flex flex-wrap gap-1.5">
                  {comparison.medicine_a.side_effects.map((se, i) => (
                    <span key={i} className="bg-[#131d27] border border-slate-700 text-slate-200 text-[11px] px-2.5 py-1 rounded-lg">
                      {se.text}
                    </span>
                  ))}
                </div>
              </div>

              {/* Warnings */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Key Warnings</h4>
                <div className="space-y-1.5 text-xs">
                  {comparison.medicine_a.warnings_and_precautions.slice(0, 3).map((w, i) => (
                    <div key={i} className="p-2.5 bg-amber-950/25 rounded-xl border border-amber-600/30 text-amber-200">
                      {w.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Column B */}
            <div className="bg-[#101720] rounded-3xl p-6 space-y-5 border border-slate-800">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] bg-[#131d27] text-slate-300 font-bold uppercase px-2.5 py-1 rounded-md border border-slate-700">
                  Medicine B
                </span>
                <h3 className="text-2xl font-bold text-white mt-2">
                  {comparison.medicine_b.medicine.display_name}
                </h3>
                <p className="text-xs text-slate-400">
                  {comparison.medicine_b.medicine.generic_name || comparison.medicine_b.medicine.display_name}
                </p>
              </div>

              {/* Overview */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Overview</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {comparison.medicine_b.overview.text}
                  <SourceCitation sourceIds={comparison.medicine_b.overview.source_ids} sources={comparison.medicine_b.sources} />
                </p>
              </div>

              {/* Uses */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Documented Uses</h4>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {comparison.medicine_b.documented_uses.map((u, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-teal-400 font-bold">•</span>
                      <span>{u.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Side effects */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Adverse Reactions</h4>
                <div className="flex flex-wrap gap-1.5">
                  {comparison.medicine_b.side_effects.map((se, i) => (
                    <span key={i} className="bg-[#131d27] border border-slate-700 text-slate-200 text-[11px] px-2.5 py-1 rounded-lg">
                      {se.text}
                    </span>
                  ))}
                </div>
              </div>

              {/* Warnings */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Key Warnings</h4>
                <div className="space-y-1.5 text-xs">
                  {comparison.medicine_b.warnings_and_precautions.slice(0, 3).map((w, i) => (
                    <div key={i} className="p-2.5 bg-amber-950/25 rounded-xl border border-amber-600/30 text-amber-200">
                      {w.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <SafetyNotice type="disclaimer" />
        </div>
      )}
    </div>
  );
};
