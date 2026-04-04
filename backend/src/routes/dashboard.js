const router = require('express').Router();
const pool = require('../../db/pool');
const { getMonthRange, getPreviousMonth } = require('../utils/dateUtils');
const { confirmedTransactionClause } = require('../utils/sql');

// GET /api/dashboard?month=2026-03
router.get('/', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const { start, end } = getMonthRange(month);
    const prevMonth = getPreviousMonth(month);
    const { start: prevStart, end: prevEnd } = getMonthRange(prevMonth);

    const [income, spent, spentPrev, toRecover, invested, youOwe, pendingMatch, categories, categoriesPrev, daily, reviewQueue, todayCount] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE type='credit' AND date BETWEEN $1 AND $2
        AND review_status='confirmed'
        AND category_id = (SELECT id FROM categories WHERE name='Salary' LIMIT 1)
      `, [start, end]),

      pool.query(`
        SELECT COALESCE(SUM(
          CASE WHEN t.is_split THEN t.split_amount ELSE t.amount END
        ), 0) as total
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.type='debit' AND t.date BETWEEN $1 AND $2
        AND ${confirmedTransactionClause('t')}
        AND (c.name IS NULL OR c.name NOT IN ('Investments'))
      `, [start, end]),

      pool.query(`
        SELECT COALESCE(SUM(
          CASE WHEN t.is_split THEN t.split_amount ELSE t.amount END
        ), 0) as total
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.type='debit' AND t.date BETWEEN $1 AND $2
        AND ${confirmedTransactionClause('t')}
        AND (c.name IS NULL OR c.name NOT IN ('Investments'))
      `, [prevStart, prevEnd]),

      pool.query(`
        SELECT COALESCE(SUM(amount - COALESCE(split_amount, 0)), 0) as total,
               COUNT(DISTINCT id) as count
        FROM transactions
        WHERE is_split=true AND is_recovered=false
        AND review_status='confirmed'
        AND date BETWEEN $1 AND $2
      `, [start, end]),

      pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
        FROM (
          SELECT il.amount
          FROM investment_log il
          WHERE il.date BETWEEN $1 AND $2

          UNION ALL

          SELECT t.amount
          FROM transactions t
          JOIN categories c ON t.category_id = c.id
          WHERE t.type='debit'
          AND ${confirmedTransactionClause('t')}
          AND c.name='Investments'
          AND t.date BETWEEN $1 AND $2
        ) invested_rows
      `, [start, end]),

      pool.query(`
        SELECT COALESCE(SUM(split_amount), 0) as total
        FROM transactions
        WHERE type='credit' AND is_split=true AND is_recovered=false
        AND review_status='confirmed'
        AND date BETWEEN $1 AND $2
      `, [start, end]),

      pool.query(`
        SELECT t.*, f.name as flatmate_name
        FROM transactions t
        JOIN flatmates f ON t.description ILIKE '%' || f.upi_id || '%'
        WHERE t.type='credit' AND t.source='gmail'
        AND ${confirmedTransactionClause('t')}
        AND NOT EXISTS (
          SELECT 1 FROM flatmate_payments fp WHERE fp.transaction_id = t.id AND fp.confirmed=true
        )
        AND t.date BETWEEN $1 AND $2
        LIMIT 1
      `, [start, end]),

      pool.query(`
        SELECT c.name, c.color,
               COALESCE(SUM(CASE WHEN t.is_split THEN t.split_amount ELSE t.amount END), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.type='debit' AND t.date BETWEEN $1 AND $2
        AND ${confirmedTransactionClause('t')}
        AND c.name NOT IN ('Investments', 'Salary')
        GROUP BY c.name, c.color
        ORDER BY total DESC
      `, [start, end]),

      pool.query(`
        SELECT c.name,
               COALESCE(SUM(CASE WHEN t.is_split THEN t.split_amount ELSE t.amount END), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.type='debit' AND t.date BETWEEN $1 AND $2
        AND ${confirmedTransactionClause('t')}
        AND c.name NOT IN ('Investments', 'Salary')
        GROUP BY c.name
      `, [prevStart, prevEnd]),

      pool.query(`
        SELECT date, COALESCE(SUM(
          CASE WHEN is_split THEN split_amount ELSE amount END
        ), 0) as total
        FROM transactions
        WHERE type='debit' AND date >= NOW() - INTERVAL '7 days'
        AND review_status='confirmed'
        GROUP BY date ORDER BY date ASC
      `),

      pool.query(`
        SELECT COUNT(*)::int as count
        FROM transactions
        WHERE review_status='pending'
      `),

      pool.query(`
        SELECT COUNT(*)::int as count
        FROM transactions
        WHERE review_status='confirmed'
        AND date = CURRENT_DATE
      `)
    ]);

    const prevCatMap = {};
    categoriesPrev.rows.forEach(r => { prevCatMap[r.name] = r.total; });

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
      pending_review_count: reviewQueue.rows[0]?.count || 0,
      today_count: todayCount.rows[0]?.count || 0,
      insight
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
