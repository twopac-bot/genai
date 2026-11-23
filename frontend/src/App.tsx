import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Search,
  Camera,
  Layers,
  Network,
  Clock,
  Scale,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import { MedicationResearchResponse } from './types/medication';
import { api } from './services/api';

// Pages
import { Dashboard } from './pages/Dashboard';
import { ChatView } from './components/ChatView';
import { MedicineScannerPage } from './pages/MedicineScannerPage';
import { InteractionExplorerPage } from './pages/InteractionExplorerPage';
import { KnowledgeGraphPage } from './pages/KnowledgeGraphPage';
import { ExpiryTrackerPage } from './pages/ExpiryTrackerPage';
import { Compare } from './pages/Compare';
import { History } from './pages/History';
import { Settings } from './pages/Settings';

export type TabKey =
  | 'dashboard'
  | 'assistant'
  | 'scanner'
  | 'interactions'
  | 'graph'
  | 'cabinet'
  | 'compare'
  | 'history'
  | 'settings';

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [sessionId, setSessionId] = useState<string>(
    () => 'session-' + Math.random().toString(36).substring(2, 9)
  );

  const [activeResearch, setActiveResearch] = useState<MedicationResearchResponse | null>(null);
  const [compareMedA, setCompareMedA] = useState('Paracetamol');
  const [compareMedB, setCompareMedB] = useState('Ibuprofen');
  const [cabinetExpiringCount, setCabinetExpiringCount] = useState<number>(0);
  const [activeLanguage, setActiveLanguage] = useState<'en' | 'hi' | 'te'>('en');

  // Load cabinet items to count expiring soon
  useEffect(() => {
    async function checkExpiring() {
      try {
        const items = await api.getCabinetItems(sessionId);
        const criticalOrSoon = items.filter(
          (i: any) => i.expiry_status === 'expiring_critical' || i.expiry_status === 'expiring_soon'
        );
        setCabinetExpiringCount(criticalOrSoon.length);
      } catch (e) {
        // quiet fallback
      }
    }
    checkExpiring();
  }, [sessionId, activeTab]);

  const handleSelectRecordFromHistory = async (requestId: string) => {
    try {
      const record = await api.getResearchRecord(requestId);
      if (record && record.summary) {
        setActiveResearch(record.summary);
        setActiveTab('assistant');
      }
    } catch (err: any) {
      alert(`Could not open saved record: ${err.message}`);
    }
  };

  const handleInitiateCompare = (medicineName: string, secondMedicine: string = 'Ibuprofen') => {
    setCompareMedA(medicineName);
    setCompareMedB(secondMedicine);
    setActiveTab('compare');
  };

  const handleViewMonographFromScanner = (monograph: MedicationResearchResponse) => {
    setActiveResearch(monograph);
    setActiveTab('assistant');
  };

  const NAV_ITEMS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'assistant', label: 'AI Assistant', icon: Search },
    { key: 'scanner', label: 'Scanner', icon: Camera },
    { key: 'interactions', label: 'Interactions', icon: Layers },
    { key: 'graph', label: 'Knowledge Graph', icon: Network },
    { key: 'cabinet', label: 'Expiry Tracker', icon: Clock },
    { key: 'compare', label: 'Compare', icon: Scale },
    { key: 'history', label: 'History', icon: HistoryIcon },
    { key: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0b1015] text-slate-100 selection:bg-teal-500/20 selection:text-teal-200">
      {/* Primary Top Header */}
      <header className="bg-[#0e1620] border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Brand Logo & Tag */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => setActiveTab('dashboard')}
              className="cursor-pointer font-extrabold text-base tracking-tight text-white hover:text-teal-400 transition-colors flex items-center gap-2"
            >
              <div className="w-7 h-7 rounded-lg bg-teal-600/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span>druginfo ai</span>
            </div>
            <span className="hidden md:inline-block text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60">
              Clinical Intelligence
            </span>
          </div>

          {/* Center Navigation Bar (Scrollable on small displays) */}
          <nav className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none max-w-2xl">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-teal-950 text-teal-300 border border-teal-600/60 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Header Utilities: Language Selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#131d27] border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
              <Globe className="w-3.5 h-3.5 text-teal-400 mr-1.5" />
              <select
                aria-label="Language"
                value={activeLanguage}
                onChange={(e) => setActiveLanguage(e.target.value as any)}
                className="bg-transparent text-slate-300 font-semibold text-xs border-none outline-none cursor-pointer"
              >
                <option value="en" className="bg-[#0e1620] text-white">EN</option>
                <option value="hi" className="bg-[#0e1620] text-white">हिन्दी</option>
                <option value="te" className="bg-[#0e1620] text-white">తెలుగు</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">
        {activeTab === 'dashboard' && (
          <Dashboard
            onNavigateTab={(tab) => {
              if (tab === 'voice' || tab === 'documents') {
                setActiveTab('assistant');
              } else {
                setActiveTab(tab as TabKey);
              }
            }}
            onInitiateCompare={handleInitiateCompare}
            cabinetExpiringCount={cabinetExpiringCount}
          />
        )}

        {activeTab === 'assistant' && (
          <ChatView
            sessionId={sessionId}
            onOpenCompare={handleInitiateCompare}
            initialResearch={activeResearch}
          />
        )}

        {activeTab === 'scanner' && (
          <MedicineScannerPage
            sessionId={sessionId}
            onViewMonograph={handleViewMonographFromScanner}
          />
        )}

        {activeTab === 'interactions' && (
          <InteractionExplorerPage
            sessionId={sessionId}
          />
        )}

        {activeTab === 'graph' && (
          <KnowledgeGraphPage
            sessionId={sessionId}
            initialMedicine={activeResearch?.medicine?.display_name || 'Ibuprofen'}
          />
        )}

        {activeTab === 'cabinet' && (
          <ExpiryTrackerPage
            sessionId={sessionId}
          />
        )}

        {activeTab === 'compare' && (
          <Compare
            sessionId={sessionId}
            initialMedA={compareMedA}
            initialMedB={compareMedB}
          />
        )}

        {activeTab === 'history' && (
          <History
            sessionId={sessionId}
            onSelectRecord={handleSelectRecordFromHistory}
            onSelectMedicine={(med) => handleInitiateCompare(med)}
          />
        )}

        {activeTab === 'settings' && (
          <Settings
            sessionId={sessionId}
            onUpdateSessionId={setSessionId}
          />
        )}
      </main>
    </div>
  );
}

export default App;
