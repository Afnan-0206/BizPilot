import { useEffect, useState } from 'react';
import { RefreshCw, Download, Search, Terminal } from 'lucide-react';
import { getLogs } from '../services/api';

const INTENT_CFG = {
  quote_request:   { label: 'QUOTE',    color: 'var(--warning)',  emoji: '📋' },
  invoice_request: { label: 'INVOICE',  color: 'var(--accent)',   emoji: '🧾' },
  customer_query:  { label: 'QUERY',    color: 'var(--success)',  emoji: '❓' },
  follow_up:       { label: 'FOLLOW-UP',color: 'var(--purple)',   emoji: '💬' },
  unclear:         { label: 'UNCLEAR',  color: 'var(--danger)',   emoji: '❔' },
};

export default function InteractionLogs({ onRefresh }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterIntent, setFilterIntent] = useState('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getLogs();
      setLogs(data.logs || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = logs.filter((log) => {
    const matchSearch = !search || log.message.toLowerCase().includes(search.toLowerCase());
    const matchIntent = filterIntent === 'all' || log.intent === filterIntent;
    return matchSearch && matchIntent;
  });

  const exportCSV = () => {
    const headers = ['ID', 'Timestamp', 'Message', 'Intent', 'Status', 'Review', 'ResponseTime', 'Regenerated'];
    const rows = filtered.map((l) => [
      l.id, l.timestamp, `"${l.message}"`, l.intent, l.status, l.reviewResult, `${l.responseTime}ms`, l.regenerated,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bizpilot-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Terminal size={16} color="var(--accent)" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>Interaction Logs</h2>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
            FULL AUDIT TRAIL // {logs.length} RECORDS
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={fetchLogs}>
            <RefreshCw size={13} /> Refresh
          </button>
          {filtered.length > 0 && (
            <button className="btn-ghost" onClick={exportCSV}>
              <Download size={13} /> CSV
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages..."
            style={{ paddingLeft: 34, fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
        </div>
        <select
          className="input-field"
          value={filterIntent}
          onChange={(e) => setFilterIntent(e.target.value)}
          style={{ width: 170, fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}
        >
          <option value="all">ALL INTENTS</option>
          {Object.entries(INTENT_CFG).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              LOADING RECORDS...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
              {search || filterIntent !== 'all' ? 'NO MATCHING RECORDS' : 'NO INTERACTIONS YET'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Timestamp</th>
                  <th>Message</th>
                  <th>Intent</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Retry</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, idx) => {
                  const cfg = INTENT_CFG[log.intent] || INTENT_CFG.unclear;
                  return (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: 11 }}>
                        {filtered.length - idx}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                          {new Date(log.timestamp).toLocaleDateString('en-IN')}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour12: false })}
                        </div>
                      </td>
                      <td style={{ maxWidth: 240 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-primary)' }}>
                          {log.message}
                        </div>
                      </td>
                      <td>
                        <span style={{ color: cfg.color, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                          {cfg.emoji} {cfg.label}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${log.status === 'verified' ? 'badge-green' : 'badge-amber'}`}>
                          {log.status === 'verified' ? '✓ OK' : '⚠'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: log.responseTime < 2000 ? 'var(--success)' : 'var(--warning)', fontVariantNumeric: 'tabular-nums' }}>
                        {log.responseTime}ms
                      </td>
                      <td>
                        <span className={`badge ${log.regenerated ? 'badge-purple' : 'badge-cyan'}`} style={{ fontSize: 9 }}>
                          {log.regenerated ? '↺ RETRY' : '1ST'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', letterSpacing: '0.5px' }}>
          {filtered.length} / {logs.length} RECORDS
        </div>
      )}
    </div>
  );
}
