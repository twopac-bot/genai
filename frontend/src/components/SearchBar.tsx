import React, { useState } from 'react';
import { Search, Filter, Activity, Camera } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string, detailLevel: 'simple' | 'standard' | 'detailed') => void;
  onOpenCamera?: () => void;
  isLoading?: boolean;
}

const COMMON_MEDS = [
  { name: 'Metformin', desc: 'Type 2 Diabetes / Biguanide' },
  { name: 'Paracetamol', desc: 'Analgesic & Antipyretic' },
  { name: 'Amoxicillin', desc: 'Penicillin Antibiotic' },
  { name: 'Lisinopril', desc: 'ACE Inhibitor / Blood Pressure' },
  { name: 'Ibuprofen', desc: 'NSAID / Pain & Inflammation' },
  { name: 'Atorvastatin', desc: 'Lipid-Lowering Statin' },
];

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onOpenCamera, isLoading = false }) => {
  const [query, setQuery] = useState('');
  const [detailLevel, setDetailLevel] = useState<'simple' | 'standard' | 'detailed'>('standard');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim(), detailLevel);
  };

  const handleChipClick = (medName: string) => {
    setQuery(medName);
    onSearch(medName, detailLevel);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3.5">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
          {/* Text Input Container with generous padding so text never overlaps */}
          <div className="relative flex-1 flex items-center rounded-2xl bg-[#111923] border border-slate-800 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/50 transition-colors">
            <div className="pl-4 text-slate-400 shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              className="w-full py-3.5 px-3.5 text-slate-100 placeholder-slate-500 text-sm sm:text-base focus:outline-none bg-transparent"
              placeholder="Search generic or brand name (e.g., Metformin, Tylenol)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Action Buttons Row - completely separate from input field */}
          <div className="flex items-center gap-2 shrink-0">
            {onOpenCamera && (
              <button
                type="button"
                onClick={onOpenCamera}
                className="flex-1 sm:flex-none bg-[#131d27] hover:bg-[#1a2634] text-teal-300 font-semibold text-xs sm:text-sm px-4 py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2 border border-slate-700/80 cursor-pointer whitespace-nowrap"
                title="Scan medication using Camera or upload image"
              >
                <Camera className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Camera Scan</span>
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs sm:text-sm px-6 py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <Activity className="w-4 h-4 animate-spin text-white" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 text-white" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Detail level selector */}
        <div className="mt-3 flex items-center justify-between text-xs px-1 text-slate-400">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-medium text-slate-400">Monograph Depth:</span>
            {(['simple', 'standard', 'detailed'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setDetailLevel(lvl)}
                className={`px-3 py-1 rounded-full capitalize font-semibold transition-colors cursor-pointer ${
                  detailLevel === lvl
                    ? 'bg-teal-950 text-teal-300 border border-teal-600/60'
                    : 'bg-[#111923] text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <span className="hidden sm:inline text-[11px] text-slate-500">
            Authoritative Healthcare Sources
          </span>
        </div>
      </form>

      {/* Quick Medication Suggestions */}
      <div className="pt-1">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          Common Clinical Reference Monographs:
        </div>
        <div className="flex flex-wrap gap-2">
          {COMMON_MEDS.map((med) => (
            <button
              key={med.name}
              type="button"
              onClick={() => handleChipClick(med.name)}
              className="group text-left px-3 py-1.5 rounded-xl bg-[#111923] hover:bg-[#16212e] border border-slate-800 hover:border-teal-700/60 transition-colors cursor-pointer"
            >
              <div className="text-xs font-semibold text-slate-200 group-hover:text-teal-300 transition-colors">
                {med.name}
              </div>
              <div className="text-[10px] text-slate-500">{med.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
