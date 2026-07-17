import { useState, useCallback, useEffect, useRef } from 'react';
import { MessageSquare, BarChart2, FileText, X } from 'lucide-react';
import bizpilotIcon from './assets/bizpilot_icon.svg';
import ChatPanel from './components/ChatPanel';
import PipelineVisualizer from './components/PipelineVisualizer';
import WhatsAppPreview from './components/WhatsAppPreview';
import DocumentPreview from './components/DocumentPreview';
import StatsDashboard from './components/StatsDashboard';
import InteractionLogs from './components/InteractionLogs';
import { processMessage, getStats } from './services/api';

const DEMO_MESSAGES = [
  'Need quote for 3 CCTV cameras with installation',
  'Create invoice for 2 CCTV cameras and one DVR',
  'What is your refund policy?',
  'Follow up with customer who asked price yesterday',
];

// ── Responsive hook ──────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

export default function App() {
  const isMobile = useIsMobile();

  // Navigation
  const [activeTab, setActiveTab] = useState('chat');

  // Pipeline state
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [response, setResponse] = useState(null);

  // Chat messages
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      type: 'system',
      text: 'SYSTEM ONLINE // SecureVision AI Copilot v1.0 ready. Submit a request to begin.',
    },
  ]);

  // Stats
  const [stats, setStats] = useState(null);

  // Language selection (EN / KN / HI)
  const [language, setLanguage] = useState('en');

  // Mobile-only UI state
  const [pipelineExpanded, setPipelineExpanded] = useState(false);
  const [docSheetOpen, setDocSheetOpen] = useState(false);
  const [mobileSheetTab, setMobileSheetTab] = useState('document');

  const hasDocument =
    response &&
    (response.intent === 'quote_request' || response.intent === 'invoice_request') &&
    response.generatedOutput?.documentHTML;

  // Auto-default mobile active tab when a new response is loaded
  useEffect(() => {
    if (response) {
      const hasDoc = (response.intent === 'quote_request' || response.intent === 'invoice_request') && response.generatedOutput?.documentHTML;
      setMobileSheetTab(hasDoc ? 'document' : 'whatsapp');
    }
  }, [response]);

  // ── Stats refresh ────────────────────────────────────────
  const refreshStats = useCallback(async () => {
    try { setStats(await getStats()); } catch {}
  }, []);

  useEffect(() => {
    refreshStats();
    const id = setInterval(refreshStats, 12000);
    return () => clearInterval(id);
  }, [refreshStats]);

  // ── Send message ─────────────────────────────────────────
  const handleSend = useCallback(
    async (text, lang) => {
      if (!text.trim() || isProcessing) return;

      setResponse(null);
      setPipelineSteps([]);
      setCurrentStepIndex(0);
      setIsProcessing(true);
      setDocSheetOpen(false);

      // Auto-expand pipeline on mobile
      if (isMobile) setPipelineExpanded(true);

      setMessages((prev) => [
        ...prev,
        { id: Date.now(), type: 'user', text, timestamp: new Date().toISOString() },
      ]);

      try {
        // Simulate step-by-step pipeline animation
        for (let i = 0; i < 5; i++) {
          setCurrentStepIndex(i);
          await new Promise((r) => setTimeout(r, 280));
        }

        const selectedLang = lang || language || 'en';
        const result = await processMessage(text, selectedLang);
        setResponse(result);
        setPipelineSteps(result.pipelineSteps || []);
        setCurrentStepIndex(-1);

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            type: 'ai',
            text: result.generatedOutput?.humanText || 'Done.',
            intent: result.intent,
            verified: result.verified,
          },
        ]);

        // Mobile post-processing
        if (isMobile) {
          setTimeout(() => {
            setDocSheetOpen(true);
            setPipelineExpanded(false);
          }, 800);
        }

        refreshStats();
      } catch (err) {
        setCurrentStepIndex(-1);
        setPipelineSteps([]);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            type: 'error',
            text: `Pipeline error: ${err.message}. Is the backend running on :3001?`,
          },
        ]);
        if (isMobile) setPipelineExpanded(false);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, isMobile, refreshStats, language]
  );

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      {/* ── Header ────────────────────────────────────────── */}
      <header className="site-header">
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src={bizpilotIcon}
                alt="BizPilot AI icon"
                width={36}
                height={36}
                style={{ display: 'block', flexShrink: 0, imageRendering: 'crisp-edges' }}
              />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.2px', fontFamily: 'var(--font-sans)' }}>
                  <span style={{ color: 'var(--text-primary)' }}>BizPilot</span>
                  <span style={{ color: 'var(--cyan)' }}> AI</span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '1.5px' }}>
                  Customer Messages → Quotes & Invoices
                </div>
              </div>
            </div>

            {/* Desktop nav */}
            <nav className="top-nav-row" style={{ display: 'flex', gap: 4 }}>
              {[
                { id: 'chat', label: 'AI Copilot', icon: MessageSquare },
                { id: 'stats', label: 'Dashboard', icon: BarChart2 },
                { id: 'logs', label: 'Logs', icon: FileText },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`tab-btn${activeTab === id ? ' active' : ''}`}
                  onClick={() => setActiveTab(id)}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </nav>

            {/* Status pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-muted)',
                textAlign: 'right',
                display: isMobile ? 'none' : 'block',
              }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>SecureVision Systems</div>
                <div>{stats ? `${stats.totalRequests} ops` : 'READY'}</div>
              </div>
              <div style={{
                width: 8, height: 8, borderRadius: '999px',
                background: 'var(--success)',
                boxShadow: '0 0 6px var(--success)',
                animation: 'dotPulse 1s ease-in-out infinite',
              }} />
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────── */}
      <div className="main-content-area" style={{ flex: 1, maxWidth: 1440, margin: '0 auto', width: '100%', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {activeTab === 'chat' && (
          <>
            {/* ── DESKTOP LAYOUT ──────────────────────────── */}
            <div style={{ display: isMobile ? 'none' : 'flex', gap: 16, flex: 1, minHeight: 0 }}>
              {/* Chat — primary / widest */}
              <div style={{ flex: '0 0 48%', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                <SectionLabel icon="💬" title="CUSTOMER CHAT" sub="Natural language input" />
                <ChatPanel
                  messages={messages}
                  onSend={handleSend}
                  isProcessing={isProcessing}
                  demoMessages={DEMO_MESSAGES}
                  language={language}
                  onLanguageChange={setLanguage}
                />
              </div>

              {/* Pipeline — secondary */}
              <div className="desktop-pipeline" style={{ flex: '0 0 26%', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                <SectionLabel icon="📡" title="AGENT PIPELINE" sub="Live execution feed" />
                <PipelineVisualizer
                  isProcessing={isProcessing}
                  pipelineSteps={pipelineSteps}
                  currentStepIndex={currentStepIndex}
                  response={response}
                />
                {response && (
                  <>
                    <SectionLabel icon="📱" title="WHATSAPP PREVIEW" sub="Customer reply" />
                <WhatsAppPreview
                      response={response}
                      originalMessage={[...messages].reverse().find((m) => m.type === 'user')?.text || ''}
                      language={language}
                    />
                  </>
                )}
              </div>

              {/* Document — tertiary, slides in when relevant */}
              <div
                className="desktop-docpanel"
                style={{
                  flex: hasDocument ? '0 0 26%' : '0 0 0%',
                  maxWidth: hasDocument ? 420 : 0,
                  overflow: 'hidden',
                  transition: 'flex 0.38s cubic-bezier(0.4,0,0.2,1), max-width 0.38s cubic-bezier(0.4,0,0.2,1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  minWidth: 0,
                }}
              >
                {hasDocument && (
                  <>
                    <SectionLabel icon="📄" title="DOCUMENT PREVIEW" sub="Quote / Invoice" />
                    <DocumentPreview response={response} />
                  </>
                )}
              </div>
            </div>

            {/* ── MOBILE LAYOUT ──────────────────────────── */}
            {isMobile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Chat widget */}
                <SectionLabel icon="💬" title="CUSTOMER CHAT" sub="Natural language input" />
                <ChatPanel
                  messages={messages}
                  onSend={handleSend}
                  isProcessing={isProcessing}
                  demoMessages={DEMO_MESSAGES}
                  language={language}
                  onLanguageChange={setLanguage}
                />

                {/* Pipeline accordion */}
                <div className="mobile-pipeline">
                  <div
                    className={`accordion-header${isProcessing ? ' running' : ''}`}
                    onClick={() => !isProcessing && setPipelineExpanded((v) => !v)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && !isProcessing && setPipelineExpanded((v) => !v)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>📡</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: isProcessing ? 'var(--cyan)' : 'var(--text-primary)' }}>
                          AGENT PIPELINE
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {isProcessing ? 'PROCESSING...' : pipelineSteps.length > 0 ? 'COMPLETE' : 'AWAITING INPUT'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isProcessing && <div className="spinner" style={{ width: 16, height: 16 }} />}
                      <span style={{
                        fontSize: 16, color: 'var(--text-muted)',
                        transform: pipelineExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.25s',
                        display: 'inline-block',
                      }}>▾</span>
                    </div>
                  </div>
                  <div
                    className="accordion-body"
                    style={{
                      maxHeight: pipelineExpanded ? 800 : 0,
                      opacity: pipelineExpanded ? 1 : 0,
                      paddingTop: pipelineExpanded ? 10 : 0,
                    }}
                  >
                    <PipelineVisualizer
                      isProcessing={isProcessing}
                      pipelineSteps={pipelineSteps}
                      currentStepIndex={currentStepIndex}
                      response={response}
                    />
                    {response && (
                      <div style={{ marginTop: 10 }}>
                        <WhatsAppPreview
                          response={response}
                          originalMessage={[...messages].reverse().find((m) => m.type === 'user')?.text || ''}
                          language={language}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'stats' && <StatsDashboard stats={stats} onRefresh={refreshStats} />}
        {activeTab === 'logs' && <InteractionLogs onRefresh={refreshStats} />}
      </div>

      {/* ── Mobile bottom tab bar ──────────────────────────── */}
      <nav className="bottom-nav">
        {[
          { id: 'chat', label: 'Copilot', icon: MessageSquare },
          { id: 'stats', label: 'Dashboard', icon: BarChart2 },
          { id: 'logs', label: 'Logs', icon: FileText },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`bottom-nav-btn${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>

      {/* ── Mobile document bottom sheet ──────────────────── */}
      {isMobile && docSheetOpen && response && (
        <>
          <div className="sheet-backdrop" onClick={() => setDocSheetOpen(false)} />
          <div className="sheet-panel">
            <div className="sheet-handle" />
            
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--cyan)' }}>
                {mobileSheetTab === 'document' ? '📄 DOCUMENT PREVIEW' : '📱 WHATSAPP PREVIEW'}
              </div>
              <button
                onClick={() => setDocSheetOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Tab Selector Switcher (shown only when document exists) */}
            {hasDocument && (
              <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-void)' }}>
                <button
                  className={`tab-btn${mobileSheetTab === 'document' ? ' active' : ''}`}
                  onClick={() => setMobileSheetTab('document')}
                  style={{ flex: 1, justifyContent: 'center', minHeight: 36 }}
                >
                  Document
                </button>
                <button
                  className={`tab-btn${mobileSheetTab === 'whatsapp' ? ' active' : ''}`}
                  onClick={() => setMobileSheetTab('whatsapp')}
                  style={{ flex: 1, justifyContent: 'center', minHeight: 36 }}
                >
                  WhatsApp Message
                </button>
              </div>
            )}

            {/* Content area */}
            <div style={{ padding: '12px 16px 24px', overflowY: 'auto', maxHeight: 'calc(80vh - 100px)' }}>
              {mobileSheetTab === 'document' && hasDocument ? (
                <DocumentPreview response={response} />
              ) : (
                <WhatsAppPreview
                  response={response}
                  originalMessage={[...messages].reverse().find((m) => m.type === 'user')?.text || ''}
                  language={language}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SectionLabel({ icon, title, sub }) {
  return (
    <div className="section-label">
      <div className="section-label-icon" style={{ fontSize: 14 }}>{icon}</div>
      <div>
        <div className="section-label-title">{title}</div>
        <div className="section-label-sub">{sub}</div>
      </div>
    </div>
  );
}
