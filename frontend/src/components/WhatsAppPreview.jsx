import { useState, useEffect, useCallback } from 'react';
import { CheckCheck, Clock, Share2, X, Phone, ExternalLink } from 'lucide-react';

const LANG_META = {
  en: { label: null },
  kn: { label: '🇮🇳 ಕನ್ನಡ', color: '#F59E0B' },
  hi: { label: '🇮🇳 हिंदी', color: '#F59E0B' },
};

// ─── Phone helpers ────────────────────────────────────────────────────────────
function cleanPhoneNumber(input) {
  return input.replace(/\D/g, '');
}

// Phone validation requires at least 10 digits
function isValidPhone(digitsOnly) {
  return digitsOnly.length >= 10;
}

function buildWhatsAppLink(digitsOnly, messageText) {
  // Prepend India country code 91 if the number is exactly 10 digits and has no country code
  const phone = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;
  return `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`;
}

// ─── Share Modal ──────────────────────────────────────────────────────────────
function ShareModal({ isOpen, onClose, messageText, prefillPhone }) {
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isOpening, setIsOpening] = useState(false);

  // Sync pre-fill when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhoneInput(prefillPhone || '');
      setPhoneError('');
      setIsOpening(false);
    }
  }, [isOpen, prefillPhone]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleSend = useCallback(() => {
    if (isOpening) return; // prevent double-open
    const digits = cleanPhoneNumber(phoneInput);
    if (!digits) {
      setPhoneError('Please enter a phone number.');
      return;
    }
    if (!isValidPhone(digits)) {
      setPhoneError('Phone number must have at least 10 digits.');
      return;
    }
    setPhoneError('');
    setIsOpening(true);

    // Open the wa.me link directly with the full formatted text
    const url = buildWhatsAppLink(digits, messageText);
    window.open(url, '_blank');
    
    // Close modal cleanly
    setTimeout(() => {
      setIsOpening(false);
      onClose();
    }, 300);
  }, [phoneInput, messageText, isOpening, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.15s ease',
        }}
      />

      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wa-modal-title"
        style={{
          position: 'fixed', top: '50%', left: '50%', zIndex: 1001,
          transform: 'translate(-50%, -50%)',
          width: 'min(420px, 94vw)',
          background: 'var(--bg-panel)',
          border: '1px solid rgba(34,211,238,0.18)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(34,211,238,0.06)',
          overflow: 'hidden',
          animation: 'slideUp 0.2s ease',
        }}
      >
        {/* Modal header */}
        <div style={{
          background: 'linear-gradient(135deg, #075e54 0%, #128c7e 100%)',
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 18 }}>💬</span>
          </div>
          <div style={{ flex: 1 }}>
            <div id="wa-modal-title" style={{
              fontSize: 14, fontWeight: 700, color: 'white',
              fontFamily: 'var(--font-sans)',
            }}>Send via WhatsApp</div>
            <div style={{
              fontSize: 10, color: 'rgba(255,255,255,0.65)',
              fontFamily: 'var(--font-mono)',
            }}>Opens WhatsApp with the message ready to send</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none', borderRadius: 8,
              width: 30, height: 30, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.8)',
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal body */}
        <div style={{ padding: '18px 20px 20px' }}>
          {/* Message preview — scrollable mini-box */}
          <div style={{
            background: 'rgba(7,94,84,0.06)',
            border: '1px solid rgba(7,94,84,0.2)',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 16,
            maxHeight: 90,
            overflowY: 'auto',
          }}>
            <div style={{
              fontSize: 10, color: 'var(--accent)',
              fontFamily: 'var(--font-mono)', fontWeight: 700,
              marginBottom: 4,
            }}>MESSAGE PREVIEW</div>
            <div style={{
              fontSize: 11, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              lineHeight: 1.45,
            }}>
              {messageText}
            </div>
          </div>

          {/* Honest UI Copy for text preview explanation */}
          <div style={{
            fontSize: '11px',
            color: 'var(--accent)',
            fontFamily: 'var(--font-sans)',
            background: 'rgba(34, 211, 238, 0.04)',
            border: '1px solid rgba(34, 211, 238, 0.15)',
            borderRadius: '6px',
            padding: '8px 10px',
            marginBottom: '14px',
            lineHeight: '1.4',
          }}>
            ℹ️ Opens WhatsApp with your full quotation ready to send — just tap send.
          </div>

          {/* Phone label */}
          <label
            htmlFor="wa-phone-input"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)',
              marginBottom: 8,
            }}
          >
            <Phone size={13} color="var(--accent)" />
            Customer Phone Number
          </label>

          {/* Phone input */}
          <input
            id="wa-phone-input"
            className="input-field"
            type="tel"
            autoComplete="tel"
            placeholder="e.g. 98765 43210  or  +91 98765 43210"
            value={phoneInput}
            onChange={(e) => {
              setPhoneInput(e.target.value);
              if (phoneError) setPhoneError('');
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              marginBottom: phoneError ? 4 : 14,
              borderColor: phoneError ? 'var(--danger)' : undefined,
            }}
            autoFocus
          />

          {/* Inline error */}
          {phoneError && (
            <div style={{
              fontSize: 11, color: 'var(--danger)',
              fontFamily: 'var(--font-sans)',
              marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 13 }}>⚠</span> {phoneError}
            </div>
          )}

          {/* Helper hint */}
          <div style={{
            fontSize: 10, color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginBottom: 16,
            lineHeight: 1.4,
          }}>
            10-digit numbers will automatically get India (+91) prefix.
            Include full country code for international numbers.
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              className="btn-ghost"
              style={{ flex: 1, fontSize: 12 }}
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isOpening}
              className="btn-primary"
              style={{
                flex: 2, fontSize: 12,
                background: isOpening
                  ? 'rgba(34,211,238,0.6)'
                  : 'linear-gradient(135deg, #075e54, #128c7e)',
                gap: 6,
              }}
            >
              {isOpening ? (
                <>
                  <div className="spinner" style={{ width: 12, height: 12, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                  Opening…
                </>
              ) : (
                <>
                  <ExternalLink size={13} />
                  Open WhatsApp
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main WhatsApp Preview Component ─────────────────────────────────────────
export default function WhatsAppPreview({ response, originalMessage, language = 'en' }) {
  const [shareModalOpen, setShareModalOpen] = useState(false);

  if (!response) return null;
  const { generatedOutput, reviewResult } = response;
  const text = generatedOutput?.humanText || '';
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const langMeta = LANG_META[language] || LANG_META.en;

  // Pre-fill phone from intake extraction if available
  const prefillPhone = response.customerPhone || '';

  return (
    <>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* WhatsApp header */}
        <div style={{
          background: 'linear-gradient(135deg, #075e54, #0d6b5e)',
          padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '999px',
            background: 'rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>🔒</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', fontFamily: 'var(--font-sans)' }}>
              SecureVision Systems
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)' }}>
              Business Account · Online
            </div>
          </div>

          {/* Language indicator badge */}
          {langMeta.label && (
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(251,191,36,0.4)',
              borderRadius: '6px',
              padding: '2px 8px',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: '#FBBF24',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {langMeta.label}
            </div>
          )}
        </div>

        {/* Chat background */}
        <div style={{
          background: '#080F18',
          padding: '12px',
          display: 'flex', flexDirection: 'column', gap: 8,
          maxHeight: 260, overflowY: 'auto',
        }}>
          {/* Date chip */}
          <div style={{ textAlign: 'center' }}>
            <span style={{
              background: 'rgba(8,15,24,0.85)',
              color: 'var(--text-muted)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px', borderRadius: '999px',
            }}>
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          {/* User message */}
          {originalMessage && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div className="wa-msg-out">
                {originalMessage}
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textAlign: 'right', marginTop: 4, fontFamily: 'var(--font-mono)', display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
                  {time} <CheckCheck size={11} color="#53bdeb" />
                </div>
              </div>
            </div>
          )}

          {/* AI reply */}
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div className="wa-msg-in">
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                SecureVision Systems
              </div>
              {text}
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', marginTop: 4, fontFamily: 'var(--font-mono)', display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
                <Clock size={9} /> {time}
              </div>
            </div>
          </div>
        </div>

        {/* ── Share on WhatsApp action strip ──────────────────────────────── */}
        {text && (
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid rgba(34,211,238,0.08)',
            background: 'rgba(7,94,84,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8,
          }}>
            <div style={{
              fontSize: 10, color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.3, flex: 1,
            }}>
              Opens WhatsApp with the<br />message ready to send
            </div>
            <button
              id="wa-share-btn"
              className="btn-primary"
              onClick={() => setShareModalOpen(true)}
              style={{
                fontSize: 11,
                padding: '7px 14px',
                minHeight: 36,
                background: 'linear-gradient(135deg, #075e54 0%, #128c7e 100%)',
                gap: 6,
                flexShrink: 0,
              }}
            >
              <Share2 size={13} />
              Share on WhatsApp
            </button>
          </div>
        )}

        {/* Verified strip */}
        {reviewResult?.approved && (
          <div style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 4,
            background: 'rgba(52,211,153,0.04)',
          }}>
            <span className="verified-banner">✓ VERIFIED BY REVIEW AGENT</span>
            {reviewResult.checks && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {Object.entries(reviewResult.checks).map(([k, v]) =>
                  v ? (
                    <span key={k} style={{
                      fontSize: 9, color: 'var(--success)',
                      fontFamily: 'var(--font-mono)',
                      background: 'rgba(52,211,153,0.06)',
                      border: '1px solid rgba(52,211,153,0.15)',
                      padding: '2px 4px', borderRadius: '6px',
                    }}>
                      {k.replace('_verified', '')}
                    </span>
                  ) : null
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share modal — rendered outside the card so it overlays everything */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        messageText={text}
        prefillPhone={prefillPhone}
      />
    </>
  );
}
