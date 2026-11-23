import React, { useState } from 'react';
import {
  Scale,
  Plus,
  Trash2,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Info,
  ExternalLink,
  Coffee,
  UserCheck,
} from 'lucide-react';
import { api } from '../services/api';

interface InteractionExplorerPageProps {
  sessionId: string;
}

export const InteractionExplorerPage: React.FC<InteractionExplorerPageProps> = ({ sessionId }) => {
  const [medicines, setMedicines] = useState<string[]>(['Ibuprofen', 'Paracetamol']);
  const [newMedInput, setNewMedInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interactionResult, setInteractionResult] = useState<any>(null);

  const handleAddMedicine = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newMedInput.trim();
    if (!clean) return;
    if (medicines.some((m) => m.toLowerCase() === clean.toLowerCase())) {
      setNewMedInput('');
      return;
    }
    setMedicines([...medicines, clean]);
    setNewMedInput('');
  };

  const handleRemoveMedicine = (index: number) => {
    if (medicines.length <= 2) {
      alert('At least two medicines are required for interaction analysis.');
      return;
    }
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const handleCheckInteractions = async () => {
    if (medicines.length < 2 || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.analyzeMultiDrugInteractions(medicines, sessionId);
      setInteractionResult(res.interaction_analysis);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze interactions.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case 'major':
      case 'contraindicated':
        return 'bg-red-950/40 text-red-300 border-red-600/40';
      case 'moderate':
        return 'bg-amber-950/40 text-amber-300 border-amber-600/40';
      default:
        return 'bg-teal-950 text-teal-300 border-teal-700/60';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Scale className="w-6 h-6 text-teal-400" />
          <span>Multi-Drug Interaction Explorer</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Evaluate documented pharmacokinetic and pharmacodynamic interactions across two or more concurrent medications.
        </p>
      </div>

      {/* Medication Chips & Input Container */}
      <div className="bg-[#101720] border border-slate-800 rounded-3xl p-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
            Medications in Regimen ({medicines.length}):
          </label>
          <div className="flex flex-wrap gap-2">
            {medicines.map((med, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-2 bg-[#141e2a] border border-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl"
              >
                <span>{med}</span>
                {medicines.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMedicine(idx)}
                    className="text-slate-400 hover:text-red-400 cursor-pointer"
                    title="Remove medicine"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Add another medicine input form */}
        <form onSubmit={handleAddMedicine} className="flex gap-2">
          <input
            type="text"
            value={newMedInput}
            onChange={(e) => setNewMedInput(e.target.value)}
            placeholder="Add another medicine (e.g. Aspirin, Warfarin, Metformin)..."
            className="flex-1 py-2.5 px-3.5 text-xs text-white placeholder-slate-500 bg-[#0b1015] border border-slate-800 rounded-xl focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            disabled={!newMedInput.trim()}
            className="bg-[#141e2a] hover:bg-[#1a2634] disabled:opacity-50 text-teal-300 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </form>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
          <span className="text-[11px] text-slate-400">
            Synthesizes pairwise interactions and food warnings from authoritative healthcare monographs.
          </span>
          <button
            type="button"
            onClick={handleCheckInteractions}
            disabled={isLoading || medicines.length < 2}
            className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 text-white font-bold text-xs px-6 py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                <span>Evaluating Interactions...</span>
              </>
            ) : (
              <>
                <Scale className="w-4 h-4" />
                <span>Check Interactions</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-2xl text-xs text-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Interaction Results View */}
      {interactionResult && (
        <div className="space-y-5">
          {/* Executive Synthesis Banner */}
          <div className="bg-[#101720] border border-slate-800 rounded-3xl p-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-teal-400" />
                <h2 className="text-base font-bold text-white">Interaction Analysis Summary</h2>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRiskBadge(interactionResult.overall_risk_level)}`}>
                Overall Risk: {interactionResult.overall_risk_level}
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {interactionResult.summary}
            </p>
          </div>

          {/* Pairwise Interactions Grid */}
          {interactionResult.pairwise_interactions?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Pairwise Clinical Interactions ({interactionResult.pairwise_interactions.length}):
              </h3>
              <div className="space-y-3">
                {interactionResult.pairwise_interactions.map((p: any, i: number) => (
                  <div key={i} className="bg-[#101720] border border-slate-800 rounded-2xl p-5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">
                        {p.drug_a} + {p.drug_b}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getRiskBadge(p.severity)}`}>
                        {p.severity} Severity
                      </span>
                    </div>
                    {p.mechanism && (
                      <div className="text-xs text-slate-300">
                        <strong className="text-slate-100">Mechanism: </strong>{p.mechanism}
                      </div>
                    )}
                    {p.documented_effects && (
                      <div className="text-xs text-slate-300">
                        <strong className="text-slate-100">Documented Effects: </strong>{p.documented_effects}
                      </div>
                    )}
                    {p.management_guidance && (
                      <div className="text-xs text-teal-300 bg-[#141e2a] p-2.5 rounded-xl border border-slate-700">
                        <strong>Management: </strong>{p.management_guidance}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Food and Substance Interactions */}
          {interactionResult.food_and_substance_interactions?.length > 0 && (
            <div className="bg-[#101720] border border-slate-800 rounded-3xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Coffee className="w-4 h-4 text-teal-400" />
                <span>Dietary, Alcohol & Food Precautions</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {interactionResult.food_and_substance_interactions.map((f: any, i: number) => (
                  <div key={i} className="bg-[#141e2a] border border-slate-700/80 rounded-xl p-3 space-y-1">
                    <span className="font-bold text-white block">{f.medicine} + {f.substance}</span>
                    <p className="text-slate-300 text-[11px]">{f.effect}</p>
                    <p className="text-teal-300 text-[11px] font-medium">{f.guidance}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* High Risk Populations & Limitations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {interactionResult.high_risk_populations?.length > 0 && (
              <div className="bg-[#101720] border border-slate-800 rounded-2xl p-4 space-y-2">
                <span className="font-bold text-white block flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-teal-400" />
                  <span>Vulnerable Populations:</span>
                </span>
                <ul className="space-y-1 text-slate-300 list-disc list-inside">
                  {interactionResult.high_risk_populations.map((h: string, i: number) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            )}

            {interactionResult.limitations_and_uncertainties?.length > 0 && (
              <div className="bg-[#101720] border border-slate-800 rounded-2xl p-4 space-y-2">
                <span className="font-bold text-white block flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Evidence Limitations:</span>
                </span>
                <ul className="space-y-1 text-slate-400 list-disc list-inside">
                  {interactionResult.limitations_and_uncertainties.map((lim: string, i: number) => (
                    <li key={i}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sources and Disclaimer */}
          <div className="p-4 bg-black/40 border border-slate-800 rounded-2xl text-[11px] text-slate-400 leading-relaxed">
            <strong>Clinical Notice:</strong> {interactionResult.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
};
