import { useState, useCallback } from 'react';
import { Package, Plus, Edit2, ArrowUpRight, History, Trash2, X, AlertTriangle, RefreshCw, Bell } from 'lucide-react';
import { useInventoryStore } from '../lib/inventoryStore';
import InventoryNotificationCenter from './InventoryNotificationCenter';

// ── Minimal Toast Component ───────────────────────────────────
function StockToast({ toasts, onRemove }) {
  return (
    <div className="stock-toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`stock-toast ${t.type}${t.exiting ? ' exiting' : ''}`}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>{t.type === 'out-of-stock' ? '🚫' : '⚠️'}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => onRemove(t.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: 0, flexShrink: 0, lineHeight: 1 }}
          ><X size={12} /></button>
        </div>
      ))}
    </div>
  );
}

export default function InventoryDashboard() {
  const {
    products,
    stockHistory,
    addProduct,
    updateProduct,
    deleteProduct,
    addStock,
    getProductStats,
    resetInventoryToDefaults
  } = useInventoryStore();

  const stats = getProductStats();

  // Toast state
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 280);
    }, 3500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 280);
  }, []);

  // Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState(null);
  const [stockArrivedInput, setStockArrivedInput] = useState('');
  const [stockReason, setStockReason] = useState('New stock purchased');

  // Form Fields State (for Add/Edit Modal)
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Camera');
  const [formStock, setFormStock] = useState('0');
  const [formPrice, setFormPrice] = useState('0');
  const [formGst, setFormGst] = useState('18');
  const [formWarranty, setFormWarranty] = useState('1 year');
  const [formDescription, setFormDescription] = useState('');
  const [formLowStockThreshold, setFormLowStockThreshold] = useState('5');
  const [formAliases, setFormAliases] = useState('');

  // Open Edit Product
  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormStock(p.stock !== null ? String(p.stock) : '0');
    setFormPrice(String(p.price));
    setFormGst(String(p.gst));
    setFormWarranty(p.warranty || '1 year');
    setFormDescription(p.description || '');
    setFormLowStockThreshold(p.lowStockThreshold !== null ? String(p.lowStockThreshold) : '5');
    setFormAliases(p.aliases ? p.aliases.join(', ') : '');
    setIsProductModalOpen(true);
  };

  // Open Add Product
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCategory('Camera');
    setFormStock('10');
    setFormPrice('1000');
    setFormGst('18');
    setFormWarranty('1 year');
    setFormDescription('');
    setFormLowStockThreshold('3');
    setFormAliases('');
    setIsProductModalOpen(true);
  };

  // Save Product Form
  const handleSaveProduct = (e) => {
    e.preventDefault();
    const cleanAliases = formAliases
      .split(',')
      .map(a => a.trim().toLowerCase())
      .filter(a => a.length > 0);

    const newStock = formCategory === 'Service' ? null : Number(formStock);
    const threshold = formCategory === 'Service' ? null : Number(formLowStockThreshold);

    const productData = {
      name: formName,
      category: formCategory,
      stock: newStock,
      price: Number(formPrice),
      gst: Number(formGst),
      warranty: formWarranty,
      description: formDescription,
      lowStockThreshold: threshold,
      aliases: cleanAliases
    };

    if (editingProduct) {
      // Pass _reason for the notification system when stock changes
      const prevStock = editingProduct.stock;
      const stockChanged = formCategory !== 'Service' && newStock !== null && newStock !== prevStock;
      updateProduct(editingProduct.id, {
        ...productData,
        _reason: stockChanged ? (newStock === 0 ? 'Stock set to zero' : newStock < (prevStock || 0) ? 'Manual correction' : 'Stock adjusted') : undefined,
      });
      // Toast on stock state change
      if (formCategory !== 'Service' && newStock !== null) {
        if (newStock === 0) {
          showToast(`${formName} is now out of stock.`, 'out-of-stock');
        } else if (threshold !== null && newStock <= threshold) {
          showToast(`${formName} has only ${newStock} unit${newStock === 1 ? '' : 's'} remaining.`, 'low-stock');
        }
      }
    } else {
      addProduct(productData);
      // Toast for new product with stock issue
      if (formCategory !== 'Service' && newStock !== null) {
        if (newStock === 0) {
          showToast(`${formName} is now out of stock.`, 'out-of-stock');
        } else if (threshold !== null && newStock <= threshold) {
          showToast(`${formName} has only ${newStock} unit${newStock === 1 ? '' : 's'} remaining.`, 'low-stock');
        }
      }
    }
    setIsProductModalOpen(false);
  };

  // Open Stock Arrived
  const handleOpenStockArrived = (p) => {
    setStockProduct(p);
    setStockArrivedInput('');
    setStockReason('New stock purchased');
    setIsStockModalOpen(true);
  };

  // Save Stock Arrived
  const handleSaveStockArrived = (e) => {
    e.preventDefault();
    if (!stockProduct || !stockArrivedInput) return;
    const qty = Number(stockArrivedInput);
    if (isNaN(qty) || qty <= 0) return;

    addStock(stockProduct.id, qty, 'Admin', stockReason);
    setIsStockModalOpen(false);
  };

  // Status Style Helper
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Available': return 'badge-green';
      case 'Low Stock': return 'badge-amber';
      case 'Out of Stock': return 'badge-red';
      case 'Service': return 'badge-purple';
      default: return 'badge-cyan';
    }
  };

  // Badge label helper — maps status to display text
  const getStatusLabel = (status) => {
    switch (status) {
      case 'Available': return 'IN STOCK';
      case 'Low Stock': return 'LOW STOCK';
      case 'Out of Stock': return 'OUT OF STOCK';
      case 'Service': return 'SERVICE';
      default: return status.toUpperCase();
    }
  };

  // Compute alert counts from live products
  const outOfStockProducts = products.filter(p => p.status === 'Out of Stock');
  const lowStockProducts = products.filter(p => p.status === 'Low Stock');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <StockToast toasts={toasts} onRemove={removeToast} />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Package size={16} color="var(--accent)" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
              Business Control Center & Inventory
            </h2>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
            MANAGE BUSINESS PRODUCTS, CATALOG PRICES, AND STOCK LEVEL
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <InventoryNotificationCenter />
          <button className="btn-ghost" onClick={resetInventoryToDefaults}>
            <RefreshCw size={13} /> Reset Catalog
          </button>
          <button className="btn-primary" onClick={handleOpenAdd}>
            <Plus size={13} /> Add Product
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: 12 }}>
        {[
          { label: 'TOTAL PRODUCTS', value: stats.totalProducts, color: 'var(--accent)', icon: <Package size={18} /> },
          { label: 'TOTAL STOCK UNITS', value: stats.totalStockUnits, color: 'var(--success)', icon: <ArrowUpRight size={18} /> },
          { label: 'LOW STOCK ITEMS', value: stats.lowStockItems, color: 'var(--warning)', icon: <AlertTriangle size={18} />, highlight: stats.lowStockItems > 0 },
          { label: 'OUT OF STOCK', value: stats.outOfStockItems, color: 'var(--danger)', icon: <X size={18} />, highlight: stats.outOfStockItems > 0 }
        ].map((kpi, idx) => (
          <div key={idx} className="stat-card" style={{
            border: kpi.highlight ? `1px solid ${kpi.color}40` : undefined,
            background: kpi.highlight ? `linear-gradient(135deg, var(--bg-panel), ${kpi.color}04)` : undefined
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ color: kpi.color, opacity: 0.8 }}>{kpi.icon}</div>
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

      {/* Alert Banner */}
      {outOfStockProducts.length > 0 && (
        <div className="inv-alert-banner out-of-stock">
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span>
            <strong>{outOfStockProducts.length} product{outOfStockProducts.length > 1 ? 's are' : ' is'} out of stock.</strong>{' '}
            Update inventory before creating quotations.
          </span>
        </div>
      )}
      {outOfStockProducts.length === 0 && lowStockProducts.length > 0 && (
        <div className="inv-alert-banner low-stock">
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span>
            <strong>{lowStockProducts.length} product{lowStockProducts.length > 1 ? 's are' : ' is'} running low.</strong>
          </span>
        </div>
      )}

      {/* Product Catalog Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-void)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.5px' }}>
            PRODUCT INVENTORY LEDGER
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th style={{ textAlign: 'center' }}>Stock</th>
                <th style={{ textAlign: 'right' }}>Selling Price</th>
                <th style={{ textAlign: 'center' }}>GST</th>
                <th>Warranty</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                      {p.id} · {p.aliases ? p.aliases.join(', ') : 'no aliases'}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.category}</span>
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {p.stock !== null ? p.stock : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>
                    ₹{p.price.toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {p.gst}%
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.warranty}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span className={`badge ${getStatusBadgeClass(p.status)}`}>
                        {getStatusLabel(p.status)}
                      </span>
                      {p.status === 'Low Stock' && p.stock !== null && (
                        <span style={{ fontSize: 9, color: 'var(--warning)', fontFamily: 'var(--font-mono)', opacity: 0.8 }}>
                          Only {p.stock} unit{p.stock === 1 ? '' : 's'} remaining
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {p.category !== 'Service' && (
                        <button
                          className="btn-ghost"
                          onClick={() => handleOpenStockArrived(p)}
                          style={{ padding: '4px 8px', fontSize: 10, minHeight: 28, color: 'var(--success)' }}
                        >
                          + Update Stock
                        </button>
                      )}
                      <button
                        className="btn-ghost"
                        onClick={() => handleOpenEdit(p)}
                        style={{ padding: '4px 8px', fontSize: 10, minHeight: 28 }}
                      >
                        <Edit2 size={10} style={{ marginRight: 3 }} /> Edit
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => deleteProduct(p.id)}
                        style={{ padding: '4px 8px', fontSize: 10, minHeight: 28, color: 'var(--danger)' }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock History */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.5px' }}>
            STOCK MOVEMENT HISTORY (LOCAL TRACKER)
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
            <History size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            REAL-TIME LOGS
          </span>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 250 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Product</th>
                <th>Action</th>
                <th style={{ textAlign: 'center' }}>Quantity</th>
                <th>Updated By</th>
              </tr>
            </thead>
            <tbody>
              {stockHistory.map((h) => (
                <tr key={h.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(h.timestamp).toLocaleString('en-IN')}
                  </td>
                  <td style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)' }}>{h.productName}</td>
                  <td>
                    <span style={{ fontSize: 11, color: h.action.includes('Deducted') ? 'var(--danger)' : h.action.includes('Added') ? 'var(--success)' : 'var(--text-primary)' }}>
                      {h.action}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: h.qty.startsWith('-') ? 'var(--danger)' : h.qty.startsWith('+') ? 'var(--success)' : 'var(--text-primary)' }}>
                    {h.qty}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{h.updatedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* modal - Add/Edit Product */}
      {isProductModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setIsProductModalOpen(false)}>
          <div className="card animate-fade-in" style={{
            width: 'min(500px, 94vw)',
            padding: 20,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-panel)',
            display: 'flex', flexDirection: 'column', gap: 14
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                {editingProduct ? 'EDIT CATALOG PRODUCT' : 'NEW PRODUCT ENTRY'}
              </span>
              <button onClick={() => setIsProductModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>PRODUCT NAME</label>
                <input className="input-field" required value={formName} onChange={e => setFormName(e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>CATEGORY</label>
                  <select className="input-field" value={formCategory} onChange={e => setFormCategory(e.target.value)} style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                    <option value="Camera">Camera</option>
                    <option value="Recorder">Recorder</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Service">Service</option>
                  </select>
                </div>
                {formCategory !== 'Service' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>CURRENT STOCK</label>
                    <input className="input-field" type="number" required value={formStock} onChange={e => setFormStock(e.target.value)} />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>SELLING PRICE (₹)</label>
                  <input className="input-field" type="number" required value={formPrice} onChange={e => setFormPrice(e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>GST %</label>
                  <input className="input-field" type="number" required value={formGst} onChange={e => setFormGst(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>WARRANTY</label>
                  <input className="input-field" value={formWarranty} onChange={e => setFormWarranty(e.target.value)} />
                </div>
                {formCategory !== 'Service' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>LOW STOCK ALERT THRESHOLD</label>
                    <input className="input-field" type="number" value={formLowStockThreshold} onChange={e => setFormLowStockThreshold(e.target.value)} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>ALIASES (COMMA SEPARATED)</label>
                <input className="input-field" placeholder="e.g. wire, wire roll, cctv cable" value={formAliases} onChange={e => setFormAliases(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>DESCRIPTION</label>
                <textarea className="input-field" value={formDescription} onChange={e => setFormDescription(e.target.value)} style={{ resize: 'none', height: 60 }} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-ghost" onClick={() => setIsProductModalOpen(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* modal - Update Stock */}
      {isStockModalOpen && stockProduct && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setIsStockModalOpen(false)}>
          <div className="card animate-fade-in" style={{
            width: 'min(400px, 94vw)',
            padding: 20,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-panel)',
            display: 'flex', flexDirection: 'column', gap: 14
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                STOCK ARRIVED UPDATE
              </span>
              <button onClick={() => setIsStockModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveStockArrived} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Product: <strong style={{ color: 'var(--text-primary)' }}>{stockProduct.name}</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--bg-void)', padding: 10, borderRadius: 6 }}>
                <div>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>CURRENT STOCK</div>
                  <div style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{stockProduct.stock}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>NEW PREVIEW</div>
                  <div style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--success)' }}>
                    {(stockProduct.stock || 0) + (Number(stockArrivedInput) || 0)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>STOCK ARRIVED QUANTITY</label>
                <input
                  className="input-field"
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 20"
                  value={stockArrivedInput}
                  onChange={e => setStockArrivedInput(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>REASON</label>
                <select
                  className="input-field"
                  value={stockReason}
                  onChange={e => setStockReason(e.target.value)}
                  style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                >
                  <option value="New stock purchased">New stock purchased</option>
                  <option value="Returned product">Returned product</option>
                  <option value="Manual correction">Manual correction</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-ghost" onClick={() => setIsStockModalOpen(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, background: 'var(--success)', borderColor: 'var(--success)' }}>Confirm Update</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
