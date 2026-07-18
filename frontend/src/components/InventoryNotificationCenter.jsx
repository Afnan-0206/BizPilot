/**
 * InventoryNotificationCenter.jsx
 * Bell icon + slide-in notification panel for the Inventory Dashboard.
 * Uses useNotificationStore for persistence.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell, X, Check, CheckCheck, Trash2,
  AlertTriangle, ShoppingCart, TrendingDown,
  Package, AlertCircle, Wrench
} from 'lucide-react';
import { useNotificationStore } from '../lib/notificationStore';

// ─── Relative time helper ──────────────────────────────────────
function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const secs  = Math.floor(diff / 1000);
  const mins  = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (secs  < 60)  return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-IN');
}

// ─── Notification type config ──────────────────────────────────
const TYPE_CONFIG = {
  out_of_stock:      { icon: AlertTriangle,  color: 'var(--danger)',   bg: 'rgba(248,113,113,0.08)',  border: 'rgba(248,113,113,0.2)',  label: 'Out of Stock',      tab: 'alerts'     },
  low_stock:         { icon: AlertTriangle,  color: 'var(--warning)',  bg: 'rgba(251,191,36,0.08)',   border: 'rgba(251,191,36,0.2)',   label: 'Low Stock',         tab: 'alerts'     },
  insufficient_stock:{ icon: AlertCircle,    color: 'var(--danger)',   bg: 'rgba(248,113,113,0.08)',  border: 'rgba(248,113,113,0.2)',  label: 'Insufficient',      tab: 'alerts'     },
  purchase:          { icon: ShoppingCart,   color: 'var(--accent)',   bg: 'rgba(34,211,238,0.06)',   border: 'rgba(34,211,238,0.2)',   label: 'Purchase',          tab: 'purchases'  },
  restocked:         { icon: Package,        color: 'var(--accent)',   bg: 'rgba(34,211,238,0.06)',   border: 'rgba(34,211,238,0.2)',   label: 'Restocked',         tab: 'purchases'  },
  sale:              { icon: TrendingDown,   color: 'var(--success)',  bg: 'rgba(52,211,153,0.06)',   border: 'rgba(52,211,153,0.2)',   label: 'Sale',              tab: 'sales'      },
  adjustment:        { icon: Wrench,         color: 'var(--text-muted)','bg': 'rgba(85,97,115,0.08)', border: 'rgba(85,97,115,0.2)',   label: 'Adjustment',        tab: 'adjustments'},
};

const TABS = [
  { id: 'all',         label: 'All'         },
  { id: 'alerts',      label: 'Stock Alerts'},
  { id: 'purchases',   label: 'Purchases'   },
  { id: 'sales',       label: 'Sales'       },
  { id: 'adjustments', label: 'Adjustments' },
];

// ─── Single notification card ──────────────────────────────────
function NotificationCard({ notif, onRead }) {
  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG['adjustment'];
  const Icon = cfg.icon;

  return (
    <div
      onClick={() => onRead(notif.id)}
      style={{
        display: 'flex',
        gap: 10,
        padding: '10px 14px',
        cursor: 'pointer',
        borderRadius: 8,
        border: `1px solid ${notif.read ? 'var(--border-subtle)' : cfg.border}`,
        background: notif.read ? 'transparent' : cfg.bg,
        transition: 'background 0.2s, border-color 0.2s',
        position: 'relative',
      }}
    >
      {/* Unread dot */}
      {!notif.read && (
        <div style={{
          position: 'absolute',
          top: 10, right: 12,
          width: 7, height: 7,
          borderRadius: '50%',
          background: cfg.color,
          boxShadow: `0 0 6px ${cfg.color}`,
        }} />
      )}

      {/* Icon */}
      <div style={{
        width: 32, height: 32,
        borderRadius: 8,
        background: notif.read ? 'rgba(255,255,255,0.03)' : cfg.bg,
        border: `1px solid ${notif.read ? 'var(--border-subtle)' : cfg.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={14} color={notif.read ? 'var(--text-muted)' : cfg.color} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 600,
          color: notif.read ? 'var(--text-secondary)' : 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.3, marginBottom: 2,
        }}>
          {notif.title}
        </div>
        <div style={{
          fontSize: 10, color: 'var(--text-muted)',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.4, marginBottom: 4,
        }}>
          {notif.message}
        </div>

        {/* Stock change details */}
        {notif.previousStock !== null && notif.previousStock !== undefined && notif.currentStock !== null && notif.currentStock !== undefined && (
          <div style={{
            display: 'flex', gap: 8,
            fontSize: 9, fontFamily: 'var(--font-mono)',
            color: 'var(--text-dim)',
          }}>
            <span>PREV: {notif.previousStock}</span>
            <span>→</span>
            <span>NOW: {notif.currentStock}</span>
            {notif.quantity !== undefined && notif.quantity !== null && (
              <span style={{ color: cfg.color }}>
                ({notif.type === 'sale' || notif.type === 'adjustment' ? '' : '+'}
                {notif.type === 'sale' ? `-${notif.quantity}` : notif.type === 'adjustment' ? (notif.currentStock - notif.previousStock) : `+${notif.quantity}`})
              </span>
            )}
          </div>
        )}

        {/* Insufficient stock details */}
        {notif.type === 'insufficient_stock' && notif.shortage !== undefined && (
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--danger)', marginTop: 2 }}>
            REQUESTED: {notif.quantity} · AVAILABLE: {notif.availableQuantity} · SHORTAGE: {notif.shortage}
          </div>
        )}

        {/* Document number for sales */}
        {notif.documentNumber && (
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 2 }}>
            DOC: {notif.documentNumber}
          </div>
        )}

        {/* Reason */}
        {notif.reason && (
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 1 }}>
            REASON: {notif.reason}
          </div>
        )}

        {/* Footer row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 5,
        }}>
          <span style={{
            fontSize: 8, fontFamily: 'var(--font-mono)',
            color: 'var(--text-dim)', letterSpacing: '0.4px',
          }}>
            {relativeTime(notif.createdAt)}
          </span>
          <span style={{
            fontSize: 8, fontFamily: 'var(--font-mono)',
            padding: '2px 5px', borderRadius: 4,
            background: notif.read ? 'rgba(255,255,255,0.03)' : cfg.bg,
            border: `1px solid ${notif.read ? 'var(--border-subtle)' : cfg.border}`,
            color: notif.read ? 'var(--text-dim)' : cfg.color,
            letterSpacing: '0.5px',
          }}>
            {cfg.label.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Summary mini-cards ────────────────────────────────────────
function SummaryCards({ notifications }) {
  const out   = notifications.filter(n => n.type === 'out_of_stock').length;
  const low   = notifications.filter(n => n.type === 'low_stock').length;
  const buys  = notifications.filter(n => n.type === 'purchase' || n.type === 'restocked').length;
  const sales = notifications.filter(n => n.type === 'sale').length;
  const unread = notifications.filter(n => !n.read).length;
  const total  = notifications.length;

  const cards = [
    { label: 'Out of Stock', value: out,   color: 'var(--danger)'  },
    { label: 'Low Stock',    value: low,   color: 'var(--warning)' },
    { label: 'Purchases',    value: buys,  color: 'var(--accent)'  },
    { label: 'Sales',        value: sales, color: 'var(--success)' },
  ];

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12, marginBottom: 12 }}>
      {/* Mini stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
        {cards.map(c => (
          <div key={c.label} style={{
            background: 'var(--bg-void)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6, padding: '6px 8px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: c.value > 0 ? c.color : 'var(--text-dim)' }}>
              {c.value}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-dim)', letterSpacing: '0.5px', marginTop: 2 }}>
              {c.label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>
      {/* Totals */}
      <div style={{ display: 'flex', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
        <span>UNREAD: <strong style={{ color: unread > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>{unread}</strong></span>
        <span>TOTAL: <strong style={{ color: 'var(--text-secondary)' }}>{total}</strong></span>
      </div>
    </div>
  );
}

// ─── Main Notification Center ──────────────────────────────────
export default function InventoryNotificationCenter() {
  const { notifications, unreadCount, markRead, markAllRead, clearRead } = useNotificationStore();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const panelRef = useRef(null);
  const btnRef   = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current   && !btnRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Filter notifications by active tab
  const filtered = notifications.filter(n => {
    if (activeTab === 'all') return true;
    const cfg = TYPE_CONFIG[n.type];
    return cfg?.tab === activeTab;
  });

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Bell Button ── */}
      <button
        ref={btnRef}
        onClick={() => setIsOpen(v => !v)}
        className="btn-ghost"
        style={{
          position: 'relative',
          padding: '6px 10px',
          minHeight: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: isOpen ? 'var(--accent)' : undefined,
          borderColor: isOpen ? 'rgba(34,211,238,0.3)' : undefined,
        }}
        aria-label="Inventory notifications"
      >
        <Bell size={14} />
        {/* Unread badge */}
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute',
            top: 3, right: 3,
            minWidth: 16, height: 16,
            borderRadius: '50%',
            background: 'var(--danger)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
            boxShadow: '0 0 6px rgba(248,113,113,0.5)',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </button>

      {/* ── Notification Panel ── */}
      {isOpen && (
        <>
          {/* Backdrop on mobile */}
          <div
            style={{
              display: 'none',
              position: 'fixed', inset: 0, zIndex: 1090,
              background: 'rgba(0,0,0,0.5)',
            }}
            className="notif-backdrop"
            onClick={() => setIsOpen(false)}
          />

          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: 60,
              right: 8,
              width: 'min(400px, calc(100vw - 16px))',
              maxHeight: 'calc(100vh - 80px)',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-card)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(34,211,238,0.05)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1100,
              overflow: 'hidden',
              animation: 'notifPanelIn 0.22s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '14px 16px 10px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-void)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.5px' }}>
                    INVENTORY NOTIFICATIONS
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                    {unreadCount > 0 ? `${unreadCount} new notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  onClick={markAllRead}
                  className="btn-ghost"
                  style={{ fontSize: 10, padding: '3px 8px', minHeight: 24, gap: 4 }}
                >
                  <CheckCheck size={10} /> Mark all read
                </button>
                <button
                  onClick={clearRead}
                  className="btn-ghost"
                  style={{ fontSize: 10, padding: '3px 8px', minHeight: 24, gap: 4, color: 'var(--text-dim)' }}
                >
                  <Trash2 size={10} /> Clear read
                </button>
              </div>
            </div>

            {/* Tab bar */}
            <div style={{
              display: 'flex',
              gap: 2,
              padding: '6px 10px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-void)',
              overflowX: 'auto',
              flexShrink: 0,
            }}>
              {TABS.map(tab => {
                const count = notifications.filter(n => {
                  if (tab.id === 'all') return true;
                  return TYPE_CONFIG[n.type]?.tab === tab.id;
                }).length;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: activeTab === tab.id ? '1px solid rgba(34,211,238,0.3)' : '1px solid transparent',
                      background: activeTab === tab.id ? 'rgba(34,211,238,0.08)' : 'transparent',
                      color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontWeight: 600,
                      cursor: 'pointer',
                      letterSpacing: '0.4px',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab.label} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
                  </button>
                );
              })}
            </div>

            {/* Body — scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
              {/* Summary cards */}
              <SummaryCards notifications={notifications} />

              {/* Notification list */}
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  <Bell size={28} color="var(--text-dim)" style={{ marginBottom: 12, opacity: 0.4 }} />
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    No inventory notifications yet.
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    Stock alerts, purchases, sales, and adjustments will appear here.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filtered.map(n => (
                    <NotificationCard key={n.id} notif={n} onRead={markRead} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
