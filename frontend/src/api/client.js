const BASE = process.env.REACT_APP_API_URL || '';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
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
  gmailSync: () => req('POST', '/api/gmail/sync'),

  // Settings
  settings: () => req('GET', '/api/settings'),
  setSetting: (key, value) => req('POST', '/api/settings', { key, value })
};
