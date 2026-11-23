import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Pill,
  FileText,
  Scan,
  ShieldCheck,
  Edit2,
  Bookmark,
  Calendar,
  Building,
  Package,
} from 'lucide-react';
import { api } from '../services/api';
import { MedicationResearchResponse } from '../types/medication';

interface MedicineScannerPageProps {
  sessionId: string;
  onViewMonograph: (data: MedicationResearchResponse) => void;
}

export const MedicineScannerPage: React.FC<MedicineScannerPageProps> = ({
  sessionId,
  onViewMonograph,
}) => {
  const [scannerMode, setScannerMode] = useState<'packaging' | 'prescription'>('packaging');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feature 1: Packaging extraction state
  const [packagingData, setPackagingData] = useState<any>(null);
  const [editableFields, setEditableFields] = useState<any>({});
  const [saveToCabinet, setSaveToCabinet] = useState(true);

  // Feature 2: Prescription extraction state
  const [prescriptionData, setPrescriptionData] = useState<any>(null);

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera tracks
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async (deviceId?: string) => {
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera is not supported on this browser.');
        return;
      }
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: 'environment' } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      // Set isCameraActive FIRST so the <video> element renders, then hook up
      // the srcObject in the effect below once the ref is populated.
      setIsCameraActive(true);
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
    } catch (e: any) {
      setError(`Camera error: ${e.message || 'Permission denied'}`);
      setIsCameraActive(false);
    }
  };

  // Wire the stream to the <video> element AFTER it has been mounted in the DOM.
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.play().catch(() => {/* autoplay policy — playsInline handles it */});
    }
  }, [isCameraActive]);

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setImagePreview(dataUrl);
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  const handleRunScan = async () => {
    if (!imagePreview || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    setPackagingData(null);
    setPrescriptionData(null);

    try {
      if (scannerMode === 'packaging') {
        const res = await api.scanPackaging(imagePreview, notes.trim() || undefined, sessionId);
        setPackagingData(res.extraction);
        setEditableFields({
          medicine_name: res.extraction.medicine_name || '',
          brand_name: res.extraction.brand_name || '',
          generic_name: res.extraction.generic_name || '',
          dosage_strength: res.extraction.dosage_strength || '',
          manufacturer: res.extraction.manufacturer || '',
          batch_number: res.extraction.batch_number || '',
          mfg_date: res.extraction.mfg_date || '',
          expiry_date: res.extraction.expiry_date || '',
          packaging_type: res.extraction.packaging_type || 'strip',
        });
      } else {
        const res = await api.scanPrescription(imagePreview, notes.trim() || undefined, sessionId);
        setPrescriptionData(res.prescription_analysis);
      }
    } catch (err: any) {
      setError(err.message || 'Scan failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAndResearch = async () => {
    if (!editableFields.medicine_name || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await api.confirmPackaging({
        ...editableFields,
        notes: notes.trim() || undefined,
        image_data: imagePreview || undefined,
        save_to_cabinet: saveToCabinet,
        session_id: sessionId,
      });
      if (res.monograph) {
        onViewMonograph(res.monograph);
      }
    } catch (err: any) {
      setError(err.message || 'Confirmation & research failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    stopCamera();
    setImagePreview(null);
    setPackagingData(null);
    setPrescriptionData(null);
    setError(null);
    setNotes('');
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      {/* Top Scanner Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Scan className="w-6 h-6 text-teal-400" />
            <span>Medicine Scanner & Prescription Explainer</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Multimodal optical recognition for pill packaging, strips, blister packs, and clinical prescription slips.
          </p>
        </div>

        <div className="flex bg-[#101720] border border-slate-800 rounded-xl p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setScannerMode('packaging'); resetAll(); }}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              scannerMode === 'packaging'
                ? 'bg-teal-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Packaging Scanner
          </button>
          <button
            type="button"
            onClick={() => { setScannerMode('prescription'); resetAll(); }}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              scannerMode === 'prescription'
                ? 'bg-teal-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Prescription Explainer
          </button>
        </div>
      </div>

      {/* Input / Viewfinder Container */}
      {!imagePreview && (
        <div className="bg-[#101720] border border-slate-800 rounded-3xl p-6 space-y-4">
          {isCameraActive ? (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-800">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-8 border border-dashed border-teal-500/60 rounded-xl pointer-events-none flex items-center justify-center">
                  <span className="text-[11px] text-teal-200 bg-black/60 px-3 py-1 rounded-full">
                    Center {scannerMode === 'packaging' ? 'medicine packaging label' : 'prescription slip'} inside frame
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-6 py-3 rounded-2xl flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Snap Photo</span>
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="bg-[#141e2a] text-slate-300 hover:text-white text-xs px-4 py-3 rounded-2xl border border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => startCamera()}
                className="bg-[#131d27] hover:bg-[#182330] border border-slate-700 hover:border-teal-500/60 rounded-2xl p-8 text-center cursor-pointer transition-colors space-y-3 flex flex-col items-center justify-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-teal-950 border border-teal-700/60 flex items-center justify-center text-teal-300">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Use Device Webcam</h3>
                  <p className="text-xs text-slate-400 mt-1">Live snapshot from your computer or phone camera</p>
                </div>
              </div>

              <label className="bg-[#131d27] hover:bg-[#182330] border border-slate-700 hover:border-teal-500/60 rounded-2xl p-8 text-center cursor-pointer transition-colors space-y-3 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-teal-950 border border-teal-700/60 flex items-center justify-center text-teal-300">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Upload Saved Image</h3>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG, or WEBP photo of strip, bottle, or Rx slip</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}

          <div className="pt-2">
            <input
              type="text"
              placeholder="Optional notes (e.g. prescribed for throat infection, white oblong tablet)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full py-2.5 px-3.5 text-xs text-white placeholder-slate-500 bg-[#0b1015] border border-slate-800 rounded-xl focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>
      )}

      {/* Captured Image Preview & Trigger */}
      {imagePreview && !packagingData && !prescriptionData && (
        <div className="bg-[#101720] border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-slate-700" />
              <div>
                <span className="text-xs font-bold text-white block">Ready for Analysis</span>
                <span className="text-[11px] text-teal-300 capitalize">{scannerMode} Mode Selected</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetAll}
                disabled={isProcessing}
                className="text-xs text-slate-400 hover:text-white px-4 py-2.5 rounded-xl border border-slate-700 cursor-pointer"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={handleRunScan}
                disabled={isProcessing}
                className="bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing with Gemini Vision...</span>
                  </>
                ) : (
                  <>
                    <Scan className="w-4 h-4" />
                    <span>Analyze Image</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-2xl text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* FEATURE 1 RESULTS: Packaging Confirmation & Monograph Search */}
      {packagingData && (
        <div className="bg-[#101720] border border-slate-800 rounded-3xl p-6 space-y-5">
          <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-400" />
                <h2 className="text-base font-bold text-white">Extracted Packaging Information</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Review and correct any field before searching official healthcare sources.
              </p>
            </div>

            {packagingData.uncertain_fields?.length > 0 && (
              <span className="bg-amber-950/40 text-amber-300 border border-amber-600/40 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Uncertain OCR: {packagingData.uncertain_fields.join(', ')}</span>
              </span>
            )}
          </div>

          {/* Form Fields for Confirmation / Correction */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Medicine Name *</label>
              <input
                type="text"
                value={editableFields.medicine_name || ''}
                onChange={(e) => setEditableFields({ ...editableFields, medicine_name: e.target.value })}
                className="w-full py-2 px-3 bg-[#0b1015] border border-slate-700 rounded-xl text-white font-bold focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Brand Name</label>
              <input
                type="text"
                value={editableFields.brand_name || ''}
                onChange={(e) => setEditableFields({ ...editableFields, brand_name: e.target.value })}
                className="w-full py-2 px-3 bg-[#0b1015] border border-slate-700 rounded-xl text-white focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Active Ingredient / Generic</label>
              <input
                type="text"
                value={editableFields.generic_name || ''}
                onChange={(e) => setEditableFields({ ...editableFields, generic_name: e.target.value })}
                className="w-full py-2 px-3 bg-[#0b1015] border border-slate-700 rounded-xl text-white focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Dosage Strength</label>
              <input
                type="text"
                value={editableFields.dosage_strength || ''}
                onChange={(e) => setEditableFields({ ...editableFields, dosage_strength: e.target.value })}
                className="w-full py-2 px-3 bg-[#0b1015] border border-slate-700 rounded-xl text-white focus:border-teal-500"
                placeholder="e.g. 500 mg"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Expiry Date (YYYY-MM-DD)</label>
              <input
                type="text"
                value={editableFields.expiry_date || ''}
                onChange={(e) => setEditableFields({ ...editableFields, expiry_date: e.target.value })}
                className={`w-full py-2 px-3 bg-[#0b1015] rounded-xl text-white focus:border-teal-500 border ${
                  packagingData.uncertain_fields?.includes('expiry_date')
                    ? 'border-amber-500/70 text-amber-200'
                    : 'border-slate-700'
                }`}
                placeholder="YYYY-MM-DD or MM/YYYY"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Batch Number</label>
              <input
                type="text"
                value={editableFields.batch_number || ''}
                onChange={(e) => setEditableFields({ ...editableFields, batch_number: e.target.value })}
                className="w-full py-2 px-3 bg-[#0b1015] border border-slate-700 rounded-xl text-white focus:border-teal-500"
              />
            </div>
          </div>

          {/* Visual Summary and Raw OCR Accordion */}
          {packagingData.analysis_summary && (
            <div className="bg-[#0b1015] border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300">
              <span className="font-bold text-white block mb-1">Visual Observation:</span>
              <p>{packagingData.analysis_summary}</p>
            </div>
          )}

          {/* Save to Expiry Cabinet Checkbox & Confirmation Button */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={saveToCabinet}
                onChange={(e) => setSaveToCabinet(e.target.checked)}
                className="rounded accent-teal-600 w-4 h-4 cursor-pointer"
              />
              <span>Also save to my Medicine Cabinet for Expiry Tracking</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetAll}
                className="text-xs text-slate-400 hover:text-white px-4 py-2.5 rounded-xl border border-slate-700 cursor-pointer"
              >
                Scan Another
              </button>
              <button
                type="button"
                onClick={handleConfirmAndResearch}
                disabled={isProcessing}
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Searching Healthcare Sources...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & View Official Monograph</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FEATURE 2 RESULTS: Prescription Explainer */}
      {prescriptionData && (
        <div className="bg-[#101720] border border-slate-800 rounded-3xl p-6 space-y-5">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white">Prescription Clarification Aid</h2>
            </div>
            <button
              type="button"
              onClick={resetAll}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer"
            >
              Scan Another
            </button>
          </div>

          {/* Unclear Handwriting Alerts */}
          {prescriptionData.unclear_handwriting_flags?.length > 0 && (
            <div className="bg-amber-950/25 border border-amber-600/40 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Ambiguous / Unclear Handwriting Flags ({prescriptionData.unclear_handwriting_flags.length})</span>
              </div>
              <ul className="space-y-1.5 text-amber-200">
                {prescriptionData.unclear_handwriting_flags.map((item: any, i: number) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="font-bold">•</span>
                    <span><strong>{item.section || 'Fragment'}:</strong> {item.reason} — <em>{item.recommendation}</em></span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Identified Prescribed Medications */}
          {prescriptionData.identified_medications?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Prescribed Medications Identified:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {prescriptionData.identified_medications.map((m: any, i: number) => (
                  <div key={i} className="bg-[#141e2a] border border-slate-700/80 rounded-2xl p-4 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{m.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.certainty === 'clear' ? 'bg-teal-950 text-teal-300 border border-teal-700/60' : 'bg-amber-950 text-amber-300 border border-amber-600/40'
                      }`}>
                        {m.certainty === 'clear' ? 'Readable' : 'Review Needed'}
                      </span>
                    </div>
                    {m.dosage && <div><span className="text-slate-400">Dosage: </span><span className="text-slate-200">{m.dosage}</span></div>}
                    {m.frequency && <div><span className="text-slate-400">Frequency: </span><span className="text-slate-200">{m.frequency}</span></div>}
                    {m.instructions && <div><span className="text-slate-400">Instructions: </span><span className="text-slate-200">{m.instructions}</span></div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medical Abbreviations Glossary */}
          {prescriptionData.medical_abbreviations?.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Prescription Abbreviations Decoded:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {prescriptionData.medical_abbreviations.map((ab: any, i: number) => (
                  <div key={i} className="bg-[#0b1015] border border-slate-800 rounded-xl p-3 space-y-1">
                    <span className="font-mono font-bold text-teal-400 text-sm">{ab.abbreviation}</span>
                    <span className="text-white block font-medium text-[11px]">{ab.meaning}</span>
                    <p className="text-[10px] text-slate-400 leading-tight">{ab.clinical_context}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Safety Disclaimer */}
          <div className="p-3.5 bg-black/40 border border-slate-800 rounded-xl text-[11px] text-slate-400 leading-relaxed">
            <strong>Educational Clarification Notice:</strong> {prescriptionData.clinical_safety_notice}
          </div>
        </div>
      )}
    </div>
  );
};
