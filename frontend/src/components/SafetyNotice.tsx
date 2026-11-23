import React from 'react';
import { ShieldAlert, Info, PhoneCall } from 'lucide-react';

interface SafetyNoticeProps {
  type?: 'banner' | 'emergency' | 'disclaimer';
  message?: string | null;
}

export const SafetyNotice: React.FC<SafetyNoticeProps> = ({ type = 'banner', message }) => {
  if (type === 'emergency' && message) {
    return (
      <div className="bg-red-950/40 border border-red-500/40 p-5 rounded-2xl shadow-xl mb-6 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-6 w-6 text-red-400 shrink-0" />
          <div className="space-y-2">
            <h3 className="text-sm font-extrabold text-red-200 uppercase tracking-wider flex items-center gap-2">
              <PhoneCall className="h-4 w-4" /> Urgent Clinical Alert
            </h3>
            <div className="text-xs text-red-300 font-medium whitespace-pre-line leading-relaxed">
              {message}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'disclaimer') {
    return (
      <div className="glass-card rounded-2xl p-4 text-xs text-slate-400 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-slate-300">Educational Reference Notice:</span> Information synthesized from published public regulatory monographs. Not medical advice, diagnosis, or personalized dosing guidance. Consult a healthcare provider for clinical decisions.
        </div>
      </div>
    );
  }

  return null;
};
