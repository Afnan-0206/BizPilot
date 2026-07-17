import { getInventorySnapshot } from '../lib/inventoryStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const BASE_URL = `${API_URL}/api`;

export async function processMessage(message, language = 'en') {
  const snapshot = getInventorySnapshot();
  const response = await fetch(`${BASE_URL}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      language,
      inventoryCatalog: snapshot.products,
      inventorySnapshot: snapshot,
      businessContext: {
        companyName: "SecureVision Systems",
        source: "Inventory Dashboard",
        stockAware: true
      }
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getStats() {
  const response = await fetch(`${BASE_URL}/stats`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

export async function getLogs() {
  const response = await fetch(`${BASE_URL}/logs`);
  if (!response.ok) throw new Error('Failed to fetch logs');
  return response.json();
}

export async function healthCheck() {
  const response = await fetch(`${API_URL}/health`);
  return response.json();
}