import { useState } from 'react';
import { Download, FileText, Receipt, AlertCircle, Printer } from 'lucide-react';
import { generateAndDownloadPDF } from '../lib/pdfGenerator';

export default function DocumentPreview({ response }) {
  const [downloaded, setDownloaded] = useState(false);

  if (!response) {
    return (
      <div className="card" style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, minHeight: 320, textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56,
          background: 'rgba(34,211,238,0.06)',
          border: '1px solid rgba(34,211,238,0.12)',
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <FileText size={24} color="rgba(34,211,238,0.25)" />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.5px' }}>
          NO DOCUMENT
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 180 }}>
          Request a quote or invoice to generate a document
        </div>
      </div>
    );
  }

  const { generatedOutput, intent, reviewResult } = response;
  const hasDoc =
    ['quote_request', 'invoice_request'].includes(intent) && generatedOutput?.documentHTML;

  // Text-only response (query / follow-up)
  if (!hasDoc) {
    return (
      <div className="card" style={{ padding: 16, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <AlertCircle size={14} color="var(--accent)" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.5px' }}>
            TEXT RESPONSE
          </span>
        </div>
        <div style={{
          background: 'var(--bg-panel-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: 12,
          fontSize: 13,
          lineHeight: 1.8,
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap',
        }}>
          {generatedOutput?.humanText}
        </div>
      </div>
    );
  }

  const isInvoice = intent === 'invoice_request';
  const { docNumber, financials, items, customer } = generatedOutput;
  const business = response.pipelineSteps?.[1]?.output?.business || {
    name: 'SecureVision Systems',
    type: 'CCTV & Security Solutions',
    phone: '+91 98765 43210',
    email: 'info@securevision.in',
    gst: '29AAAAA0000A1Z5',
    address: 'Indiranagar, Bengaluru, KA'
  };

  // ─── Option B: jsPDF Programmatic PDF Generator ──────────────────────────────
  const handleDownloadPDF = () => {
    generateAndDownloadPDF(response);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(generatedOutput.documentHTML);
    win.document.close();
    win.print();
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-void)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32,
            background: isInvoice ? 'rgba(52,211,153,0.08)' : 'rgba(34,211,238,0.08)',
            borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${isInvoice ? 'rgba(52,211,153,0.2)' : 'rgba(34,211,238,0.2)'}`,
          }}>
            {isInvoice
              ? <Receipt size={14} color="var(--success)" />
              : <FileText size={14} color="var(--accent)" />
            }
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: isInvoice ? 'var(--success)' : 'var(--accent)' }}>
              {isInvoice ? 'INVOICE' : 'QUOTATION'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
              {docNumber}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={handlePrint} style={{ fontSize: 11, minHeight: 36 }}>
            <Printer size={12} /> Print
          </button>
          <button className="btn-primary" onClick={handleDownloadPDF} style={{ fontSize: 11, minHeight: 36 }}>
            <Download size={12} />
            {downloaded ? '✓ Saved PDF' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Totals strip */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', gap: 0,
        background: 'var(--bg-panel-raised)',
      }}>
        {[
          { label: 'SUBTOTAL', val: `₹${financials?.subtotal?.toLocaleString('en-IN')}` },
          ...(financials?.discountAmount > 0 ? [{ label: `LOYALTY (-${financials.discountPercent}%)`, val: `-₹${financials.discountAmount?.toLocaleString('en-IN')}`, isDiscount: true }] : []),
          { label: 'GST 18%',  val: `₹${financials?.taxAmount?.toLocaleString('en-IN')}` },
          { label: 'TOTAL',    val: `₹${financials?.total?.toLocaleString('en-IN')}`, accent: true },
        ].map((s, i, arr) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none', padding: '0 8px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: s.isDiscount ? 'rgba(52,211,153,0.7)' : 'var(--text-muted)', letterSpacing: '0.8px', marginBottom: 4 }}>
              {s.label}
            </div>
            <div className={s.isDiscount ? 'discount-reveal' : ''} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: s.isDiscount ? 'var(--success)' : (s.accent ? 'var(--accent)' : 'var(--text-primary)')
            }}>
              {s.val}
            </div>
          </div>
        ))}
      </div>

      {/* Items table */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ textAlign: 'center', width: 40 }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Rate</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, i) => (
              <tr key={i}>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{item.description}</div>
                </td>
                <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>₹{item.price?.toLocaleString('en-IN')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ₹{item.lineTotal?.toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Key terms */}
        <div style={{ margin: '8px 12px 12px', padding: '12px', background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.08)', borderRadius: '6px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.8px', marginBottom: 8 }}>KEY TERMS</div>
          {[
            '50% advance · balance after installation',
            '1-year warranty on all products & workmanship',
            isInvoice ? 'Tax invoice as per GST norms' : 'Valid 30 days from issue date',
          ].map((t, i) => (
            <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', padding: '2px 0' }}>
              ▸ {t}
            </div>
          ))}
        </div>
      </div>

      {/* Verified strip */}
      {(reviewResult?.approved || response.verified) && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 4,
          background: 'rgba(52,211,153,0.04)',
        }}>
          <span className="verified-banner">✓ VERIFIED BY REVIEW AGENT</span>
          {reviewResult?.checks && (
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
  );
}
