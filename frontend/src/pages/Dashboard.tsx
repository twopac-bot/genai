import React from 'react';
import {
  Camera,
  Layers,
  FileText,
  Mic,
  Network,
  Clock,
  Scale,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

interface DashboardProps {
  onNavigateTab: (tab: string) => void;
  onInitiateCompare?: (medA: string, medB: string) => void;
  cabinetExpiringCount?: number;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateTab,
  onInitiateCompare,
  cabinetExpiringCount = 0,
}) => {
  const POPULAR_COMPARISONS = [
    { a: 'Ibuprofen', b: 'Paracetamol', tag: 'NSAID vs Analgesic' },
    { a: 'Cetirizine', b: 'Loratadine', tag: '2nd Gen Antihistamines' },
    { a: 'Metformin', b: 'Glipizide', tag: 'Type 2 Diabetes' },
    { a: 'Omeprazole', b: 'Famotidine', tag: 'Acid Reducers (PPI vs H2)' },
  ];

  const CORE_MODULES = [
    {
      id: 'scanner',
      title: 'Medicine Packaging Scanner',
      desc: 'Scan strips, bottles, boxes, or labels with Gemini Vision to extract batch, mfg, expiry dates, and official monographs.',
      icon: Camera,
      tag: 'Multimodal Vision',
      accent: 'border-teal-500/30 hover:border-teal-500/60',
      badgeColor: 'text-teal-400 bg-teal-950/60',
    },
    {
      id: 'interactions',
      title: 'Drug Interaction Explorer',
      desc: 'Check 2+ medications simultaneously for pairwise clinical interactions, food/alcohol risks, and severity levels.',
      icon: Layers,
      tag: 'Multi-Drug Safety',
      accent: 'border-emerald-500/30 hover:border-emerald-500/60',
      badgeColor: 'text-emerald-400 bg-emerald-950/60',
    },
    {
      id: 'assistant',
      title: 'Medical Document Analyzer & Q&A',
      desc: 'Attach medication leaflets or prescription PDFs directly in chat for grounded clinical extraction and instant follow-up inquiries.',
      icon: FileText,
      tag: 'In-Chat Document Q&A',
      accent: 'border-cyan-500/30 hover:border-cyan-500/60',
      badgeColor: 'text-cyan-400 bg-cyan-950/60',
    },
    {
      id: 'assistant',
      title: 'Voice Medication Assistant',
      desc: 'Hands-free conversational voice chat with an animated glowing orb and speech recognition in English, Hindi, and Telugu.',
      icon: Mic,
      tag: 'Hands-Free Voice Chat',
      accent: 'border-sky-500/30 hover:border-sky-500/60',
      badgeColor: 'text-sky-400 bg-sky-950/60',
    },
    {
      id: 'graph',
      title: 'Medication Knowledge Graph',
      desc: 'Interactive SVG node-edge network mapping medicines to active ingredients, documented uses, adverse effects, and precautions.',
      icon: Network,
      tag: 'Interactive Network',
      accent: 'border-teal-500/30 hover:border-teal-500/60',
      badgeColor: 'text-teal-400 bg-teal-950/60',
    },
    {
      id: 'cabinet',
      title: 'Medicine Expiry Tracker',
      desc: 'Track home medicine cabinet shelf-life with automatic countdown days, critical expiry warnings, and packaging records.',
      icon: Clock,
      tag: 'Cabinet Management',
      accent: 'border-amber-500/30 hover:border-amber-500/60',
      badgeColor: 'text-amber-400 bg-amber-950/60',
      alertBadge: cabinetExpiringCount > 0 ? `${cabinetExpiringCount} Expiring Soon` : undefined,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      {/* Clinical Hero Header */}
      <div className="bg-[#101720] border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 bg-[#131d27] text-teal-300 text-xs font-semibold px-3.5 py-1.5 rounded-full border border-teal-800/60">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Authoritative Medication Intelligence Platform</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Comprehensive drug safety, packaging analysis & clinical evidence.
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Synthesized directly from verified public healthcare authorities (FDA, MedlinePlus, DailyMed, NHS) with Gemini multimodal vision and strict evidence boundaries.
          </p>

          <div className="pt-2 flex flex-wrap gap-2.5">
            <button
              onClick={() => onNavigateTab('assistant')}
              className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>Launch AI Search Assistant</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigateTab('scanner')}
              className="px-4 py-2.5 rounded-xl bg-[#16212e] hover:bg-slate-800 text-slate-200 font-bold text-xs border border-slate-700/80 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-teal-400" />
              <span>Scan Medicine Packaging</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6 Core Functional Modules Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span>Core Platform Modules</span>
          </h2>
          <span className="text-xs text-slate-500">All tools integrated & live</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CORE_MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <div
                key={module.id}
                onClick={() => onNavigateTab(module.id)}
                className={`bg-[#101720] hover:bg-[#131d27] border rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between group ${module.accent}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${module.badgeColor}`}>
                      {module.tag}
                    </span>
                    {module.alertBadge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        {module.alertBadge}
                      </span>
                    )}
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#141f2b] border border-slate-800 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors">
                        {module.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                    {module.desc}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-teal-300 transition-colors">
                  <span>Open Tool</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Popular Monograph Comparisons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 text-xs font-bold uppercase tracking-wider">
            <Scale className="w-4 h-4 text-teal-400" />
            <span>Rapid Monograph Comparisons</span>
          </div>
          <span className="text-xs text-slate-500">FDA & MedlinePlus validated</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {POPULAR_COMPARISONS.map((comp, idx) => (
            <div
              key={idx}
              onClick={() => {
                if (onInitiateCompare) {
                  onInitiateCompare(comp.a, comp.b);
                } else {
                  onNavigateTab('compare');
                }
              }}
              className="bg-[#101720] hover:bg-[#141e2a] rounded-xl p-3.5 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors group flex flex-col justify-between"
            >
              <div className="text-[11px] font-semibold text-teal-400 mb-1">{comp.tag}</div>
              <div className="text-xs font-bold text-white group-hover:text-teal-300 transition-colors flex items-center gap-1.5">
                <span>{comp.a}</span>
                <span className="text-slate-500 font-normal">vs</span>
                <span>{comp.b}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Clinical Disclaimer Notice */}
      <div className="p-3.5 bg-[#0e1620] border border-slate-800/80 rounded-xl flex items-center gap-3 text-xs text-slate-400">
        <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
        <span>
          Educational platform only. DrugInfo AI never diagnoses, prescribes, or adjusts treatment regimens. Always consult qualified healthcare providers before altering medications.
        </span>
      </div>
    </div>
  );
};
