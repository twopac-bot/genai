import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { SourceSummary } from '../types/medication';

interface SourceCitationProps {
  sourceIds: string[];
  sources: SourceSummary[];
  onClickSource?: (source: SourceSummary) => void;
}

export const SourceCitation: React.FC<SourceCitationProps> = ({ sourceIds, sources, onClickSource }) => {
  if (!sourceIds || sourceIds.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 ml-1.5 align-baseline">
      {sourceIds.map((id, index) => {
        const found = sources.find((s) => s.source_id === id);
        const label = found ? found.domain.replace('www.', '') : id;
        const url = found?.url;

        return (
          <span
            key={id + index}
            className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md cursor-pointer transition-colors bg-teal-950 text-teal-300 hover:bg-teal-900 hover:text-teal-200 border border-teal-800/70"
            title={`${found?.title || id} (${found?.source_type || 'Source'})`}
            onClick={() => {
              if (onClickSource && found) {
                onClickSource(found);
              } else if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
              }
            }}
          >
            <ShieldCheck className="w-2.5 h-2.5 text-teal-400" />
            <span>[{label}]</span>
            {url && <ExternalLink className="w-2 h-2 opacity-70" />}
          </span>
        );
      })}
    </span>
  );
};
