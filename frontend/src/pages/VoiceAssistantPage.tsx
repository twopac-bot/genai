import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Square,
  Globe,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api';

interface VoiceAssistantPageProps {
  sessionId: string;
}

export const VoiceAssistantPage: React.FC<VoiceAssistantPageProps> = ({ sessionId }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'hi' | 'te'>('en');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [liveTranscript, setLiveTranscript] = useState('');
  const [activeMedicine, setActiveMedicine] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Array<{ sender: 'user' | 'assistant'; text: string; time: string }>>([
    {
      sender: 'assistant',
      text: 'Voice assistant ready. Tap the microphone orb and speak in English, Hindi, or Telugu to inquire about any medication.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const recognitionRef = useRef<any>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage === 'hi' ? 'hi-IN' : selectedLanguage === 'te' ? 'te-IN' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setLiveTranscript('');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const final = event.results[i][0].transcript;
            setLiveTranscript(final);
            handleProcessSpeech(final);
          } else {
            interim += event.results[i][0].transcript;
            setLiveTranscript(interim);
          }
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [selectedLanguage]);

  const handleStartListening = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.lang = selectedLanguage === 'hi' ? 'hi-IN' : selectedLanguage === 'te' ? 'te-IN' : 'en-US';
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Recognition start error:', err);
      }
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleInterrupt = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    handleStartListening();
  };

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.lang = selectedLanguage === 'hi' ? 'hi-IN' : selectedLanguage === 'te' ? 'te-IN' : 'en-US';

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleProcessSpeech = async (transcriptText: string) => {
    const clean = transcriptText.trim();
    if (!clean) return;

    setConversation((prev) => [
      ...prev,
      {
        sender: 'user',
        text: clean,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setIsProcessing(true);
    try {
      const res = await api.processVoice(clean, selectedLanguage, sessionId, activeMedicine || undefined);
      if (res.active_medicine) {
        setActiveMedicine(res.active_medicine);
      }
      const responseText = res.spoken_audio_text || res.answer_text;
      setConversation((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: responseText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      speakText(responseText);
    } catch (err: any) {
      const fallbackText = 'Sorry, could not process voice request. Please try again.';
      setConversation((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: fallbackText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      speakText(fallbackText);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      {/* Top Bar with Language Selector */}
      <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Mic className="w-6 h-6 text-teal-400" />
            <span>Voice Medication Assistant</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Hands-free natural speech interaction connected directly to the verified DrugInfo AI research pipeline.
          </p>
        </div>

        {/* Language selector pill */}
        <div className="flex items-center gap-1.5 bg-[#101720] border border-slate-800 rounded-xl p-1 text-xs font-semibold">
          <Globe className="w-3.5 h-3.5 text-slate-400 ml-2" />
          <button
            type="button"
            onClick={() => setSelectedLanguage('en')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              selectedLanguage === 'en' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setSelectedLanguage('hi')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              selectedLanguage === 'hi' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            हिंदी
          </button>
          <button
            type="button"
            onClick={() => setSelectedLanguage('te')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              selectedLanguage === 'te' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            తెలుగు
          </button>
        </div>
      </div>

      {/* Main Interactive Voice Sphere Stage (Inspired by user uploaded design) */}
      <div className="bg-[#101720] border border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center space-y-6 relative overflow-hidden">
        {/* Animated Background Ambience */}
        <div
          className={`absolute w-72 h-72 rounded-full blur-3xl pointer-events-none transition-opacity duration-700 ${
            isListening
              ? 'bg-teal-500/20 opacity-100 scale-110'
              : isSpeaking
              ? 'bg-sky-500/20 opacity-100 scale-105'
              : 'bg-teal-500/5 opacity-50'
          }`}
        />

        {/* Center Glowing Voice Orb */}
        <div className="relative z-10 flex flex-col items-center">
          <button
            type="button"
            onClick={isListening ? handleStopListening : handleStartListening}
            className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300 relative cursor-pointer ${
              isListening
                ? 'bg-gradient-to-tr from-teal-500 to-cyan-400 shadow-[0_0_40px_rgba(20,184,166,0.5)] scale-105 animate-pulse ring-4 ring-teal-400/30'
                : isSpeaking
                ? 'bg-gradient-to-tr from-cyan-500 to-teal-600 shadow-[0_0_35px_rgba(56,189,248,0.4)] ring-4 ring-cyan-400/30'
                : 'bg-[#141e2a] border border-slate-700 hover:border-teal-500 shadow-xl hover:scale-105'
            }`}
            title={isListening ? 'Tap to stop listening' : 'Tap to start speaking'}
          >
            {isProcessing ? (
              <Activity className="w-12 h-12 text-white animate-spin" />
            ) : isListening ? (
              <Mic className="w-12 h-12 text-white" />
            ) : isSpeaking ? (
              <Volume2 className="w-12 h-12 text-white animate-bounce" />
            ) : (
              <Mic className="w-12 h-12 text-teal-400" />
            )}
          </button>

          <span className="text-xs font-semibold text-slate-300 mt-4 tracking-wide">
            {isProcessing
              ? 'Analyzing verified medication monograph...'
              : isListening
              ? 'Listening... Speak your question'
              : isSpeaking
              ? 'AI is speaking... Tap to interrupt'
              : 'Tap Orb to Speak'}
          </span>
        </div>

        {/* Live Waveform Indicator */}
        <div className="h-8 flex items-center justify-center gap-1 z-10">
          {[4, 12, 24, 16, 28, 8, 20, 32, 14, 6, 22, 18, 10, 26, 8, 16].map((h, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-150 ${
                isListening || isSpeaking
                  ? 'bg-teal-400'
                  : 'bg-slate-700'
              }`}
              style={{
                height: isListening || isSpeaking ? `${Math.max(4, (h * (i % 3 + 1)) % 32)}px` : '4px',
              }}
            />
          ))}
        </div>

        {/* Live speech transcription text */}
        {liveTranscript && (
          <div className="bg-[#0b1015] border border-slate-800 rounded-2xl px-5 py-2.5 text-xs text-teal-300 font-medium max-w-md text-center z-10">
            "{liveTranscript}"
          </div>
        )}

        {/* Quick Voice Action Controls */}
        <div className="flex items-center gap-3 z-10">
          {isSpeaking && (
            <button
              type="button"
              onClick={handleInterrupt}
              className="bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-600/40 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Interrupt & Speak</span>
            </button>
          )}

          {activeMedicine && (
            <span className="text-[11px] text-slate-400 bg-[#0b1015] px-3 py-1.5 rounded-xl border border-slate-800">
              Active Topic: <strong className="text-white">{activeMedicine}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Voice Transcript History */}
      <div className="bg-[#101720] border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white">Conversation Transcript</h2>
          <button
            type="button"
            onClick={() => {
              if (window.speechSynthesis) window.speechSynthesis.cancel();
              setConversation([]);
            }}
            className="text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            Clear Transcript
          </button>
        </div>

        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {conversation.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl text-xs space-y-1 ${
                msg.sender === 'user'
                  ? 'bg-teal-900/40 text-teal-100 ml-8 border border-teal-700/50'
                  : 'bg-[#141e2a] text-slate-200 mr-8 border border-slate-700/80'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                <span className="font-bold uppercase tracking-wider">
                  {msg.sender === 'user' ? 'You' : 'DrugInfo AI'}
                </span>
                <span>{msg.time}</span>
              </div>
              <p className="leading-relaxed">{msg.text}</p>
              {msg.sender === 'assistant' && (
                <button
                  type="button"
                  onClick={() => speakText(msg.text)}
                  className="inline-flex items-center gap-1 text-[10px] text-teal-400 hover:text-teal-300 font-semibold pt-1 cursor-pointer"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>Replay Audio</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
