import React from 'react';
import { GitCompare, AlertCircle } from 'lucide-react';
import { SourceConflict } from '../types/medication';

interface ConflictNoticeProps {
  conflicts: SourceConflict[];
}

export const ConflictNotice: React.FC<ConflictNoticeProps> = ({ conflicts }) => {
  if (!conflicts || conflicts.length === 0) return null;

  return (
    <div className="bg-amber-950/25 border border-amber-500/30 rounded-2xl p-5 my-4 backdrop-blur-xl shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-5 h-5 text-amber-400" />
        <h4 className="text-sm font-bold text-amber-300 tracking-wide uppercase">
          Source Disagreement & Variation Notice
        </h4>
      </div>
      <p className="text-xs text-amber-200/80 mb-3">
        Retrieved authoritative healthcare sources document differing clinical statements or regulatory variations:
      </p>

      <div className="space-y-3">
        {conflicts.map((conflict, idx) => (
          <div key={idx} className="bg-black/30 border border-amber-500/20 rounded-xl p-3.5">
            <div className="text-xs font-semibold text-amber-200 flex items-center gap-1.5 mb-2">
              <GitCompare className="w-3.5 h-3.5 text-amber-400" />
              <span>Topic: {conflict.topic}</span>
            </div>
            <p className="text-xs text-slate-300 mb-2 italic">{conflict.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {conflict.differing_views.map((view, vIdx) => (
                <div key={vIdx} className="bg-white/[0.03] p-2.5 rounded-lg border border-white/[0.08]">
                  <div className="font-semibold text-amber-300 text-[11px] mb-1">
                    {view.source_title}
                  </div>
                  <div className="text-slate-200">{view.statement}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
