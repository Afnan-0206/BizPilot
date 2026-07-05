import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, CheckCircle, AlertCircle, Zap, Globe } from 'lucide-react';

const INTENT_BADGE = {
  quote_request:   { cls: 'badge-amber',  label: 'QUOTE' },
  invoice_request: { cls: 'badge-cyan',   label: 'INVOICE' },
  customer_query:  { cls: 'badge-green',  label: 'QUERY' },
  follow_up:       { cls: 'badge-purple', label: 'FOLLOW-UP' },
  unclear:         { cls: 'badge-red',    label: 'UNCLEAR' },
};

const LANGUAGES = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'kn', label: 'ಕನ್ನಡ', full: 'Kannada' },
  { code: 'hi', label: 'हिंदी', full: 'Hindi' },
];

export default function ChatPanel({ messages, onSend, isProcessing, demoMessages, language, onLanguageChange }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    const val = input.trim();
    if (val && !isProcessing) {
      onSend(val, language);
      setInput('');
      textareaRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* ── Agent header ──────────────────────────────────── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-void)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, rgba(13,34,64,0.8), rgba(14,116,144,0.6))',
            borderRadius: '999px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(34,211,238,0.2)',
            flexShrink: 0,
          }}>
            <Bot size={15} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
              BizPilot Assistant
            </div>
            <div style={{
              fontSize: 10, fontFamily: 'var(--font-mono)',
              display: 'flex', alignItems: 'center', gap: 4,
              color: 'var(--success)',
            }}>
              <span style={{ width: 4, height: 4, borderRadius: '999px', background: 'var(--success)', display: 'inline-block', animation: 'dotPulse 1s ease-in-out infinite' }} />
              ONLINE · SecureVision Systems
            </div>
          </div>
        </div>

        {/* Language selector */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <Globe size={9} color="var(--text-muted)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              REPLY LANG
            </span>
          </div>
          <div className="lang-selector">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                className={`lang-btn${language === lang.code ? ' active' : ''}`}
                onClick={() => onLanguageChange && onLanguageChange(lang.code)}
                title={lang.full}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Demo queries ────────────────────────────────────── */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-muted)',
          letterSpacing: '1px',
          marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Zap size={9} color="var(--accent)" />
          QUICK DEMO
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {demoMessages.map((msg, i) => (
            <button
              key={i}
              className="demo-chip"
              onClick={() => !isProcessing && onSend(msg, language)}
              disabled={isProcessing}
            >
              {msg}
            </button>
          ))}
        </div>
      </div>

      {/* ── Messages ──────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 180,
      }}>
        {messages.map((msg) => (
          <Bubble key={msg.id} msg={msg} />
        ))}

        {/* Typing indicator */}
        {isProcessing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="anim-fade-in">
            <div style={{
              width: 26, height: 26,
              background: 'linear-gradient(135deg, rgba(13,34,64,0.8), rgba(14,116,144,0.6))',
              borderRadius: '999px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(34,211,238,0.15)',
              flexShrink: 0,
            }}>
              <Bot size={13} color="var(--accent)" />
            </div>
            <div style={{
              background: 'var(--bg-panel-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px 10px 10px 10px',
              padding: '8px 12px',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginLeft: 4 }}>
                PIPELINE RUNNING
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input form ────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)' }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            className="input-field"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a business request..."
            disabled={isProcessing}
            style={{
              flex: 1,
              resize: 'none',
              minHeight: 44,
              maxHeight: 96,
              overflowY: 'auto',
              lineHeight: 1.5,
            }}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={!input.trim() || isProcessing}
            style={{ padding: '8px 12px', minWidth: 44, minHeight: 44, flexShrink: 0 }}
          >
            {isProcessing
              ? <div className="spinner" style={{ width: 16, height: 16 }} />
              : <Send size={15} />
            }
          </button>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-muted)',
          marginTop: 4,
          paddingLeft: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>ENTER to send · SHIFT+ENTER for newline</span>
          {language !== 'en' && (
            <span style={{ color: 'var(--accent)', fontSize: 9 }}>
              Reply in {LANGUAGES.find(l => l.code === language)?.full}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

function Bubble({ msg }) {
  if (msg.type === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'flex-end' }}>
        <div className="bubble-user">{msg.text}</div>
        <div style={{
          width: 26, height: 26,
          background: 'rgba(34,211,238,0.08)',
          borderRadius: '999px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(34,211,238,0.15)',
          flexShrink: 0,
        }}>
          <User size={13} color="var(--accent)" />
        </div>
      </div>
    );
  }

  if (msg.type === 'system') {
    return <div className="bubble-system">{msg.text}</div>;
  }

  if (msg.type === 'error') {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <AlertCircle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: 3 }} />
        <div className="bubble-error">{msg.text}</div>
      </div>
    );
  }

  // AI message
  const cfg = INTENT_BADGE[msg.intent] || INTENT_BADGE.unclear;
  const preview = msg.text?.length > 280 ? msg.text.substring(0, 280) + '…' : msg.text;

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div style={{
        width: 26, height: 26,
        background: 'linear-gradient(135deg, rgba(13,34,64,0.8), rgba(14,116,144,0.6))',
        borderRadius: '999px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid rgba(34,211,238,0.15)',
        flexShrink: 0,
      }}>
        <Bot size={13} color="var(--accent)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="bubble-ai">{preview}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {msg.intent && (
            <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
          )}
          {msg.verified && (
            <span className="verified-banner">
              <CheckCircle size={8} /> VERIFIED
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
