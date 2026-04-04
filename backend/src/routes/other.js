// categories.js
const categoriesRouter = require('express').Router();
const pool = require('../../db/pool');
const { getMonthRange } = require('../utils/dateUtils');
const { confirmedTransactionClause } = require('../utils/sql');

categoriesRouter.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM categories ORDER BY name`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

categoriesRouter.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const { rows } = await pool.query(
      `INSERT INTO categories (name, color) VALUES ($1, $2) RETURNING *`,
      [name, color || '#94a3b8']
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.categoriesRouter = categoriesRouter;

// ─────────────────────────────────────────────

// accounts.js
const accountsRouter = require('express').Router();

accountsRouter.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM accounts ORDER BY name`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

accountsRouter.post('/', async (req, res) => {
  try {
    const { name, type, bank, last4, gmail_label, is_manual } = req.body;
    if (!name || !type || !bank) return res.status(400).json({ error: 'Name, type, and bank are required' });
    const { rows } = await pool.query(
      `INSERT INTO accounts (name, type, bank, last4, gmail_label, is_manual) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, type, bank, last4, gmail_label, is_manual || false]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

accountsRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM accounts WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.accountsRouter = accountsRouter;

// ─────────────────────────────────────────────

// fixedExpenses.js
const fixedExpensesRouter = require('express').Router();

fixedExpensesRouter.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT fe.*, c.name as category_name, a.name as account_name
      FROM fixed_expenses fe
      LEFT JOIN categories c ON fe.category_id = c.id
      LEFT JOIN accounts a ON fe.account_id = a.id
      WHERE fe.is_active = true
      ORDER BY fe.due_day ASC NULLS LAST
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

fixedExpensesRouter.post('/', async (req, res) => {
  try {
    const { name, amount, due_day, account_id, category_id, auto_detect } = req.body;
    if (!name || !amount) return res.status(400).json({ error: 'Name and amount are required' });
    const { rows } = await pool.query(`
      INSERT INTO fixed_expenses (name, amount, due_day, account_id, category_id, auto_detect)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [name, amount, due_day, account_id, category_id, auto_detect !== false]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

fixedExpensesRouter.patch('/:id', async (req, res) => {
  try {
    const { name, amount, due_day } = req.body;
    const { rows } = await pool.query(`
      UPDATE fixed_expenses SET name=$1, amount=$2, due_day=$3 WHERE id=$4 RETURNING *
    `, [name, amount, due_day, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

fixedExpensesRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query(`UPDATE fixed_expenses SET is_active=false WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.fixedExpensesRouter = fixedExpensesRouter;

// ─────────────────────────────────────────────

// investments.js
const investmentsRouter = require('express').Router();

investmentsRouter.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.*, a.name as account_name
      FROM investments i
      LEFT JOIN accounts a ON i.account_id = a.id
      WHERE i.is_active = true
      ORDER BY i.type, i.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

investmentsRouter.get('/log', async (req, res) => {
  try {
    const currentMonth = req.query.month || new Date().toISOString().slice(0, 7);
    const { start, end } = getMonthRange(currentMonth);
    const { rows } = await pool.query(`
      SELECT *
      FROM (
        SELECT il.id,
               il.investment_id,
               il.amount,
               il.date,
               il.source,
               il.gmail_message_id,
               il.created_at,
               i.name,
               i.type
        FROM investment_log il
        JOIN investments i ON il.investment_id = i.id
        WHERE il.date BETWEEN $1 AND $2

        UNION ALL

        SELECT t.id,
               NULL::integer as investment_id,
               t.amount,
               t.date,
               t.source,
               t.gmail_message_id,
               t.created_at,
               t.description as name,
               'detected'::text as type
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.type='debit'
        AND ${confirmedTransactionClause('t')}
        AND c.name='Investments'
        AND t.date BETWEEN $1 AND $2
      ) combined_investments
      ORDER BY date DESC, created_at DESC
    `, [start, end]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

investmentsRouter.get('/ytd', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM (
        SELECT il.amount
        FROM investment_log il
        WHERE il.date >= $1 AND il.date <= $2

        UNION ALL

        SELECT t.amount
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.type='debit'
        AND ${confirmedTransactionClause('t')}
        AND c.name='Investments'
        AND t.date >= $1 AND t.date <= $2
      ) invested_rows
    `, [`${year}-01-01`, `${year}-12-31`]);
    res.json({ total: parseFloat(rows[0].total), count: parseInt(rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

investmentsRouter.post('/', async (req, res) => {
  try {
    const { name, amount, type, sip_day, account_id, auto_detect } = req.body;
    if (!name || !amount || !type) return res.status(400).json({ error: 'Name, amount, and type are required' });
    const { rows } = await pool.query(`
      INSERT INTO investments (name, amount, type, sip_day, account_id, auto_detect)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [name, amount, type, sip_day, account_id, auto_detect !== false]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

investmentsRouter.post('/log', async (req, res) => {
  try {
    const { investment_id, amount, date } = req.body;
    if (!investment_id || !amount || !date) return res.status(400).json({ error: 'Investment ID, amount, and date are required' });
    const { rows } = await pool.query(`
      INSERT INTO investment_log (investment_id, amount, date, source)
      VALUES ($1,$2,$3,'manual') RETURNING *
    `, [investment_id, amount, date]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

investmentsRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query(`UPDATE investments SET is_active=false WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.investmentsRouter = investmentsRouter;

// ─────────────────────────────────────────────

// flatmates.js
const flatmatesRouter = require('express').Router();

flatmatesRouter.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM flatmates WHERE is_active=true ORDER BY name`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

flatmatesRouter.post('/', async (req, res) => {
  try {
    const { name, upi_id, expected_monthly } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const { rows } = await pool.query(`
      INSERT INTO flatmates (name, upi_id, expected_monthly) VALUES ($1,$2,$3) RETURNING *
    `, [name, upi_id, expected_monthly || 0]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

flatmatesRouter.patch('/:id', async (req, res) => {
  try {
    const { name, upi_id, expected_monthly } = req.body;
    const { rows } = await pool.query(`
      UPDATE flatmates SET name=$1, upi_id=$2, expected_monthly=$3 WHERE id=$4 RETURNING *
    `, [name, upi_id, expected_monthly, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/flatmates/balances?month=2026-03
flatmatesRouter.get('/balances', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const { rows } = await pool.query(`
      SELECT f.id, f.name, f.upi_id, f.expected_monthly,
             COALESCE(SUM(fp.amount) FILTER (WHERE fp.confirmed=true), 0) as received,
             COALESCE(SUM(fp.amount) FILTER (WHERE fp.confirmed=true), 0) - f.expected_monthly as balance
      FROM flatmates f
      LEFT JOIN flatmate_payments fp ON fp.flatmate_id=f.id AND fp.month=$1
      WHERE f.is_active=true
      GROUP BY f.id
    `, [month]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/flatmates/payments/confirm
flatmatesRouter.post('/payments/confirm', async (req, res) => {
  try {
    const { flatmate_id, transaction_id, month, amount } = req.body;
    if (!flatmate_id || !transaction_id || !month) return res.status(400).json({ error: 'flatmate_id, transaction_id, and month are required' });
    const { rows } = await pool.query(`
      INSERT INTO flatmate_payments (flatmate_id, transaction_id, month, amount, confirmed)
      VALUES ($1,$2,$3,$4,true)
      ON CONFLICT (flatmate_id, transaction_id) DO UPDATE SET confirmed=true, amount=$4
      RETURNING *
    `, [flatmate_id, transaction_id, month, amount]);
    res.json(rows[0] || { ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/flatmates/:id/history
flatmatesRouter.get('/:id/history', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT month,
             COALESCE(SUM(amount) FILTER (WHERE confirmed=true), 0) as received,
             MAX(f.expected_monthly) as expected
      FROM flatmate_payments fp
      JOIN flatmates f ON f.id = fp.flatmate_id
      WHERE fp.flatmate_id=$1
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.flatmatesRouter = flatmatesRouter;

// ─────────────────────────────────────────────

// settings.js
const settingsRouter = require('express').Router();

settingsRouter.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT key, value FROM settings WHERE key != 'gmail_tokens'`);
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.post('/', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: 'Key and value are required' });
    if (key === 'gmail_tokens') return res.status(403).json({ error: 'Use /api/gmail/auth' });
    await pool.query(`
      INSERT INTO settings (key, value) VALUES ($1,$2)
      ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()
    `, [key, value]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.settingsRouter = settingsRouter;
