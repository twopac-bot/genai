import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Camera,
  Paperclip,
  Mic,
  MicOff,
  Activity,
  Pill,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Volume2,
  VolumeX,
  Scale,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  FileText,
  X,
  Sparkles,
  Radio,
  Square,
  Play,
} from 'lucide-react';
import { api } from '../services/api';
import {
  MedicationResearchResponse,
  FollowUpAnswerResponse,
  ImageIdentificationResponse,
} from '../types/medication';
import { SourceCitation } from './SourceCitation';
import { CameraModal } from './CameraModal';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text?: string;
  image?: string;
  researchData?: MedicationResearchResponse;
  answerData?: FollowUpAnswerResponse;
  identificationData?: ImageIdentificationResponse;
  documentData?: {
    id: string;
    filename: string;
    file_type?: string;
    title?: string;
    medicine_name?: string;
    summary?: {
      title?: string;
      medicine_name?: string;
      documented_uses?: string[];
      side_effects?: string[];
      warnings?: string[];
      precautions?: string[];
      storage_information?: string;
      raw_text_excerpt?: string;
    };
  };
  documentAnswerData?: {
    question: string;
    answer: string;
    document_id: string;
  };
  isError?: boolean;
  timestamp: Date;
}

interface ChatViewProps {
  sessionId: string;
  onOpenCompare?: (medA: string, medB?: string) => void;
  initialResearch?: MedicationResearchResponse | null;
}

export const ChatView: React.FC<ChatViewProps> = ({
  sessionId,
  onOpenCompare,
  initialResearch,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialResearch) {
      return [
        {
          id: 'initial',
          sender: 'assistant',
          researchData: initialResearch,
          timestamp: new Date(),
        },
      ];
    }
    return [
      {
        id: 'welcome',
        sender: 'assistant',
        text: 'Hello. Ask about any medication, upload clinical leaflets (PDF/Image) for grounded Q&A, capture packaging photos, or start hands-free voice chat.',
        timestamp: new Date(),
      },
    ];
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeMedicine, setActiveMedicine] = useState<string | null>(
    initialResearch?.medicine?.display_name || null
  );

  // Active Medical Document Context
  const [activeDocument, setActiveDocument] = useState<{
    id: string;
    title?: string;
    filename: string;
    medicine_name?: string;
  } | null>(null);

  // Voice Assistant State
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [speechLanguage, setSpeechLanguage] = useState<'en' | 'hi' | 'te'>('en');
  const [voiceOrbState, setVoiceOrbState] = useState<'idle' | 'listening' | 'speaking' | 'thinking'>('idle');
  const [voiceLiveText, setVoiceLiveText] = useState('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [micStatusNotice, setMicStatusNotice] = useState<string | null>(null);

  // Refs for Speech Recognition, Synthesis, and Media Recording
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const synthUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const keepAliveTimerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const isManuallyStoppedRef = useRef<boolean>(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

  // --------------------------------------------------------------------------
  // CLEANUP HELPER
  // --------------------------------------------------------------------------
  const stopAllAudio = () => {
    stopSpeech();
    stopMicStream();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stopMicStream = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    setAudioLevel(0);
  };

  // --------------------------------------------------------------------------
  // SPEECH SYNTHESIS (TTS) - Chrome GC Proof
  // --------------------------------------------------------------------------
  const stopSpeech = () => {
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    synthUtteranceRef.current = null;
    (window as any).__activeUtterance = null;
    setSpeakingId(null);
    if (voiceOrbState === 'speaking') {
      setVoiceOrbState('idle');
    }
  };

  const speakText = (msgId: string, textToRead: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this browser.');
      return;
    }

    stopSpeech();

    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // Clean markdown and medical symbols
    const cleanText = textToRead
      .replace(/[#*_`~\[\]\(\)\{\}]/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    synthUtteranceRef.current = utterance;
    (window as any).__activeUtterance = utterance; // Prevent garbage collection cutoff

    // Select suitable voice if available
    const voices = window.speechSynthesis.getVoices();
    const langCode = speechLanguage === 'hi' ? 'hi' : speechLanguage === 'te' ? 'te' : 'en';
    const matchedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(langCode));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.lang = speechLanguage === 'hi' ? 'hi-IN' : speechLanguage === 'te' ? 'te-IN' : 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setSpeakingId(msgId);
      setVoiceOrbState('speaking');
    };

    utterance.onend = () => {
      stopSpeech();
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      stopSpeech();
    };

    // Keepalive loop for Chromium
    keepAliveTimerRef.current = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        clearInterval(keepAliveTimerRef.current);
      } else {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 6000);

    window.speechSynthesis.speak(utterance);
    setSpeakingId(msgId);
    setVoiceOrbState('speaking');
  };

  const handleToggleSpeech = (msgId: string, textToRead: string) => {
    if (speakingId === msgId) {
      stopSpeech();
    } else {
      speakText(msgId, textToRead);
    }
  };

  // --------------------------------------------------------------------------
  // DUAL-ENGINE SPEECH-TO-TEXT (Web Speech API + MediaRecorder Fallback)
  // --------------------------------------------------------------------------
  const startVoiceInput = async () => {
    stopSpeech();
    setMicStatusNotice(null);
    setVoiceLiveText('');
    isManuallyStoppedRef.current = false;

    // 1. Request microphone access explicitly to guarantee hardware grant
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
    } catch (permErr: any) {
      console.error('Microphone permission error:', permErr);
      setMicStatusNotice('Microphone access blocked. Please allow mic permissions in your browser address bar.');
      setIsListening(false);
      setVoiceOrbState('idle');
      return;
    }

    // 2. Set up real-time audio level analyser for waveform animations
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round(avg * 1.5)));
          animFrameRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      }
    } catch (e) {
      // audio context optional
    }

    // 3. Start MediaRecorder as guaranteed audio backup
    audioChunksRef.current = [];
    try {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      mediaRecorder.start(250);
    } catch (recErr) {
      console.warn('MediaRecorder init error:', recErr);
    }

    setIsListening(true);
    setVoiceOrbState('listening');

    // 4. Start Web Speech API for immediate live transcription
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    let recognizedText = '';

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang =
          speechLanguage === 'hi' ? 'hi-IN' : speechLanguage === 'te' ? 'te-IN' : 'en-US';

        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              recognizedText += event.results[i][0].transcript + ' ';
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          const live = (recognizedText + interim).trim();
          setVoiceLiveText(live);
          setInputText(live);

          // Reset silence detection timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          // Auto-submit after 2.5 seconds of silence if text is non-empty
          if (live.length > 3) {
            silenceTimerRef.current = setTimeout(() => {
              finishAndSendVoiceQuery(live);
            }, 2500);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Web Speech recognition event error:', event.error);
          if (event.error === 'network' || event.error === 'no-speech') {
            // Keep going with MediaRecorder fallback
          }
        };

        recognition.onend = () => {
          // If not manually stopped, do nothing; MediaRecorder handles final audio
        };

        recognition.start();
      } catch (err) {
        console.warn('SpeechRecognition start failed, relying on MediaRecorder fallback:', err);
      }
    } else {
      setMicStatusNotice('Recording audio via browser microphone...');
    }
  };

  const finishAndSendVoiceQuery = async (finalText?: string) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    isManuallyStoppedRef.current = true;
    const transcribedSoFar = (finalText || voiceLiveText || inputText).trim();

    // Stop microphone stream & analyser
    stopMicStream();

    // If we have text from Web Speech API, send it directly!
    if (transcribedSoFar) {
      setVoiceOrbState('thinking');
      await executeVoiceQuery(transcribedSoFar);
      return;
    }

    // Otherwise, use recorded audio chunk and transcribe via Gemini backend
    if (audioChunksRef.current.length > 0) {
      setVoiceOrbState('thinking');
      setMicStatusNotice('Processing spoken audio with Gemini AI...');
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const res = await api.transcribeAudio(audioBlob, speechLanguage);
        if (res && res.transcript && res.transcript.trim()) {
          const transcribed = res.transcript.trim();
          setVoiceLiveText(transcribed);
          setInputText(transcribed);
          await executeVoiceQuery(transcribed);
          return;
        }
      } catch (transcribeErr: any) {
        console.warn('Audio transcription fallback failed:', transcribeErr);
      }
    }

    // If no audio was heard
    setVoiceOrbState('idle');
    setMicStatusNotice('No speech detected. Please tap the orb and try speaking again.');
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      finishAndSendVoiceQuery();
    } else {
      startVoiceInput();
    }
  };

  // --------------------------------------------------------------------------
  // EXECUTE VOICE QUERY & SPEAK CLINICAL RESPONSE
  // --------------------------------------------------------------------------
  const executeVoiceQuery = async (query: string) => {
    if (!query) {
      setVoiceOrbState('idle');
      return;
    }

    setVoiceLiveText(`"${query}"`);
    setInputText('');
    setVoiceOrbState('thinking');
    setIsLoading(true);

    const userMsgId = 'user-voice-' + Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: query,
        timestamp: new Date(),
      },
    ]);

    try {
      // 1. If active document, answer from document
      if (activeDocument) {
        try {
          const docRes = await api.askDocumentQuestion(activeDocument.id, query, sessionId);
          const asstMsgId = 'assistant-voice-doc-' + Date.now();
          setMessages((prev) => [
            ...prev,
            {
              id: asstMsgId,
              sender: 'assistant',
              documentAnswerData: docRes,
              timestamp: new Date(),
            },
          ]);

          speakText(asstMsgId, docRes.answer);
          setIsLoading(false);
          return;
        } catch (e) {
          console.warn('Document voice question failed, checking general medication...');
        }
      }

      // 2. Call Voice Interaction Pipeline
      const voiceRes = await api.processVoice(query, speechLanguage, sessionId, activeMedicine || undefined);
      if (voiceRes.active_medicine) {
        setActiveMedicine(voiceRes.active_medicine);
      }

      const asstMsgId = 'assistant-voice-res-' + Date.now();
      const spokenText = voiceRes.spoken_audio_text || voiceRes.answer_text;

      setMessages((prev) => [
        ...prev,
        {
          id: asstMsgId,
          sender: 'assistant',
          text: voiceRes.answer_text,
          researchData: voiceRes.monograph || undefined,
          timestamp: new Date(),
        },
      ]);

      // Automatically speak the answer aloud!
      speakText(asstMsgId, spokenText);
    } catch (err: any) {
      console.error('Voice query execution error:', err);
      // Fallback to general research
      try {
        const res = await api.conductResearch(query, undefined, sessionId);
        setActiveMedicine(res.medicine.display_name);
        const asstMsgId = 'assistant-fallback-' + Date.now();
        setMessages((prev) => [
          ...prev,
          {
            id: asstMsgId,
            sender: 'assistant',
            researchData: res,
            timestamp: new Date(),
          },
        ]);
        const textToRead = `${res.medicine.display_name}. ${res.overview.text}`;
        speakText(asstMsgId, textToRead);
      } catch (fallbackErr: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'error-' + Date.now(),
            sender: 'assistant',
            text: err.message || 'Could not process voice inquiry.',
            isError: true,
            timestamp: new Date(),
          },
        ]);
        setVoiceOrbState('idle');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // TEXT MESSAGE SEND
  // --------------------------------------------------------------------------
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputText.trim();
    if (!query || isLoading) return;

    if (isListening) {
      stopMicStream();
    }

    setInputText('');
    const userMsgId = 'user-' + Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: query,
        timestamp: new Date(),
      },
    ]);

    setIsLoading(true);

    try {
      if (activeDocument) {
        try {
          const docRes = await api.askDocumentQuestion(activeDocument.id, query, sessionId);
          const asstMsgId = 'assistant-doc-' + Date.now();
          setMessages((prev) => [
            ...prev,
            {
              id: asstMsgId,
              sender: 'assistant',
              documentAnswerData: docRes,
              timestamp: new Date(),
            },
          ]);
          setIsLoading(false);
          return;
        } catch (docErr) {
          console.warn('Doc question failed, fallback to general research');
        }
      }

      if (activeMedicine) {
        try {
          const followUpRes = await api.askFollowUp(query, activeMedicine, sessionId);
          setMessages((prev) => [
            ...prev,
            {
              id: 'assistant-fu-' + Date.now(),
              sender: 'assistant',
              answerData: followUpRes,
              timestamp: new Date(),
            },
          ]);
          setIsLoading(false);
          return;
        } catch {}
      }

      const researchRes = await api.conductResearch(query, undefined, sessionId);
      setActiveMedicine(researchRes.medicine.display_name);
      setMessages((prev) => [
        ...prev,
        {
          id: 'assistant-res-' + Date.now(),
          sender: 'assistant',
          researchData: researchRes,
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'error-' + Date.now(),
          sender: 'assistant',
          text: err.message || 'An error occurred researching the medication.',
          isError: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // DOCUMENT ATTACHMENT
  // --------------------------------------------------------------------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const uploadMsgId = 'user-doc-' + Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: uploadMsgId,
        sender: 'user',
        text: `Uploaded medical leaflet: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        timestamp: new Date(),
      },
    ]);

    setIsLoading(true);

    try {
      const doc = await api.uploadMedicalDocument(file, sessionId);
      setActiveDocument({
        id: doc.id,
        title: doc.title,
        filename: doc.filename,
        medicine_name: doc.medicine_name,
      });

      if (doc.medicine_name) {
        setActiveMedicine(doc.medicine_name);
      }

      const asstDocMsgId = 'assistant-doc-summary-' + Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: asstDocMsgId,
          sender: 'assistant',
          documentData: doc,
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'error-doc-' + Date.now(),
          sender: 'assistant',
          text: `Failed to analyze medical document: ${err.message || 'Unable to parse document.'}`,
          isError: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // CAMERA PACKAGING PHOTO
  // --------------------------------------------------------------------------
  const handleSendPhoto = async (imageDataUrl: string, notes?: string) => {
    setIsCameraOpen(false);
    const userMsgId = 'user-photo-' + Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        image: imageDataUrl,
        text: notes ? `Photo attached (${notes})` : 'Medication packaging photo',
        timestamp: new Date(),
      },
    ]);

    setIsLoading(true);
    try {
      const idRes = await api.identifyImage(imageDataUrl, notes, sessionId);
      if (idRes.identified_medicine) {
        setActiveMedicine(idRes.identified_medicine);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: 'assistant-' + Date.now(),
          sender: 'assistant',
          identificationData: idRes,
          researchData: idRes.research_result || undefined,
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'error-' + Date.now(),
          sender: 'assistant',
          text: `Photo analysis failed: ${err.message || 'Could not identify medication'}`,
          isError: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      {/* Active Document Context Banner */}
      {activeDocument && (
        <div className="bg-[#121c27] border border-teal-800/60 rounded-2xl px-4 py-2.5 mb-2 flex items-center justify-between text-xs text-teal-300">
          <div className="flex items-center gap-2 overflow-hidden">
            <FileText className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="font-semibold text-white truncate">
              Active Leaflet: {activeDocument.filename}
            </span>
            {activeDocument.medicine_name && (
              <span className="bg-teal-950 px-2 py-0.5 rounded text-[11px] text-teal-300 border border-teal-800 shrink-0">
                {activeDocument.medicine_name}
              </span>
            )}
            <span className="hidden sm:inline text-slate-400 text-[11px]">
              (Grounded Q&A enabled)
            </span>
          </div>
          <button
            onClick={() => setActiveDocument(null)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Clear active document context"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Voice Mode Floating Container (With Interactive Orb) */}
      {isVoiceModeOpen && (
        <div className="bg-[#0f1722] border border-teal-600/50 rounded-3xl p-5 mb-3 flex flex-col items-center justify-center space-y-4 shadow-2xl relative overflow-hidden">
          {/* Top Controls */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-300">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>Voice Medication Assistant</span>
              <span className="text-[10px] bg-teal-950 text-teal-400 px-2 py-0.5 rounded border border-teal-800">
                Live Speech
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Speech Language"
                value={speechLanguage}
                onChange={(e) => setSpeechLanguage(e.target.value as any)}
                className="bg-[#141e2a] border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1 text-xs outline-none cursor-pointer"
              >
                <option value="en">English (US)</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="te">తెలుగు (Telugu)</option>
              </select>
              <button
                onClick={() => {
                  stopAllAudio();
                  setIsVoiceModeOpen(false);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Glowing Voice Orb */}
          <div className="relative flex items-center justify-center py-2">
            <div
              onClick={toggleVoiceInput}
              className={`w-32 h-32 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 select-none ${
                isListening
                  ? 'bg-gradient-to-tr from-teal-500 via-cyan-400 to-sky-500 shadow-[0_0_40px_rgba(20,184,166,0.7)] scale-105'
                  : voiceOrbState === 'speaking'
                  ? 'bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 shadow-[0_0_40px_rgba(56,189,248,0.7)] animate-pulse'
                  : voiceOrbState === 'thinking'
                  ? 'bg-gradient-to-tr from-amber-500 via-teal-500 to-cyan-500 shadow-[0_0_35px_rgba(45,212,191,0.5)] animate-spin'
                  : 'bg-[#152332] border-2 border-teal-500/50 hover:border-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:scale-102'
              }`}
            >
              <div className="w-24 h-24 rounded-full bg-[#0b1015]/85 backdrop-blur-sm flex flex-col items-center justify-center">
                {isListening ? (
                  <>
                    <Mic className="w-8 h-8 text-white animate-pulse" />
                    <span className="text-[10px] text-teal-300 font-bold uppercase mt-1">Listening</span>
                  </>
                ) : voiceOrbState === 'speaking' ? (
                  <>
                    <Volume2 className="w-8 h-8 text-sky-400 animate-bounce" />
                    <span className="text-[10px] text-sky-300 font-bold uppercase mt-1">Speaking</span>
                  </>
                ) : voiceOrbState === 'thinking' ? (
                  <>
                    <Activity className="w-8 h-8 text-amber-400 animate-spin" />
                    <span className="text-[10px] text-amber-300 font-bold uppercase mt-1">Thinking</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-8 h-8 text-teal-400" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Tap to Talk</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Audio Waveform Visualizer */}
          <div className="flex items-center gap-1.5 h-7">
            {[25, 60, 95, 45, 85, 35, 75, 100, 50, 90, 40, 70, 30].map((baseH, i) => {
              const activeH = isListening
                ? Math.max(6, Math.round((baseH * (audioLevel + 20)) / 100))
                : voiceOrbState === 'speaking'
                ? Math.max(6, Math.round(baseH * 0.7 * (Math.sin(Date.now() / 200 + i) + 1.2)))
                : 4;
              return (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-100 ${
                    isListening
                      ? 'bg-teal-400'
                      : voiceOrbState === 'speaking'
                      ? 'bg-sky-400'
                      : 'bg-slate-700'
                  }`}
                  style={{ height: `${activeH}px` }}
                />
              );
            })}
          </div>

          {/* Transcript & Status Display */}
          <div className="text-center space-y-1.5 max-w-md px-4">
            <p className="text-xs font-semibold text-slate-300">
              {isListening
                ? 'Listening... speak about a medication, dosage, or symptom (tap orb when done)'
                : voiceOrbState === 'speaking'
                ? 'Reading verified clinical response aloud'
                : voiceOrbState === 'thinking'
                ? 'Synthesizing medication monograph...'
                : 'Tap orb to start hands-free voice consultation'}
            </p>

            {voiceLiveText && (
              <p className="text-xs text-teal-300 italic bg-[#121c27] px-3 py-1.5 rounded-xl border border-slate-800 inline-block">
                {voiceLiveText}
              </p>
            )}

            {micStatusNotice && (
              <p className="text-[11px] text-amber-300">{micStatusNotice}</p>
            )}
          </div>

          {/* Quick Voice Prompt Shortcuts */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-slate-800/80 w-full text-xs">
            <span className="text-[11px] text-slate-500">Quick tests:</span>
            {[
              'What are the side effects of Ibuprofen?',
              'Paracetamol precautions',
              'Can I take Cetirizine with food?',
            ].map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => executeVoiceQuery(prompt)}
                className="bg-[#141e2a] hover:bg-[#1a2634] text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] transition-colors cursor-pointer flex items-center gap-1"
              >
                <Play className="w-3 h-3 text-teal-400" />
                <span>{prompt}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-4">
        {messages.map((msg) => {
          if (msg.sender === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-xl bg-teal-800 text-white rounded-2xl rounded-tr-xs px-4 py-3 space-y-2">
                  {msg.image && (
                    <div className="rounded-xl overflow-hidden max-h-48 bg-black/40">
                      <img src={msg.image} alt="User sent" className="object-cover w-full h-full" />
                    </div>
                  )}
                  {msg.text && <p className="text-sm font-medium">{msg.text}</p>}
                  <div className="text-[10px] text-teal-200/70 text-right">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          }

          // Assistant message
          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-2xl w-full bg-[#101720] border border-slate-800 rounded-2xl rounded-tl-xs p-5 space-y-4 text-slate-200">
                {/* Simple Text Response */}
                {msg.text && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-teal-400 font-semibold">DrugInfo AI</span>
                      <button
                        onClick={() => handleToggleSpeech(msg.id, msg.text!)}
                        className="p-1.5 text-slate-400 hover:text-teal-300 hover:bg-[#141e2a] rounded-xl transition-colors cursor-pointer"
                        title="Read aloud"
                      >
                        {speakingId === msg.id ? (
                          <VolumeX className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className={`text-sm leading-relaxed whitespace-pre-line ${msg.isError ? 'text-red-300' : 'text-slate-200'}`}>
                      {msg.text}
                    </p>
                  </div>
                )}

                {/* Grounded Document Q&A Answer */}
                {msg.documentAnswerData && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="inline-flex items-center gap-2 bg-[#121c27] text-teal-300 text-xs font-semibold px-3 py-1 rounded-full border border-teal-800/80">
                        <FileText className="w-3.5 h-3.5 text-teal-400" />
                        <span>Document-Grounded Answer</span>
                      </div>
                      <button
                        onClick={() => handleToggleSpeech(msg.id, msg.documentAnswerData!.answer)}
                        className="p-1.5 text-slate-400 hover:text-teal-300 hover:bg-[#141e2a] rounded-xl transition-colors cursor-pointer"
                        title="Read aloud"
                      >
                        {speakingId === msg.id ? (
                          <VolumeX className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <div className="bg-[#121c27] border border-slate-800/80 rounded-xl p-3.5">
                      <div className="text-xs font-semibold text-slate-400 mb-1">Inquiry:</div>
                      <p className="text-xs text-teal-200 font-medium italic">"{msg.documentAnswerData.question}"</p>
                    </div>

                    <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                      {msg.documentAnswerData.answer}
                    </div>

                    <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
                      Answer strictly derived from the uploaded medical document.
                    </div>
                  </div>
                )}

                {/* Uploaded Medical Document Summary Card */}
                {msg.documentData && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <div className="inline-flex items-center gap-1.5 bg-[#121c27] text-teal-300 text-xs font-bold px-2.5 py-1 rounded-md border border-teal-800/80 mb-1">
                          <FileText className="w-3.5 h-3.5 text-teal-400" />
                          <span>Medical Leaflet Analysis</span>
                        </div>
                        <h3 className="text-base font-bold text-white">
                          {msg.documentData.title || msg.documentData.filename}
                        </h3>
                        {msg.documentData.medicine_name && (
                          <div className="text-xs text-teal-400 font-semibold mt-0.5">
                            Identified Medicine: {msg.documentData.medicine_name}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          const summaryText = `${msg.documentData?.title || 'Document'}. ${msg.documentData?.summary?.documented_uses?.join('. ') || ''}`;
                          handleToggleSpeech(msg.id, summaryText);
                        }}
                        className="p-2 text-slate-400 hover:text-teal-300 hover:bg-[#141e2a] rounded-xl transition-colors cursor-pointer"
                        title="Read aloud"
                      >
                        {speakingId === msg.id ? (
                          <VolumeX className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {msg.documentData.summary?.documented_uses && msg.documentData.summary.documented_uses.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Documented Uses & Indications</span>
                        </div>
                        <ul className="text-xs text-slate-300 list-disc list-inside space-y-1 bg-[#121c27] p-3 rounded-xl border border-slate-800/80">
                          {msg.documentData.summary.documented_uses.map((use, idx) => (
                            <li key={idx}>{use}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {msg.documentData.summary?.warnings && msg.documentData.summary.warnings.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Warnings & Boxed Precautions</span>
                        </div>
                        <ul className="text-xs text-slate-300 list-disc list-inside space-y-1 bg-amber-950/20 p-3 rounded-xl border border-amber-900/40">
                          {msg.documentData.summary.warnings.map((warn, idx) => (
                            <li key={idx}>{warn}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {msg.documentData.summary?.side_effects && msg.documentData.summary.side_effects.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Reported Adverse Effects</span>
                        </div>
                        <ul className="text-xs text-slate-300 list-disc list-inside space-y-1 bg-rose-950/20 p-3 rounded-xl border border-rose-900/40">
                          {msg.documentData.summary.side_effects.map((se, idx) => (
                            <li key={idx}>{se}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Follow-up Answer Data */}
                {msg.answerData && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4" />
                        <span>Clinical Answer</span>
                      </div>
                      <button
                        onClick={() => handleToggleSpeech(msg.id, msg.answerData!.answer)}
                        className="p-1.5 text-slate-400 hover:text-teal-300 hover:bg-[#141e2a] rounded-xl transition-colors cursor-pointer"
                        title="Read aloud"
                      >
                        {speakingId === msg.id ? (
                          <VolumeX className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <div className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">
                      {msg.answerData.answer}
                    </div>

                    {msg.answerData.sources && msg.answerData.sources.length > 0 && (
                      <div className="pt-3 border-t border-slate-800/80 space-y-2">
                        <div className="text-xs font-bold uppercase text-slate-400">Supporting Healthcare Sources</div>
                        <div className="space-y-2">
                          {msg.answerData.sources.map((src: any, idx: number) => (
                            <div key={idx} className="bg-[#121c27] p-2.5 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                              <span className="text-slate-300 font-medium">{src.title}</span>
                              <span className="text-[10px] text-teal-400 font-semibold">{src.domain}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Full Medication Research Monograph */}
                {msg.researchData && (
                  <div className="space-y-5">
                    <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400 bg-teal-950/80 border border-teal-800/80 px-2.5 py-0.5 rounded-full">
                            Official Monograph
                          </span>
                          {msg.researchData.medicine.jurisdiction && (
                            <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full">
                              {msg.researchData.medicine.jurisdiction}
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-bold text-white tracking-tight">
                          {msg.researchData.medicine.display_name}
                        </h2>
                        {msg.researchData.medicine.generic_name && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            Generic: {msg.researchData.medicine.generic_name}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const text = `${msg.researchData?.medicine.display_name}. ${msg.researchData?.overview.text}`;
                            handleToggleSpeech(msg.id, text);
                          }}
                          className="p-2 text-slate-400 hover:text-teal-300 hover:bg-[#141e2a] rounded-xl transition-colors cursor-pointer"
                          title="Read aloud"
                        >
                          {speakingId === msg.id ? (
                            <VolumeX className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>
                        {onOpenCompare && (
                          <button
                            type="button"
                            onClick={() => onOpenCompare(msg.researchData!.medicine.display_name)}
                            className="p-2 text-slate-400 hover:text-teal-300 hover:bg-[#141e2a] rounded-xl transition-colors cursor-pointer"
                            title="Compare with another drug"
                          >
                            <Scale className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Educational Overview</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed bg-[#121c27] p-3.5 rounded-xl border border-slate-850">
                        {msg.researchData.overview.text}
                      </p>
                    </div>

                    {msg.researchData.documented_uses && msg.researchData.documented_uses.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Documented Indications & Uses</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {msg.researchData.documented_uses.map((use, idx) => (
                            <div key={idx} className="bg-[#121c27] p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                              {use.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.researchData.side_effects && msg.researchData.side_effects.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Reported Adverse Reactions & Side Effects</span>
                        </div>
                        <div className="space-y-2">
                          {msg.researchData.side_effects.map((se, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border text-xs ${
                                se.classification === 'serious' || se.classification === 'boxed_warning'
                                  ? 'bg-rose-950/30 border-rose-800/80 text-rose-200'
                                  : 'bg-[#121c27] border-slate-800 text-slate-300'
                              }`}
                            >
                              <div className="font-semibold mb-0.5 capitalize">{se.classification.replace('_', ' ')}</div>
                              <div>{se.text}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.researchData.warnings_and_precautions && msg.researchData.warnings_and_precautions.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Precautions & Special Considerations</span>
                        </div>
                        <div className="space-y-2">
                          {msg.researchData.warnings_and_precautions.map((warn, idx) => (
                            <div key={idx} className="bg-amber-950/20 border border-amber-900/40 p-3 rounded-xl text-xs text-amber-200">
                              {warn.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#101720] border border-slate-800 rounded-2xl p-4 flex items-center gap-2.5 text-xs text-teal-300">
              <Activity className="w-4 h-4 animate-spin text-teal-400" />
              <span>
                {voiceOrbState === 'thinking'
                  ? 'Processing spoken query...'
                  : activeDocument
                  ? `Analyzing grounded document "${activeDocument.filename}"...`
                  : 'DrugInfo AI is synthesizing authoritative healthcare monographs...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="pt-3 border-t border-slate-800">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* Document Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,image/png,image/jpeg,image/webp,.txt"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-[#131d27] hover:bg-[#1a2634] text-teal-300 hover:text-white rounded-2xl border border-slate-700 transition-colors cursor-pointer shrink-0"
            title="Attach Medical Document or Leaflet (PDF / Image)"
          >
            <Paperclip className="w-5 h-5 text-teal-400" />
          </button>

          {/* Camera Button */}
          <button
            type="button"
            onClick={() => setIsCameraOpen(true)}
            className="p-3 bg-[#131d27] hover:bg-[#1a2634] text-teal-300 hover:text-white rounded-2xl border border-slate-700 transition-colors cursor-pointer shrink-0"
            title="Open camera window to capture packaging"
          >
            <Camera className="w-5 h-5 text-teal-400" />
          </button>

          {/* Toggle Voice Mode Bar / Orb */}
          <button
            type="button"
            onClick={() => {
              if (isVoiceModeOpen) {
                stopAllAudio();
                setIsVoiceModeOpen(false);
              } else {
                setIsVoiceModeOpen(true);
              }
            }}
            className={`p-3 rounded-2xl border transition-all cursor-pointer shrink-0 ${
              isVoiceModeOpen
                ? 'bg-teal-600 border-teal-400 text-white shadow-[0_0_15px_rgba(20,184,166,0.6)]'
                : 'bg-[#131d27] hover:bg-[#1a2634] text-teal-300 border-slate-700'
            }`}
            title="Toggle Hands-Free Voice Assistant Mode"
          >
            <Radio className="w-5 h-5" />
          </button>

          {/* Text Input with Inline Microphone */}
          <div className="relative flex-1 flex items-center">
            <input
              type="text"
              className="w-full py-3 pl-4 pr-11 text-sm text-white placeholder-slate-500 bg-[#101720] border border-slate-800 rounded-2xl focus:outline-none focus:border-teal-500 transition-colors"
              placeholder={
                activeDocument
                  ? `Ask follow-up question about ${activeDocument.filename}...`
                  : activeMedicine
                  ? `Ask follow-up about ${activeMedicine} or enter new drug...`
                  : isListening
                  ? 'Listening to microphone... speak now...'
                  : 'Ask about any drug, side effects, or click mic to speak...'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
            />

            {/* Direct Microphone Speech-to-Text Button */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`absolute right-2 p-1.5 rounded-xl transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'text-slate-400 hover:text-teal-400 hover:bg-[#16212e]'
              }`}
              title={isListening ? 'Stop recording & process' : 'Speak medication question'}
            >
              {isListening ? (
                <Square className="w-4 h-4 text-white fill-current" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="p-3 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-2xl transition-colors cursor-pointer shrink-0"
            title="Send"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Camera Window Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        sessionId={sessionId}
        onResearchSuccess={() => {}}
        onSendPhoto={handleSendPhoto}
      />
    </div>
  );
};
