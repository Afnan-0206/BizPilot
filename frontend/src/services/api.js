// API service for BizPilot AI backend

const BASE_URL = '/api';

export async function processMessage(message, language = 'en') {
  const response = await fetch(`${BASE_URL}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, language }),
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
  const response = await fetch(`${BASE_URL.replace('/api', '')}/health`);
  return response.json();
}
