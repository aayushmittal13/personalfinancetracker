const router = require('express').Router();
const pool = require('../../db/pool');
const { getMonthRange } = require('../utils/dateUtils');

// GET /api/budgets?month=2026-03
router.get('/', async (req, res) => {
  try {
    const month = req.query.month || null;

    const { rows } = await pool.query(`
      SELECT b.*, c.name as category_name, c.color as category_color
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      WHERE b.is_active = true
      AND (b.month IS NULL OR b.month = $1)
      ORDER BY c.name
    `, [month]);

    if (!month) return res.json(rows);

    const { start, end } = getMonthRange(month);

    const spentResult = await pool.query(`
      SELECT c.id as category_id,
             COALESCE(SUM(CASE WHEN t.is_split THEN t.split_amount ELSE t.amount END), 0) as spent
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'debit' AND t.date BETWEEN $1 AND $2
      GROUP BY c.id
    `, [start, end]);

    const spentMap = {};
    spentResult.rows.forEach(r => { spentMap[r.category_id] = parseFloat(r.spent); });

    const enriched = rows.map(b => ({
      ...b,
      amount: parseFloat(b.amount),
      spent: spentMap[b.category_id] || 0,
      remaining: parseFloat(b.amount) - (spentMap[b.category_id] || 0),
      percent: spentMap[b.category_id]
        ? Math.round((spentMap[b.category_id] / parseFloat(b.amount)) * 100)
        : 0
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/budgets
router.post('/', async (req, res) => {
  try {
    const { category_id, amount, month } = req.body;
    if (!category_id || !amount) {
      return res.status(400).json({ error: 'category_id and amount are required' });
    }
    const { rows } = await pool.query(`
      INSERT INTO budgets (category_id, amount, month)
      VALUES ($1, $2, $3)
      ON CONFLICT (category_id, month) DO UPDATE SET amount = $2, is_active = true
      RETURNING *
    `, [category_id, amount, month || null]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/budgets/:id
router.patch('/:id', async (req, res) => {
  try {
    const { amount } = req.body;
    const { rows } = await pool.query(
      `UPDATE budgets SET amount = $1 WHERE id = $2 RETURNING *`,
      [amount, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Budget not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/budgets/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`UPDATE budgets SET is_active = false WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/budgets/summary?month=2026-03
router.get('/summary', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const { start, end } = getMonthRange(month);

    const budgets = await pool.query(`
      SELECT b.category_id, b.amount, c.name as category_name
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      WHERE b.is_active = true AND (b.month IS NULL OR b.month = $1)
    `, [month]);

    const spent = await pool.query(`
      SELECT t.category_id,
             COALESCE(SUM(CASE WHEN t.is_split THEN t.split_amount ELSE t.amount END), 0) as spent
      FROM transactions t
      WHERE t.type = 'debit' AND t.date BETWEEN $1 AND $2
      AND t.category_id IN (SELECT category_id FROM budgets WHERE is_active = true)
      GROUP BY t.category_id
    `, [start, end]);

    const spentMap = {};
    spent.rows.forEach(r => { spentMap[r.category_id] = parseFloat(r.spent); });

    const totalBudget = budgets.rows.reduce((s, b) => s + parseFloat(b.amount), 0);
    const totalSpent = budgets.rows.reduce((s, b) => s + (spentMap[b.category_id] || 0), 0);

    const overBudget = budgets.rows.filter(b => (spentMap[b.category_id] || 0) > parseFloat(b.amount));
    const nearBudget = budgets.rows.filter(b => {
      const s = spentMap[b.category_id] || 0;
      const a = parseFloat(b.amount);
      return s >= a * 0.8 && s <= a;
    });

    res.json({
      total_budget: totalBudget,
      total_spent: totalSpent,
      total_remaining: totalBudget - totalSpent,
      percent_used: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
      categories_over: overBudget.map(b => b.category_name),
      categories_near: nearBudget.map(b => b.category_name),
      month
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
