import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Pill,
  Scan,
  Video,
  Send,
} from 'lucide-react';
import { api } from '../services/api';
import { ImageIdentificationResponse, MedicationResearchResponse } from '../types/medication';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onResearchSuccess?: (data: MedicationResearchResponse) => void;
  onSendPhoto?: (imageDataUrl: string, notes?: string) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  onResearchSuccess,
  onSendPhoto,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ImageIdentificationResponse | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop current active webcam tracks
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Enumerate all videoinput devices
  const refreshDeviceList = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setVideoDevices(videoInputs);
        return videoInputs;
      } catch (e) {
        console.warn('Could not enumerate video devices:', e);
      }
    }
    return [];
  };

  // Start webcam with specific device or facing mode
  const startCamera = async (deviceId?: string) => {
    stopCamera();
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const targetDeviceId = deviceId || selectedDeviceId;
        const constraints: MediaStreamConstraints = {
          video: targetDeviceId
            ? { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        streamRef.current = stream;
        // Do NOT set srcObject here — the <video> element may not be in the DOM yet
        // because it only renders once isCameraActive is true. The useEffect below
        // hooks it up after the render cycle completes.
        setCameraError(null);

        const devices = await refreshDeviceList();
        const activeTrack = stream.getVideoTracks()[0];
        const currentId = activeTrack?.getSettings()?.deviceId || targetDeviceId || devices[0]?.deviceId;
        if (currentId) {
          setSelectedDeviceId(currentId);
        }
      } else {
        setCameraError('Camera access is not supported by your browser.');
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError(
        'Unable to access the selected camera. Please verify camera permissions or choose another device.'
      );
    }
  };

  // Wire the stream into the <video> element AFTER it mounts in the DOM.
  useEffect(() => {
    if (streamRef.current && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
        video.play().catch(() => {/* playsInline/autoPlay handles policy */});
      }
    }
  });

  // On modal open/close or device changes
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setAnalysisResult(null);
      setNotes('');
      if (activeTab === 'camera') {
        startCamera(selectedDeviceId || undefined);
      }
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    startCamera(deviceId);
  };

  const handleCycleWebcam = () => {
    if (videoDevices.length > 1) {
      const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      const nextDevice = videoDevices[nextIndex];
      if (nextDevice?.deviceId) {
        handleSelectDevice(nextDevice.deviceId);
      }
    } else {
      setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
      startCamera();
    }
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCapturedImage(reader.result as string);
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
    if (activeTab === 'camera') {
      startCamera(selectedDeviceId || undefined);
    }
  };

  const handleAnalyze = async () => {
    if (!capturedImage || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const res = await api.identifyImage(capturedImage, notes.trim() || undefined, sessionId);
      setAnalysisResult(res);
    } catch (err: any) {
      alert(`Identification failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#101720] rounded-3xl max-w-2xl w-full p-6 border border-slate-800 relative my-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Visual Medication Scanner
                </h2>
                <span className="text-[10px] bg-teal-950 text-teal-300 border border-teal-800/80 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Vision Analysis
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan pill boxes, prescription labels, or packaging to identify active ingredients.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Close Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        {!capturedImage && (
          <div className="flex rounded-2xl bg-[#0b1015] p-1 mb-4 text-xs font-bold border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                activeTab === 'camera'
                  ? 'bg-[#141e2a] text-teal-300 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-4 h-4 text-teal-400" />
              <span>Live Camera Scanner</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-[#141e2a] text-teal-300 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-4 h-4 text-teal-400" />
              <span>Upload Photo / Image</span>
            </button>
          </div>
        )}

        {/* Content Area */}
        {!capturedImage ? (
          <div>
            {activeTab === 'camera' ? (
              <div className="space-y-3">
                {/* Webcam Selection Dropdown Bar */}
                {videoDevices.length > 0 && !cameraError && (
                  <div className="flex items-center gap-2 bg-[#0b1015] border border-slate-800 px-3 py-2 rounded-2xl text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300 font-bold shrink-0">
                      <Video className="w-4 h-4 text-teal-400" />
                      <span>Webcam:</span>
                    </div>
                    <select
                      value={selectedDeviceId || ''}
                      onChange={(e) => handleSelectDevice(e.target.value)}
                      className="flex-1 bg-[#131d27] border border-slate-700 text-slate-200 rounded-xl py-1 px-3 text-xs font-semibold focus:outline-none focus:border-teal-500 cursor-pointer truncate"
                      title="Choose active webcam"
                    >
                      {videoDevices.map((dev, idx) => (
                        <option key={dev.deviceId || idx} value={dev.deviceId}>
                          {dev.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                    {videoDevices.length > 1 && (
                      <button
                        type="button"
                        onClick={handleCycleWebcam}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Switch to next camera"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-teal-400" />
                      </button>
                    )}
                  </div>
                )}

                {cameraError ? (
                  <div className="p-8 bg-amber-950/20 border border-amber-600/30 rounded-3xl text-center space-y-3">
                    <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
                    <p className="text-xs text-amber-200 font-medium max-w-sm mx-auto">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('upload')}
                      className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Switch to Image Upload</span>
                    </button>
                  </div>
                ) : (
                  <div className="relative rounded-3xl overflow-hidden bg-black aspect-[4/3] sm:aspect-video flex items-center justify-center border-2 border-slate-800">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Quick Switch Camera Floating Button */}
                    <button
                      type="button"
                      onClick={handleCycleWebcam}
                      className="absolute top-4 right-4 bg-slate-900/90 hover:bg-slate-800 text-white px-3 py-2 rounded-full border border-slate-700 transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
                      title="Switch / Cycle Webcam"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-teal-400" />
                      <span className="font-semibold text-[11px]">
                        Switch Webcam {videoDevices.length > 1 ? `(${videoDevices.findIndex(d => d.deviceId === selectedDeviceId) + 1}/${videoDevices.length})` : ''}
                      </span>
                    </button>

                    {/* Clean Clinical Viewfinder with Corner Accents */}
                    <div className="absolute inset-8 sm:inset-12 border border-dashed border-teal-500/60 rounded-2xl pointer-events-none flex items-center justify-center overflow-hidden">
                      {/* Corner Accents */}
                      <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-teal-400" />
                      <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-teal-400" />
                      <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-teal-400" />
                      <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-teal-400" />

                      {/* Pill Framing Helper */}
                      <div className="flex flex-col items-center gap-1 bg-slate-900/90 px-4 py-1.5 rounded-full border border-teal-600/40">
                        <Scan className="w-4 h-4 text-teal-400" />
                        <span className="text-[11px] font-mono text-teal-200">
                          Align label or packaging inside box
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Shutter Button Bar */}
                {!cameraError && (
                  <div className="flex flex-col items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCapturePhoto}
                      className="group relative flex items-center justify-center p-1 rounded-full cursor-pointer"
                      title="Click to take picture"
                    >
                      <div className="w-16 h-16 rounded-full border-2 border-teal-500 flex items-center justify-center bg-[#0b1015]">
                        <div className="w-12 h-12 rounded-full bg-teal-600 group-hover:bg-teal-500 transition-colors flex items-center justify-center text-white">
                          <Camera className="w-5 h-5" />
                        </div>
                      </div>
                    </button>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Tap Shutter to Snap Photo
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-dashed border-slate-700 hover:border-teal-500 rounded-3xl p-10 text-center space-y-4 bg-[#0b1015] transition-colors">
                <div className="w-14 h-14 rounded-2xl bg-[#131d27] text-teal-400 flex items-center justify-center mx-auto border border-slate-700">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Upload Medication or Prescription Photo
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Select a clear photo of your medicine bottle, box label, blister pack, or tablet.
                  </p>
                </div>
                <div>
                  <label className="cursor-pointer inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-5 py-3 rounded-xl transition-colors">
                    <Upload className="w-4 h-4 text-white" />
                    <span>Choose File from Device</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                  <p className="text-[11px] text-slate-500 mt-2 font-mono">
                    PNG, JPG, JPEG, WEBP (Max 10MB)
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Captured Image Preview & Analysis Results */
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-black max-h-72 flex items-center justify-center border border-slate-800">
              <img
                src={capturedImage}
                alt="Captured medication"
                className="max-h-72 w-auto object-contain rounded-xl"
              />
              {isAnalyzing && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white space-y-2">
                  <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
                  <p className="text-sm font-bold tracking-tight">Analyzing medication packaging...</p>
                  <p className="text-xs text-slate-400">Deciphering active ingredients, brand name, and dosage</p>
                </div>
              )}
            </div>

            {/* Optional Context Field */}
            {!analysisResult && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-teal-400" />
                  <span>Extra Notes or Symptoms (Optional):</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Prescribed for back pain, white oval tablet..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full py-2.5 px-3.5 text-xs text-white placeholder-slate-500 bg-[#0b1015] border border-slate-700 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>
            )}

            {/* Control Buttons */}
            {!analysisResult && (
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={isAnalyzing}
                  className="text-xs font-bold text-slate-300 hover:text-white py-2.5 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Retake
                </button>
                <div className="flex items-center gap-2">
                  {onSendPhoto ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (capturedImage && onSendPhoto) {
                          onSendPhoto(capturedImage, notes.trim() || undefined);
                        }
                      }}
                      className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Photo</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Scan className="w-4 h-4" />
                      <span>Analyze Medication</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Analysis Result Card */}
            {analysisResult && (
              <div className="bg-[#0b1015] border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-400" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Identification Result</h4>
                      <p className="text-[11px] text-slate-400">Packaging verification analysis</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${
                      analysisResult.confidence_level === 'high'
                        ? 'bg-teal-950 text-teal-300 border border-teal-700/60'
                        : analysisResult.confidence_level === 'medium'
                        ? 'bg-sky-950 text-sky-300 border border-sky-700/60'
                        : 'bg-amber-950 text-amber-300 border border-amber-700/60'
                    }`}
                  >
                    {analysisResult.confidence_level} Confidence
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-[#101720] p-3.5 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">
                      Identified Medicine
                    </span>
                    <span className="text-white font-extrabold text-base">
                      {analysisResult.identified_medicine || 'Undetermined'}
                    </span>
                  </div>
                  {analysisResult.brand_name && (
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">
                        Brand / Trade Name
                      </span>
                      <span className="text-slate-200 font-bold text-sm">
                        {analysisResult.brand_name}
                      </span>
                    </div>
                  )}
                  {analysisResult.dosage_strength && (
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">
                        Strength / Concentration
                      </span>
                      <span className="text-slate-300 font-semibold">
                        {analysisResult.dosage_strength}
                      </span>
                    </div>
                  )}
                  {analysisResult.active_ingredients?.length > 0 && (
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">
                        Active Ingredient(s)
                      </span>
                      <span className="text-slate-300 font-medium">
                        {analysisResult.active_ingredients.join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-300 bg-[#101720] p-3.5 rounded-xl border border-slate-800 leading-relaxed">
                  <span className="font-bold text-white block mb-1">Visual Summary:</span>
                  {analysisResult.analysis_summary}
                </div>

                {analysisResult.detected_warnings && (
                  <div className="text-xs text-amber-200 bg-amber-950/30 p-3 rounded-xl border border-amber-600/30 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Label Precaution:</strong> {analysisResult.detected_warnings}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="text-xs font-semibold text-slate-400 hover:text-white py-2 px-3 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Scan Another Photo
                  </button>
                  {analysisResult.research_result && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onResearchSuccess) {
                          onResearchSuccess(analysisResult.research_result!);
                        }
                        onClose();
                      }}
                      className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <span>View Full Educational Monograph</span>
                      <ArrowRight className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
