import { RefreshCw, TrendingUp, Clock, ShieldCheck, Target, Activity, Timer, AlertTriangle, Package } from 'lucide-react';
import { calculateProductStatus } from '../lib/inventoryStore';

const INTENT_CFG = {
  quote_request:   { label: 'Quotations', color: 'var(--warning)',  emoji: '📋' },
  invoice_request: { label: 'Invoices',   color: 'var(--accent)',   emoji: '🧾' },
  customer_query:  { label: 'Queries',    color: 'var(--success)',  emoji: '❓' },
  follow_up:       { label: 'Follow-ups', color: 'var(--purple)',   emoji: '💬' },
  unclear:         { label: 'Unclear',    color: 'var(--danger)',   emoji: '❔' },
};

// ── Time saved calculation ──────────────────────────────────────
// Baseline: 15 min to draft manually (call + WhatsApp + pricing + typing)
// Actual: avgResponseTime in ms → minutes
// Only counts doc intents (quotes + invoices)
function calcTimeSaved(stats) {
  const MANUAL_MINUTES = 15;
  const docCount = (stats.intentCounts?.quote_request || 0) + (stats.intentCounts?.invoice_request || 0);
  if (docCount === 0) return 0;
  const actualMinutes = (stats.avgResponseTime || 0) / 1000 / 60;
  const savedPerDoc = Math.max(0, MANUAL_MINUTES - actualMinutes);
  return Math.round(docCount * savedPerDoc);
}

export default function StatsDashboard({ stats, onRefresh }) {
  if (!stats) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <div className="spinner" style={{ width: 28, height: 28, margin: '0 auto 16px' }} />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          LOADING TELEMETRY...
        </div>
      </div>
    );
  }

  const total = stats.totalRequests;
  const intentTotal = Object.values(stats.intentCounts).reduce((a, b) => a + b, 0);
  const verRate = total > 0 ? Math.round((stats.totalVerified / total) * 100) : 0;
  const timeSavedMin = calcTimeSaved(stats);

  // Read local inventory details from localStorage
  let localProducts = [];
  let localHistory = [];
  try {
    const rawProducts = localStorage.getItem('bizpilot_inventory');
    const rawHistory = localStorage.getItem('bizpilot_stock_history');
    if (rawProducts) localProducts = JSON.parse(rawProducts);
    if (rawHistory) localHistory = JSON.parse(rawHistory);
  } catch (e) {
    console.error(e);
  }

  const totalProds = localProducts.length || 4;
  const totalStockUnits = localProducts.reduce((sum, p) => p.category === 'Service' || p.stock === null ? sum : sum + Number(p.stock), 0) || 29;

  // Use calculateProductStatus for accurate counts consistent with InventoryDashboard
  const physicalProducts = localProducts.filter(p => p.category !== 'Service' && p.stock !== null);
  const outOfStockCount = physicalProducts.filter(p => calculateProductStatus(p) === 'Out of Stock').length;
  const lowStockCount   = physicalProducts.filter(p => calculateProductStatus(p) === 'Low Stock').length;
  const inStockCount    = physicalProducts.filter(p => calculateProductStatus(p) === 'Available').length;

  const stockAwareQuotes = localHistory.filter(h => h.action && (h.action.includes('Checked') || h.action.includes('Deducted'))).length || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Activity size={16} color="var(--accent)" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
              Analytics Dashboard
            </h2>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
            REAL-TIME TELEMETRY // SecureVision Systems
          </div>
        </div>
        <button className="btn-ghost" onClick={onRefresh}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* KPI grid — 5 cards including TIME SAVED */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: 12 }}>
        {[
          {
            icon: <TrendingUp size={18} />,
            label: 'TOTAL REQUESTS',
            value: total,
            suffix: '',
            color: 'var(--accent)',
          },
          {
            icon: <Clock size={18} />,
            label: 'AVG RESPONSE',
            value: stats.avgResponseTime,
            suffix: 'ms',
            color: 'var(--warning)',
          },
          {
            icon: <ShieldCheck size={18} />,
            label: 'VERIFIED',
            value: stats.totalVerified,
            suffix: '',
            color: 'var(--success)',
          },
          {
            icon: <Target size={18} />,
            label: 'VERIFY RATE',
            value: verRate,
            suffix: '%',
            color: '#C084FC',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ color: kpi.color, opacity: 0.8 }}>{kpi.icon}</div>
              <div style={{ width: 6, height: 6, borderRadius: '999px', background: kpi.color, opacity: 0.4 }} />
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {kpi.value.toLocaleString()}
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{kpi.suffix}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 8, letterSpacing: '0.8px' }}>
              {kpi.label}
            </div>
          </div>
        ))}

        {/* ── TIME SAVED card — wide, accent treatment ─────────────── */}
        <div className="stat-card" style={{
          border: '1px solid rgba(52,211,153,0.2)',
          background: 'linear-gradient(135deg, var(--bg-panel), rgba(52,211,153,0.04))',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Subtle glow stripe */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 2,
            background: 'linear-gradient(90deg, transparent, var(--success), transparent)',
            opacity: 0.6,
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ color: 'var(--success)', opacity: 0.9 }}>
              <Timer size={18} />
            </div>
            <div style={{ width: 6, height: 6, borderRadius: '999px', background: 'var(--success)', opacity: 0.5 }} />
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--success)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            ⏱ {timeSavedMin}
            <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(52,211,153,0.6)' }}> min</span>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--success)', marginTop: 8, letterSpacing: '0.8px', opacity: 0.7 }}>
            TIME SAVED THIS SESSION
          </div>

          <div style={{
            marginTop: 8,
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            color: 'var(--text-muted)',
            lineHeight: 1.4,
            borderTop: '1px solid rgba(52,211,153,0.1)',
            paddingTop: 8,
          }}>
            *15 min manual baseline (quote/invoice only)
          </div>
        </div>
      </div>

      {/* ── INVENTORY METRICS section ───────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Package size={14} color="var(--accent)" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px' }}>
            INVENTORY STATUS (LOCAL METRICS)
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: 12 }}>
          {[
            { label: 'TOTAL PRODUCTS', value: totalProds, color: 'var(--accent)' },
            { label: 'TOTAL STOCK UNITS', value: totalStockUnits, color: 'var(--success)' },
            { label: 'IN STOCK', value: inStockCount, color: 'var(--success)' },
            { label: 'LOW STOCK ITEMS', value: lowStockCount, color: 'var(--warning)', highlight: lowStockCount > 0 },
            { label: 'OUT OF STOCK', value: outOfStockCount, color: 'var(--danger)', highlight: outOfStockCount > 0 },
            { label: 'STOCK-AWARE QUOTES', value: stockAwareQuotes, color: '#C084FC' }
          ].map((kpi, idx) => (
            <div key={idx} className="stat-card" style={{
              border: kpi.highlight ? `1px solid ${kpi.color}30` : undefined,
              background: kpi.highlight ? `linear-gradient(135deg, var(--bg-panel), ${kpi.color}02)` : undefined
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ color: kpi.color, opacity: 0.8 }}><Package size={16} /></div>
                <div style={{ width: 6, height: 6, borderRadius: '999px', background: kpi.color, opacity: 0.4 }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: kpi.highlight ? kpi.color : 'var(--text-primary)', lineHeight: 1 }}>
                {kpi.value}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 8, letterSpacing: '0.8px' }}>
                {kpi.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Intent breakdown + Agent performance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Bar chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.5px', marginBottom: 16 }}>
            INTENT BREAKDOWN
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(INTENT_CFG).map(([key, cfg]) => {
              const count = stats.intentCounts[key] || 0;
              const pct = intentTotal > 0 ? (count / intentTotal) * 100 : 0;
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 4, alignItems: 'center' }}>
                      {cfg.emoji} {cfg.label}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {count}
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 400 }}> ({Math.round(pct)}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg-panel-raised)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: cfg.color, borderRadius: '999px',
                      transition: 'width 0.6s ease',
                      boxShadow: `0 0 6px ${cfg.color}60`,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Agent performance */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.5px', marginBottom: 16 }}>
            AGENT PERFORMANCE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Intake Agent',     sub: 'Intent classification', icon: '🧠', val: total },
              { label: 'Context Agent',    sub: 'Data enrichment',       icon: '🗄️', val: total },
              { label: 'Generation Agent', sub: 'Content generation',    icon: '⚡', val: total },
              { label: 'Approval Agent',   sub: 'Validates limits & approval flow', icon: '⚖️', val: total },
              { label: 'Review Agent',     sub: 'Self-verification',     icon: '🛡️', val: stats.totalVerified },
            ].map((a) => (
              <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32, height: 32,
                  background: 'var(--bg-panel-raised)',
                  borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, flexShrink: 0,
                  border: '1px solid var(--border-subtle)',
                }}>
                  {a.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>{a.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{a.sub}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                  {a.val}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent logs */}
      {stats.recentLogs?.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.5px' }}>
              RECENT ACTIVITY
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
              LAST {Math.min(5, stats.recentLogs.length)} OPS
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Message</th>
                  <th>Intent</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentLogs.slice(0, 5).map((log) => {
                  const cfg = INTENT_CFG[log.intent] || INTENT_CFG.unclear;
                  return (
                    <tr key={log.id}>
                      <td style={{ maxWidth: 220 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-primary)' }}>
                          {log.message}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                          {new Date(log.timestamp).toLocaleString('en-IN')}
                        </div>
                      </td>
                      <td><span style={{ color: cfg.color, fontSize: 11 }}>{cfg.emoji} {cfg.label}</span></td>
                      <td>
                        <span className={`badge ${log.status === 'verified' ? 'badge-green' : 'badge-amber'}`}>
                          {log.status === 'verified' ? '✓ OK' : '⚠'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: log.responseTime < 2000 ? 'var(--success)' : 'var(--warning)', fontVariantNumeric: 'tabular-nums' }}>
                        {log.responseTime}ms
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Low Stock Alerts card */}
      {stats.lowStockItems?.length > 0 && (
        <div className="card" style={{
          padding: 0,
          overflow: 'hidden',
          border: '1px solid rgba(251,191,36,0.25)',
          background: 'linear-gradient(135deg, var(--bg-panel), rgba(251,191,36,0.04))',
          position: 'relative',
        }}>
          {/* amber glow stripe */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 2,
            background: 'linear-gradient(90deg, transparent, var(--warning), transparent)',
            opacity: 0.7,
          }} />

          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(251,191,36,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <AlertTriangle size={13} color="var(--warning)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--warning)', letterSpacing: '0.5px' }}>
              LOW STOCK ALERTS
            </span>
            <span style={{
              marginLeft: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-muted)',
            }}>
              {stats.lowStockItems.length} PRODUCT{stats.lowStockItems.length !== 1 ? 'S' : ''} AT OR BELOW THRESHOLD
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {stats.lowStockItems.map((item, idx) => (
              <div key={item.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                borderBottom: idx < stats.lowStockItems.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <div style={{
                  width: 28, height: 28,
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.2)',
                  borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Package size={13} color="var(--warning)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                    {item.id}
                  </div>
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: item.stockQty === 0 ? 'var(--danger)' : 'var(--warning)',
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                }}>
                  {item.stockQty}
                  <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 3 }}>in stock</span>
                </div>
                <div>
                  <span className={`badge ${item.stockQty === 0 ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: 8 }}>
                    {item.stockQty === 0 ? 'OUT OF STOCK' : 'LOW'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
