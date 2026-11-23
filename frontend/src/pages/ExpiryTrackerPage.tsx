import React, { useState, useEffect } from 'react';
import {
  Calendar,
  AlertTriangle,
  Clock,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Package,
  Building,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';

interface ExpiryTrackerPageProps {
  sessionId: string;
}

export const ExpiryTrackerPage: React.FC<ExpiryTrackerPageProps> = ({ sessionId }) => {
  const [cabinetItems, setCabinetItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add Item Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    medicine_name: '',
    brand_name: '',
    dosage_strength: '',
    manufacturer: '',
    batch_number: '',
    expiry_date: '',
    notes: '',
  });

  // Edit date modal
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editDate, setEditDate] = useState('');

  const fetchCabinet = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getCabinetItems(sessionId);
      setCabinetItems(res.cabinet || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch cabinet.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCabinet();
  }, [sessionId]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.medicine_name.trim() || !newItem.expiry_date.trim()) return;

    try {
      await api.addCabinetItem({
        ...newItem,
        session_id: sessionId,
      });
      setIsAddOpen(false);
      setNewItem({
        medicine_name: '',
        brand_name: '',
        dosage_strength: '',
        manufacturer: '',
        batch_number: '',
        expiry_date: '',
        notes: '',
      });
      await fetchCabinet();
    } catch (err: any) {
      alert(`Could not save item: ${err.message}`);
    }
  };

  const handleSaveDateEdit = async () => {
    if (!editingItem || !editDate.trim()) return;
    try {
      await api.updateCabinetItem(editingItem.id, { expiry_date: editDate.trim() }, sessionId);
      setEditingItem(null);
      await fetchCabinet();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleDeleteItem = async (itemId: string, medName: string) => {
    if (!window.confirm(`Remove ${medName} from your medicine cabinet?`)) return;
    try {
      await api.deleteCabinetItem(itemId, sessionId);
      await fetchCabinet();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const getStatusBadge = (status: string, days: number | null) => {
    switch (status) {
      case 'expired':
        return (
          <span className="bg-red-950/50 text-red-300 border border-red-600/50 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span>Expired ({Math.abs(days || 0)}d ago)</span>
          </span>
        );
      case 'expiring_critical':
        return (
          <span className="bg-red-950/40 text-red-300 border border-red-600/40 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3 text-red-400" />
            <span>{days} Days Left</span>
          </span>
        );
      case 'expiring_soon':
        return (
          <span className="bg-amber-950/40 text-amber-300 border border-amber-600/40 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{days} Days Left</span>
          </span>
        );
      default:
        return (
          <span className="bg-teal-950 text-teal-300 border border-teal-700/60 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-teal-400" />
            <span>Valid ({days}d left)</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-teal-400" />
            <span>Medicine Cabinet & Expiry Tracker</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track your home medications, monitor upcoming expiration dates, and prevent accidental consumption of expired drugs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Medication</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-2xl text-xs text-red-200">
          {error}
        </div>
      )}

      {/* Add Medication Modal */}
      {isAddOpen && (
        <div className="bg-[#101720] border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">Save Medication to Cabinet</h3>
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleAddItem} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1">Medicine Name *</label>
              <input
                type="text"
                required
                value={newItem.medicine_name}
                onChange={(e) => setNewItem({ ...newItem, medicine_name: e.target.value })}
                placeholder="e.g. Paracetamol"
                className="w-full py-2 px-3 bg-[#0b1015] border border-slate-700 rounded-xl text-white focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-slate-300 block mb-1">Expiration Date (YYYY-MM-DD) *</label>
              <input
                type="text"
                required
                value={newItem.expiry_date}
                onChange={(e) => setNewItem({ ...newItem, expiry_date: e.target.value })}
                placeholder="2026-12-31 or 12/2026"
                className="w-full py-2 px-3 bg-[#0b1015] border border-slate-700 rounded-xl text-white focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-slate-300 block mb-1">Brand Name</label>
              <input
                type="text"
                value={newItem.brand_name}
                onChange={(e) => setNewItem({ ...newItem, brand_name: e.target.value })}
                placeholder="e.g. Tylenol"
                className="w-full py-2 px-3 bg-[#0b1015] border border-slate-700 rounded-xl text-white focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-slate-300 block mb-1">Dosage / Strength</label>
              <input
                type="text"
                value={newItem.dosage_strength}
                onChange={(e) => setNewItem({ ...newItem, dosage_strength: e.target.value })}
                placeholder="e.g. 500 mg"
                className="w-full py-2 px-3 bg-[#0b1015] border border-slate-700 rounded-xl text-white focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-slate-300 block mb-1">Manufacturer</label>
              <input
                type="text"
                value={newItem.manufacturer}
                onChange={(e) => setNewItem({ ...newItem, manufacturer: e.target.value })}
                placeholder="e.g. Johnson & Johnson"
                className="w-full py-2 px-3 bg-[#0b1015] border border-slate-700 rounded-xl text-white focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-slate-300 block mb-1">Batch / Lot Number</label>
              <input
                type="text"
                value={newItem.batch_number}
                onChange={(e) => setNewItem({ ...newItem, batch_number: e.target.value })}
                placeholder="e.g. B8912"
                className="w-full py-2 px-3 bg-[#0b1015] border border-slate-700 rounded-xl text-white focus:border-teal-500"
              />
            </div>

            <div className="sm:col-span-2 pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Save to Cabinet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Date Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#101720] border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-bold text-white">Update Expiration Date</h3>
            <p className="text-xs text-slate-400">
              Correct date for <strong>{editingItem.medicine_name}</strong>:
            </p>
            <input
              type="text"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              placeholder="YYYY-MM-DD or MM/YYYY"
              className="w-full py-2.5 px-3.5 text-xs text-white bg-[#0b1015] border border-slate-700 rounded-xl focus:border-teal-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-3 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDateEdit}
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Update Date
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medicine Cabinet Grid */}
      {cabinetItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cabinetItems.map((item) => {
            const analysis = item.expiry_analysis || {};
            const isAlert = analysis.status === 'expired' || analysis.status === 'expiring_critical';

            return (
              <div
                key={item.id}
                className={`bg-[#101720] rounded-2xl p-5 border space-y-3 transition-colors ${
                  isAlert ? 'border-red-600/40' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white">{item.medicine_name}</h3>
                    {item.brand_name && (
                      <span className="text-xs text-slate-400 font-medium">Brand: {item.brand_name}</span>
                    )}
                  </div>
                  {getStatusBadge(analysis.status, analysis.days_remaining)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-500 text-[10px] block">EXPIRY DATE</span>
                    <span className="font-mono font-bold text-slate-200">{item.expiry_date}</span>
                  </div>
                  {item.dosage_strength && (
                    <div>
                      <span className="text-slate-500 text-[10px] block">STRENGTH</span>
                      <span>{item.dosage_strength}</span>
                    </div>
                  )}
                  {item.batch_number && (
                    <div>
                      <span className="text-slate-500 text-[10px] block">BATCH #</span>
                      <span className="font-mono">{item.batch_number}</span>
                    </div>
                  )}
                  {item.manufacturer && (
                    <div>
                      <span className="text-slate-500 text-[10px] block">MANUFACTURER</span>
                      <span className="truncate block">{item.manufacturer}</span>
                    </div>
                  )}
                </div>

                {analysis.alert_message && (
                  <div
                    className={`p-2.5 rounded-xl text-[11px] leading-tight ${
                      analysis.status === 'expired'
                        ? 'bg-red-950/40 text-red-200 border border-red-600/30'
                        : analysis.status === 'expiring_critical' || analysis.status === 'expiring_soon'
                        ? 'bg-amber-950/30 text-amber-200 border border-amber-600/30'
                        : 'bg-[#141e2a] text-slate-300 border border-slate-800'
                    }`}
                  >
                    {analysis.alert_message}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(item);
                      setEditDate(item.expiry_date);
                    }}
                    className="text-slate-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Correct Date</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id, item.medicine_name)}
                    className="text-slate-500 hover:text-red-400 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#101720] border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Your Medicine Cabinet is Empty</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Scan a packaging strip with the camera or click 'Add Medication' above to track expiration dates and receive timely warnings.
          </p>
        </div>
      )}
    </div>
  );
};
