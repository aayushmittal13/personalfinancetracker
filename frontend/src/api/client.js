const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const BASE = process.env.REACT_APP_API_URL || (isLocalHost ? 'http://localhost:3001' : '');

function buildApiUrl(path = '') {
  return `${BASE}${path}`;
}

async function readResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  let json = null;

  if (text && contentType.includes('application/json')) {
    try {
      json = JSON.parse(text);
    } catch (err) {
      json = null;
    }
  }

  return { contentType, text, json };
}

async function req(method, path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  let res;
  try {
    res = await fetch(buildApiUrl(path), {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Check that the backend is running.');
    }
    throw new Error('Network error. Check your connection and that the backend is running.');
  }
  clearTimeout(timeout);
  const { contentType, text, json } = await readResponse(res);

  if (!res.ok) {
    const message = json?.error || json?.message || text || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  if (!text) return null;

  if (contentType.includes('application/json')) {
    return json ?? JSON.parse(text);
  }

  throw new Error(
    BASE
      ? 'API returned HTML instead of JSON. Check that the backend URL is correct and the backend is running.'
      : 'API returned HTML instead of JSON. Set REACT_APP_API_URL to your backend URL.'
  );
}

export const api = {
  // Dashboard
  dashboard: (month) => req('GET', `/api/dashboard?month=${month}`),

  // Transactions
  transactions: (month) => req('GET', `/api/transactions?month=${month}`),
  addTransaction: (data) => req('POST', '/api/transactions', data),
  updateCategory: (id, category_id) => req('PATCH', `/api/transactions/${id}/category`, { category_id }),
  markSplit: (id, data) => req('PATCH', `/api/transactions/${id}/split`, data),
  deleteTransaction: (id) => req('DELETE', `/api/transactions/${id}`),

  // Categories
  categories: () => req('GET', '/api/categories'),
  addCategory: (data) => req('POST', '/api/categories', data),

  // Accounts
  accounts: () => req('GET', '/api/accounts'),
  addAccount: (data) => req('POST', '/api/accounts', data),

  // Fixed expenses
  fixedExpenses: () => req('GET', '/api/fixed-expenses'),
  addFixedExpense: (data) => req('POST', '/api/fixed-expenses', data),
  updateFixedExpense: (id, data) => req('PATCH', `/api/fixed-expenses/${id}`, data),
  deleteFixedExpense: (id) => req('DELETE', `/api/fixed-expenses/${id}`),

  // Investments
  investments: () => req('GET', '/api/investments'),
  investmentLog: (month) => req('GET', `/api/investments/log?month=${month}`),
  addInvestment: (data) => req('POST', '/api/investments', data),
  logInvestment: (data) => req('POST', '/api/investments/log', data),
  deleteInvestment: (id) => req('DELETE', `/api/investments/${id}`),

  // Flatmates
  flatmates: () => req('GET', '/api/flatmates'),
  flatmateBalances: (month) => req('GET', `/api/flatmates/balances?month=${month}`),
  flatmateHistory: (id) => req('GET', `/api/flatmates/${id}/history`),
  addFlatmate: (data) => req('POST', '/api/flatmates', data),
  updateFlatmate: (id, data) => req('PATCH', `/api/flatmates/${id}`, data),
  confirmPayment: (data) => req('POST', '/api/flatmates/payments/confirm', data),

  // Gmail
  gmailStatus: () => req('GET', '/api/gmail/status'),
  gmailSync: () => req('POST', '/api/gmail/sync'),
  gmailAuthUrl: () => buildApiUrl('/api/gmail/auth'),

  // Settings
  settings: () => req('GET', '/api/settings'),
  setSetting: (key, value) => req('POST', '/api/settings', { key, value })
};
