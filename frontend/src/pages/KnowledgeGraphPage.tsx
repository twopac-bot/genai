import React, { useState, useEffect } from 'react';
import {
  Share2,
  RefreshCw,
  Search,
  CheckCircle2,
  Shield,
  AlertTriangle,
  BookOpen,
  Info,
} from 'lucide-react';
import { api } from '../services/api';

interface KnowledgeGraphPageProps {
  sessionId: string;
  initialMedicine?: string;
}

export const KnowledgeGraphPage: React.FC<KnowledgeGraphPageProps> = ({
  sessionId,
  initialMedicine = 'Ibuprofen',
}) => {
  const [medicineQuery, setMedicineQuery] = useState(initialMedicine);
  const [graphData, setGraphData] = useState<any | null>(null);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKnowledgeGraph = async (medName: string) => {
    setIsLoading(true);
    setError(null);
    setSelectedNode(null);
    try {
      // First ensure a research record exists or conduct research
      const research = await api.conductResearch(medName, undefined, sessionId);
      const res = await api.getKnowledgeGraph(research.request_id);
      setGraphData(res.graph);
    } catch (err: any) {
      setError(err.message || 'Failed to construct knowledge graph.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (medicineQuery) {
      fetchKnowledgeGraph(medicineQuery);
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicineQuery.trim()) return;
    fetchKnowledgeGraph(medicineQuery.trim());
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'medicine':
        return '#0d9488'; // Teal
      case 'ingredient':
        return '#0284c7'; // Sky
      case 'indication':
        return '#10b981'; // Emerald
      case 'side_effect':
        return '#f59e0b'; // Amber
      case 'warning':
        return '#ef4444'; // Red
      case 'interaction':
        return '#8b5cf6'; // Purple
      case 'source':
        return '#64748b'; // Slate
      default:
        return '#475569';
    }
  };

  const filteredNodes = graphData?.nodes?.filter((n: any) => {
    if (filterType === 'all') return true;
    return n.type === filterType;
  }) || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      {/* Header & Search Bar */}
      <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Share2 className="w-6 h-6 text-teal-400" />
            <span>Medication Knowledge Graph</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visual relationship network linking active ingredients, documented clinical indications, side effects, precautions, and sources.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="text"
            value={medicineQuery}
            onChange={(e) => setMedicineQuery(e.target.value)}
            placeholder="Explore medicine (e.g. Metformin, Cetirizine)..."
            className="py-2 px-3 text-xs text-white placeholder-slate-500 bg-[#101720] border border-slate-700 rounded-xl focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Graph</span>
          </button>
        </form>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500 font-semibold uppercase text-[10px]">Filter Nodes:</span>
        {[
          { id: 'all', label: 'All Entities' },
          { id: 'ingredient', label: 'Ingredients' },
          { id: 'indication', label: 'Indications' },
          { id: 'side_effect', label: 'Side Effects' },
          { id: 'warning', label: 'Precautions' },
          { id: 'interaction', label: 'Interactions' },
          { id: 'source', label: 'Sources' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilterType(f.id)}
            className={`px-3 py-1 rounded-xl transition-colors cursor-pointer ${
              filterType === f.id
                ? 'bg-teal-600 text-white font-semibold'
                : 'bg-[#101720] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-2xl text-xs text-red-200">
          {error}
        </div>
      )}

      {/* Interactive SVG Graph Visualization */}
      <div className="bg-[#101720] border border-slate-800 rounded-3xl p-6 relative overflow-hidden min-h-[460px] flex flex-col justify-between">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-2 py-24 text-teal-300 text-xs">
            <RefreshCw className="w-8 h-8 animate-spin text-teal-400" />
            <span>Generating evidence-backed graph nodes...</span>
          </div>
        ) : graphData ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
              <span className="font-semibold text-white">Target: {graphData.medicine_name}</span>
              <span>
                {filteredNodes.length} nodes active • {graphData.total_edges} verified edges
              </span>
            </div>

            {/* SVG Visual Graph Layout */}
            <div className="relative w-full h-80 bg-[#0b1015] rounded-2xl border border-slate-800/80 overflow-hidden flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 800 400">
                {/* Center Node: Target Medicine */}
                <circle cx="400" cy="200" r="38" fill="#0d9488" stroke="#14b8a6" strokeWidth="3" />
                <text x="400" y="205" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">
                  {graphData.medicine_name}
                </text>

                {/* Orbiting Radial Nodes */}
                {filteredNodes
                  .filter((n: any) => n.type !== 'medicine')
                  .map((node: any, idx: number, arr: any[]) => {
                    const angle = (idx / arr.length) * 2 * Math.PI;
                    const radius = 140;
                    const cx = 400 + radius * Math.cos(angle);
                    const cy = 200 + radius * Math.sin(angle);
                    const isSelected = selectedNode?.id === node.id;

                    return (
                      <g
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className="cursor-pointer transition-transform hover:scale-110"
                      >
                        {/* Connecting Line */}
                        <line
                          x1="400"
                          y1="200"
                          x2={cx}
                          y2={cy}
                          stroke="#1e293b"
                          strokeWidth={isSelected ? '2.5' : '1.5'}
                          strokeDasharray={node.type === 'warning' ? '4 2' : 'none'}
                        />

                        {/* Node Bubble */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isSelected ? '24' : '20'}
                          fill={getNodeColor(node.type)}
                          stroke={isSelected ? '#ffffff' : '#334155'}
                          strokeWidth={isSelected ? '3' : '1.5'}
                        />

                        {/* Label */}
                        <text
                          x={cx}
                          y={cy + 32}
                          textAnchor="middle"
                          fill="#cbd5e1"
                          fontSize="9.5"
                          fontWeight="600"
                        >
                          {node.label.length > 18 ? node.label.substring(0, 16) + '...' : node.label}
                        </text>
                      </g>
                    );
                  })}
              </svg>
            </div>

            {/* Selected Node Details Drawer */}
            {selectedNode && (
              <div className="bg-[#141e2a] border border-slate-700/80 rounded-2xl p-4 text-xs space-y-1.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{selectedNode.label}</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-700/60">
                    {selectedNode.type}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  <strong>Relationship: </strong>
                  Documented association with {graphData.medicine_name} verified against official healthcare monograph sources.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* Legend */}
        <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#0d9488]" /><span>Medicine</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]" /><span>Active Ingredient</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /><span>Indication</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /><span>Side Effect</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /><span>Precaution</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#64748b]" /><span>Verified Source</span></div>
        </div>
      </div>
    </div>
  );
};
