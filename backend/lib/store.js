/**
 * IN-MEMORY STORE
 * Tracks two runtime state maps — both reset on server restart (by design).
 *
 * 1. Customer visit counter  → loyalty discount eligibility
 * 2. Product stock levels    → initialised from seed.json stockQty values;
 *                              decremented on order approval
 */

const seedData = require('../data/seed.json');

// ─── Customer Visit Tracker ──────────────────────────────────────────────────
const visits = new Map();

function recordVisit(name) {
  if (!name || name === 'Walk-in Customer' || name === 'Walk-in') return 0;
  const key = name.toLowerCase().trim();
  const current = visits.get(key) || 0;
  const nextVal = current + 1;
  visits.set(key, nextVal);
  return nextVal;
}

function getVisitCount(name) {
  if (!name || name === 'Walk-in Customer' || name === 'Walk-in') return 0;
  const key = name.toLowerCase().trim();
  return visits.get(key) || 0;
}

function isReturningCustomer(name) {
  return getVisitCount(name) >= 1;
}

// ─── Product Stock Ledger ────────────────────────────────────────────────────
const LOW_STOCK_THRESHOLD = 5;

// Seed the in-memory stock map from seed.json on first load.
// Services (S-prefixed) are excluded — they're labour, not inventory.
const stockMap = new Map();
for (const product of seedData.products) {
  stockMap.set(product.id, product.stockQty ?? 0);
}

/**
 * Returns current in-memory stock for a product ID.
 * Returns null for unknown IDs (e.g., services).
 */
function getStockQty(productId) {
  if (!stockMap.has(productId)) return null;
  return stockMap.get(productId);
}

/**
 * Decrements stock by quantity ordered.
 * Floors at 0 — never goes negative.
 * No-op for service IDs or unknown IDs.
 */
function decrementStock(productId, qty) {
  if (!stockMap.has(productId)) return;
  const current = stockMap.get(productId);
  stockMap.set(productId, Math.max(0, current - qty));
  console.log(`[store] Stock: ${productId} ${current} → ${stockMap.get(productId)} (−${qty})`);
}

/**
 * Returns all products currently at or below LOW_STOCK_THRESHOLD.
 * Shape: [{ id, name, stockQty }]
 */
function getLowStockItems() {
  const low = [];
  for (const product of seedData.products) {
    const current = stockMap.get(product.id) ?? 0;
    if (current <= LOW_STOCK_THRESHOLD) {
      low.push({ id: product.id, name: product.name, stockQty: current });
    }
  }
  return low;
}

/**
 * Returns the full stock snapshot for all products.
 * Shape: [{ id, name, stockQty }]
 */
function getAllStockLevels() {
  return seedData.products.map(p => ({
    id: p.id,
    name: p.name,
    stockQty: stockMap.get(p.id) ?? 0,
  }));
}

module.exports = {
  // Visit tracker
  recordVisit,
  getVisitCount,
  isReturningCustomer,
  // Stock management
  getStockQty,
  decrementStock,
  getLowStockItems,
  getAllStockLevels,
  LOW_STOCK_THRESHOLD,
};
