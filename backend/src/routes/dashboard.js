const router = require('express').Router();
const pool = require('../../db/pool');

// GET /api/dashboard?month=2026-03
router.get('/', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [year, mon] = month.split('-');
    const start = `${year}-${mon}-01`;
    const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
    const end = `${year}-${mon}-${String(lastDay).padStart(2, '0')}`;
    const prevMonth = new Date(parseInt(year), parseInt(mon) - 2, 1).toISOString().slice(0, 7);
    const [pYear, pMon] = prevMonth.split('-');
    const prevStart = `${prevMonth}-01`;
    const prevLastDay = new Date(parseInt(pYear), parseInt(pMon), 0).getDate();
    const prevEnd = `${prevMonth}-${String(prevLastDay).padStart(2, '0')}`;

    // Income this month
    const income = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type='credit' AND date BETWEEN $1 AND $2
      AND category_id = (SELECT id FROM categories WHERE name='Salary' LIMIT 1)
    `, [start, end]);

    // Spent this month (debits excluding investments)
    const spent = await pool.query(`
      SELECT COALESCE(SUM(
        CASE WHEN t.is_split THEN t.split_amount ELSE t.amount END
      ), 0) as total
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.type='debit' AND t.date BETWEEN $1 AND $2
      AND (c.name IS NULL OR c.name NOT IN ('Investments'))
    `, [start, end]);

    // Spent last month
    const spentPrev = await pool.query(`
      SELECT COALESCE(SUM(
        CASE WHEN t.is_split THEN t.split_amount ELSE t.amount END
      ), 0) as total
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.type='debit' AND t.date BETWEEN $1 AND $2
      AND (c.name IS NULL OR c.name NOT IN ('Investments'))
    `, [prevStart, prevEnd]);

    // To recover - split txns not yet recovered
    const toRecover = await pool.query(`
      SELECT COALESCE(SUM(amount - COALESCE(split_amount, 0)), 0) as total,
             COUNT(DISTINCT id) as count
      FROM transactions
      WHERE is_split=true AND is_recovered=false
      AND date BETWEEN $1 AND $2
    `, [start, end]);

    // Invested this month
    const invested = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM investment_log
      WHERE date BETWEEN $1 AND $2
    `, [start, end]);

    // You owe (your share of others' split txns - from Splitwise manual entries)
    const youOwe = await pool.query(`
      SELECT COALESCE(SUM(split_amount), 0) as total
      FROM transactions
      WHERE type='credit' AND is_split=true AND is_recovered=false
      AND date BETWEEN $1 AND $2
    `, [start, end]);

    // Pending flatmate match (UPI credits needing confirmation)
    const pendingMatch = await pool.query(`
      SELECT t.*, f.name as flatmate_name
      FROM transactions t
      JOIN flatmates f ON f.upi_id = ANY(
        SELECT regexp_matches(t.description, '[a-zA-Z0-9._-]+@[a-zA-Z]+', 'g')
      )
      WHERE t.type='credit' AND t.source='gmail'
      AND NOT EXISTS (
        SELECT 1 FROM flatmate_payments fp WHERE fp.transaction_id = t.id AND fp.confirmed=true
      )
      AND t.date BETWEEN $1 AND $2
      LIMIT 1
    `, [start, end]);

    // Category breakdown
    const categories = await pool.query(`
      SELECT c.name, c.color,
             COALESCE(SUM(CASE WHEN t.is_split THEN t.split_amount ELSE t.amount END), 0) as total
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.type='debit' AND t.date BETWEEN $1 AND $2
      AND c.name NOT IN ('Investments', 'Salary')
      GROUP BY c.name, c.color
      ORDER BY total DESC
    `, [start, end]);

    // Category breakdown last month
    const categoriesPrev = await pool.query(`
      SELECT c.name,
             COALESCE(SUM(CASE WHEN t.is_split THEN t.split_amount ELSE t.amount END), 0) as total
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.type='debit' AND t.date BETWEEN $1 AND $2
      AND c.name NOT IN ('Investments', 'Salary')
      GROUP BY c.name
    `, [prevStart, prevEnd]);

    const prevCatMap = {};
    categoriesPrev.rows.forEach(r => { prevCatMap[r.name] = r.total; });

    // Daily spend - last 7 days
    const daily = await pool.query(`
      SELECT date, COALESCE(SUM(
        CASE WHEN is_split THEN split_amount ELSE amount END
      ), 0) as total
      FROM transactions
      WHERE type='debit' AND date >= NOW() - INTERVAL '7 days'
      GROUP BY date ORDER BY date ASC
    `);

    // Insight - biggest category change
    let insight = null;
    const cats = categories.rows;
    for (const cat of cats) {
      const prev = parseFloat(prevCatMap[cat.name] || 0);
      const curr = parseFloat(cat.total);
      if (curr - prev > 1500) {
        insight = {
          text: `${cat.name} spend is up this month`,
          detail: `₹${Math.round(curr - prev).toLocaleString('en-IN')} more than last month`
        };
        break;
      }
    }

    res.json({
      month,
      buckets: {
        income: parseFloat(income.rows[0].total),
        spent: parseFloat(spent.rows[0].total),
        spent_prev: parseFloat(spentPrev.rows[0].total),
        to_recover: parseFloat(toRecover.rows[0].total),
        to_recover_count: parseInt(toRecover.rows[0].count),
        invested: parseFloat(invested.rows[0].total),
        invested_count: parseInt(invested.rows[0].count),
        you_owe: parseFloat(youOwe.rows[0].total)
      },
      categories: categories.rows.map(c => ({
        ...c,
        total: parseFloat(c.total),
        prev: parseFloat(prevCatMap[c.name] || 0)
      })),
      daily: daily.rows,
      pending_match: pendingMatch.rows[0] || null,
      insight
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
