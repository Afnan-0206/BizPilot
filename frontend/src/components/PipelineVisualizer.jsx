import { useEffect, useState, useRef } from 'react';
import { Brain, Database, Cpu, ShieldCheck, CheckCircle, FileCheck } from 'lucide-react';

const AGENTS = [
  {
    id: 'CAM-01',
    name: 'INTAKE',
    label: 'Intake Agent',
    desc: 'Classifies intent · Extracts entities',
    icon: Brain,
  },
  {
    id: 'CAM-02',
    name: 'CONTEXT',
    label: 'Context Agent',
    desc: 'Fetches business data · Enriches request',
    icon: Database,
  },
  {
    id: 'CAM-03',
    name: 'GENERATE',
    label: 'Generation Agent',
    desc: 'Produces quote · Invoice · Reply',
    icon: Cpu,
  },
  {
    id: 'CAM-04',
    name: 'APPROVAL',
    label: 'Approval Agent',
    desc: 'Verifies value limits · Routes workflow',
    icon: FileCheck,
  },
  {
    id: 'CAM-05',
    name: 'REVIEW',
    label: 'Review Agent',
    desc: 'Verifies pricing · Quantities · Facts',
    icon: ShieldCheck,
  },
];

function getStatus(agentIdx, currentStepIndex, pipelineSteps) {
  if (pipelineSteps.length === 0 && currentStepIndex === -1) return 'idle';
  if (currentStepIndex === -1 && pipelineSteps.length > 0) return 'complete';
  if (agentIdx < currentStepIndex) return 'complete';
  if (agentIdx === currentStepIndex) return 'running';
  return 'idle';
}

function progressPercent(currentStepIndex, pipelineSteps) {
  if (pipelineSteps.length > 0 && currentStepIndex === -1) return 100;
  if (currentStepIndex < 0) return 0;
  return Math.round(((currentStepIndex + 0.5) / 5) * 100);
}

export default function PipelineVisualizer({ isProcessing, pipelineSteps, currentStepIndex, response }) {
  const pct = progressPercent(currentStepIndex, pipelineSteps);
  const allDone = !isProcessing && pipelineSteps.length > 0;
  const idle = !isProcessing && pipelineSteps.length === 0;

  // ── 6. Elapsed Timer — tabular-nums ─────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isProcessing) {
      setElapsed(0);
      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed((Date.now() - start) / 1000);
      }, 50);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (response?.totalDuration) {
        setElapsed(response.totalDuration / 1000);
      } else {
        setElapsed(0);
      }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isProcessing, response]);

  // ── 5. Delivery flash — once on completion ──────────────────────────
  const [flashClass, setFlashClass] = useState('');
  const prevDoneRef = useRef(false);

  useEffect(() => {
    if (allDone && !prevDoneRef.current) {
      setFlashClass('delivery-flash');
      const t = setTimeout(() => setFlashClass(''), 700);
      prevDoneRef.current = true;
      return () => clearTimeout(t);
    }
    if (!allDone) prevDoneRef.current = false;
  }, [allDone]);

  return (
    <div
      className={`card ${flashClass}`}
      style={{
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '10px',
      }}
    >
      {/* ── Header bar ─────────────────────────────────────────── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-void)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 3. dotPulse on status dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '999px',
            background: isProcessing ? 'var(--danger)' : allDone ? 'var(--success)' : 'var(--text-muted)',
            boxShadow: isProcessing ? '0 0 6px var(--danger)' : allDone ? '0 0 6px var(--success)' : 'none',
            animation: isProcessing ? 'dotPulse 1s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px' }}>
            PIPELINE MONITOR
          </span>
        </div>

        {/* 6. Large elapsed timer with tabular-nums via .elapsed-timer class */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '1px' }}>
            ELAPSED
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span className="elapsed-timer" style={{
              color: isProcessing ? 'var(--accent)' : allDone ? 'var(--success)' : 'var(--text-muted)',
              textShadow: isProcessing ? '0 0 8px var(--accent-glow)' : 'none',
            }}>
              {elapsed.toFixed(1)}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>s</span>
          </div>
        </div>
      </div>

      {/* ── Tiles + progress track ──────────────────────────────── */}
      <div style={{ padding: 12, display: 'flex', gap: 12, flex: 1 }}>
        {/* Left progress track */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6 }}>
          <div className="pipeline-track-wrap" style={{ position: 'relative', width: 3, flex: 1 }}>
            <div
              className="pipeline-track-fill"
              style={{ height: `${pct}%`, position: 'absolute', top: 0, left: 0, right: 0 }}
            />
          </div>
        </div>

        {/* Agent feed tiles */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {AGENTS.map((agent, idx) => {
            const status = getStatus(idx, currentStepIndex, pipelineSteps);
            const data = pipelineSteps[idx] || null;
            const Icon = agent.icon;
            const isRunning = status === 'running';
            const isComplete = status === 'complete';
            const isIdle = status === 'idle';

            // ── Visual hierarchy per spec ─────────────────────────────
            // Active: opacity 1, 13px, pulseGlow (via .camera-tile.running CSS)
            // Complete: opacity 0.82, 12px, border #1F6B57
            // Idle: opacity 0.45, 12px, border-subtle, no fill
            const tileOpacity = isRunning ? 1 : isComplete ? 0.82 : 0.45;
            const titleSize = isRunning ? '13px' : '12px';

            // Method badge: "AI" (purple) or "SIMULATED" (gray) or "RULE-BASED" (cyan)
            const method = data?.method;
            const isAI = method === 'gemini';
            const isTemplate = method === 'template' || method === 'rule-based';
            const showBadge = !!method;

            return (
              <div
                key={agent.id}
                className={`camera-tile${isRunning ? ' running' : ''}${isComplete ? ' complete' : ''}`}
                style={{
                  opacity: tileOpacity,
                  borderRadius: '10px',
                }}
              >
                {/* 1. Scanline sweep element */}
                <div className="scanline" />

                {/* REC indicator — running only */}
                {isRunning && (
                  <div className="rec-indicator">
                    <div className="rec-dot" />
                    REC
                  </div>
                )}

                {/* Tile content */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, position: 'relative', zIndex: 2 }}>
                  {/* Icon block */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '6px',
                      background: isRunning
                        ? 'rgba(34,211,238,0.12)'
                        : isComplete
                          ? 'rgba(52,211,153,0.1)'
                          : 'rgba(255,255,255,0.03)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${isRunning ? 'rgba(34,211,238,0.3)' : isComplete ? 'rgba(52,211,153,0.2)' : 'var(--border-subtle)'}`,
                      transition: 'all 0.4s ease',
                    }}>
                      {isComplete
                        ? <CheckCircle size={14} color="var(--success)" />
                        : <Icon size={14} color={isRunning ? 'var(--accent)' : 'var(--text-muted)'} />
                      }
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 8,
                      color: isRunning ? 'var(--accent)' : isComplete ? 'var(--success)' : 'var(--text-muted)',
                      letterSpacing: '0.5px',
                    }}>
                      {agent.id}
                    </div>
                  </div>

                  {/* Text info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: titleSize,
                        fontWeight: 700,
                        color: isRunning ? 'var(--accent)' : isComplete ? 'var(--success)' : 'var(--text-muted)',
                        letterSpacing: '0.5px',
                        transition: 'font-size 0.25s ease, color 0.4s ease',
                      }}>
                        {agent.name}
                      </span>

                      {/* AI / SIMULATED / RULE-BASED badge per spec */}
                      {showBadge && (
                        <span className={isAI ? 'badge-ai' : isTemplate ? 'badge-rule-based' : 'badge-simulated'}
                          style={{ fontFamily: 'var(--font-mono)' }}>
                          {isAI ? '⬡ AI' : isTemplate ? '⚙ RULE-BASED' : '◌ SIMULATED'}
                        </span>
                      )}

                      {data?.duration && (
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          color: 'var(--text-muted)',
                          marginLeft: 'auto',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {(data.duration / 1000).toFixed(2)}s
                        </span>
                      )}
                    </div>

                    {!isIdle && (
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        marginBottom: 4,
                      }}>
                        {agent.desc}
                      </div>
                    )}

                    {/* Output summary — complete */}
                    {isComplete && data?.summary && (
                      <div className="anim-fade-in" style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        color: 'var(--success)',
                        background: 'rgba(52,211,153,0.06)',
                        border: '1px solid rgba(52,211,153,0.15)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        lineHeight: 1.4,
                      }}>
                        ▸ {data.summary}
                      </div>
                    )}

                    {/* Running indicator — 3. dotPulse dots */}
                    {isRunning && (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginLeft: 4 }}>
                          processing
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Review checks row */}
                {isComplete && data?.output?.checks && (
                  <div className="anim-fade-in" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8, paddingLeft: 40 }}>
                    {Object.entries(data.output.checks).map(([k, v]) => (
                      <span
                        key={k}
                        className={`badge ${v ? 'badge-green' : 'badge-red'}`}
                        style={{ fontSize: 8, borderRadius: '6px' }}
                      >
                        {v ? '✓' : '✗'} {k.replace('_verified', '')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── 5. Delivery status — flash triggered above ───────── */}
          {allDone && response && (
            <div className="anim-pop" style={{
              background: 'rgba(52,211,153,0.06)',
              border: '1px solid #1F6B57',
              borderRadius: '10px',
              padding: '8px 12px',
              marginTop: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CheckCircle size={14} color="var(--success)" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--success)' }}>
                  DELIVERED // {elapsed.toFixed(2)}s
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <span className="badge badge-cyan" style={{ borderRadius: '6px' }}>
                  {response.intent?.replace(/_/g, ' ').toUpperCase()}
                </span>
                {response.verified && (
                  <span className="verified-banner" style={{ fontSize: 10, padding: '2px 8px' }}>
                    ✓ VERIFIED
                  </span>
                )}
                {response.regenerated && (
                  <span className="badge badge-purple" style={{ borderRadius: '6px' }}>↺ RETRY</span>
                )}
              </div>
            </div>
          )}

          {/* ── Idle state ──────────────────────────────────────── */}
          {idle && (
            <div style={{
              textAlign: 'center',
              padding: '12px 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-muted)',
              letterSpacing: '1px',
            }}>
              AWAITING INPUT
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
