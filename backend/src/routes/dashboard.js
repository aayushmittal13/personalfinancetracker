const router = require('express').Router();
const pool = require('../../db/pool');
const { getMonthRange, getPreviousMonth } = require('../utils/dateUtils');

// GET /api/dashboard?month=2026-03
router.get('/', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const { start, end } = getMonthRange(month);
    const prevMonth = getPreviousMonth(month);
    const { start: prevStart, end: prevEnd } = getMonthRange(prevMonth);

    const [income, spent, spentPrev, toRecover, invested, youOwe, pendingMatch, categories, categoriesPrev, daily, topMerchants, budgetSummary, totalTransactions] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE type='credit' AND date BETWEEN $1 AND $2
        AND category_id = (SELECT id FROM categories WHERE name='Salary' LIMIT 1)
      `, [start, end]),

      pool.query(`
        SELECT COALESCE(SUM(
          CASE WHEN t.is_split THEN t.split_amount ELSE t.amount END
        ), 0) as total
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.type='debit' AND t.date BETWEEN $1 AND $2
        AND (c.name IS NULL OR c.name NOT IN ('Investments'))
      `, [start, end]),

      pool.query(`
        SELECT COALESCE(SUM(
          CASE WHEN t.is_split THEN t.split_amount ELSE t.amount END
        ), 0) as total
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.type='debit' AND t.date BETWEEN $1 AND $2
        AND (c.name IS NULL OR c.name NOT IN ('Investments'))
      `, [prevStart, prevEnd]),

      pool.query(`
        SELECT COALESCE(SUM(amount - COALESCE(split_amount, 0)), 0) as total,
               COUNT(DISTINCT id) as count
        FROM transactions
        WHERE is_split=true AND is_recovered=false
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
          AND c.name='Investments'
          AND t.date BETWEEN $1 AND $2
        ) invested_rows
      `, [start, end]),

      pool.query(`
        SELECT COALESCE(SUM(split_amount), 0) as total
        FROM transactions
        WHERE type='credit' AND is_split=true AND is_recovered=false
        AND date BETWEEN $1 AND $2
      `, [start, end]),

      pool.query(`
        SELECT t.*, f.name as flatmate_name
        FROM transactions t
        JOIN flatmates f ON t.description ILIKE '%' || f.upi_id || '%'
        WHERE t.type='credit' AND t.source='gmail'
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
        AND c.name NOT IN ('Investments', 'Salary')
        GROUP BY c.name
      `, [prevStart, prevEnd]),

      pool.query(`
        SELECT date, COALESCE(SUM(
          CASE WHEN is_split THEN split_amount ELSE amount END
        ), 0) as total
        FROM transactions
        WHERE type='debit' AND date >= NOW() - INTERVAL '7 days'
        GROUP BY date ORDER BY date ASC
      `),

      pool.query(`
        SELECT description, COUNT(*) as frequency,
               COALESCE(SUM(CASE WHEN is_split THEN split_amount ELSE amount END), 0) as total
        FROM transactions
        WHERE type='debit' AND date BETWEEN $1 AND $2
        GROUP BY description
        ORDER BY total DESC
        LIMIT 5
      `, [start, end]),

      pool.query(`
        SELECT b.category_id, b.amount as budget, c.name as category_name, c.color,
               COALESCE(SUM(CASE WHEN t.is_split THEN t.split_amount ELSE t.amount END), 0) as spent
        FROM budgets b
        JOIN categories c ON b.category_id = c.id
        LEFT JOIN transactions t ON t.category_id = b.category_id
          AND t.type = 'debit' AND t.date BETWEEN $1 AND $2
        WHERE b.is_active = true AND (b.month IS NULL OR b.month = $3)
        GROUP BY b.category_id, b.amount, c.name, c.color
      `, [start, end, month]),

      pool.query(`
        SELECT COUNT(*) as count,
               COUNT(*) FILTER (WHERE source = 'gmail') as gmail_count,
               COUNT(*) FILTER (WHERE source = 'manual') as manual_count,
               COUNT(*) FILTER (WHERE source = 'webhook') as webhook_count
        FROM transactions WHERE date BETWEEN $1 AND $2
      `, [start, end])
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

    const incomeVal = parseFloat(income.rows[0].total);
    const spentVal = parseFloat(spent.rows[0].total);
    const spentPrevVal = parseFloat(spentPrev.rows[0].total);
    const investedVal = parseFloat(invested.rows[0].total);

    const savingsRate = incomeVal > 0
      ? Math.round(((incomeVal - spentVal - investedVal) / incomeVal) * 100)
      : 0;

    const spentChange = spentPrevVal > 0
      ? Math.round(((spentVal - spentPrevVal) / spentPrevVal) * 100)
      : 0;

    const totalCategorySpend = cats.reduce((s, c) => s + parseFloat(c.total), 0);
    const categoriesWithPercent = cats.map(c => ({
      ...c,
      total: parseFloat(c.total),
      prev: parseFloat(prevCatMap[c.name] || 0),
      percent: totalCategorySpend > 0 ? Math.round((parseFloat(c.total) / totalCategorySpend) * 100) : 0,
      change: parseFloat(prevCatMap[c.name] || 0) > 0
        ? Math.round(((parseFloat(c.total) - parseFloat(prevCatMap[c.name])) / parseFloat(prevCatMap[c.name])) * 100)
        : null
    }));

    const budgets = budgetSummary.rows.map(b => ({
      category_name: b.category_name,
      color: b.color,
      budget: parseFloat(b.budget),
      spent: parseFloat(b.spent),
      remaining: parseFloat(b.budget) - parseFloat(b.spent),
      percent: parseFloat(b.budget) > 0
        ? Math.round((parseFloat(b.spent) / parseFloat(b.budget)) * 100)
        : 0
    }));

    const overBudgetCategories = budgets.filter(b => b.percent > 100);

    if (!insight && overBudgetCategories.length > 0) {
      const worst = overBudgetCategories.sort((a, b) => b.percent - a.percent)[0];
      insight = {
        text: `${worst.category_name} is over budget`,
        detail: `₹${Math.round(Math.abs(worst.remaining)).toLocaleString('en-IN')} over your ₹${Math.round(worst.budget).toLocaleString('en-IN')} budget`
      };
    }

    res.json({
      month,
      buckets: {
        income: incomeVal,
        spent: spentVal,
        spent_prev: spentPrevVal,
        spent_change: spentChange,
        to_recover: parseFloat(toRecover.rows[0].total),
        to_recover_count: parseInt(toRecover.rows[0].count),
        invested: investedVal,
        invested_count: parseInt(invested.rows[0].count),
        you_owe: parseFloat(youOwe.rows[0].total),
        savings_rate: savingsRate
      },
      categories: categoriesWithPercent,
      daily: daily.rows,
      pending_match: pendingMatch.rows[0] || null,
      insight,
      top_merchants: topMerchants.rows.map(m => ({
        description: m.description,
        frequency: parseInt(m.frequency),
        total: parseFloat(m.total)
      })),
      budgets,
      transaction_counts: {
        total: parseInt(totalTransactions.rows[0].count),
        gmail: parseInt(totalTransactions.rows[0].gmail_count),
        manual: parseInt(totalTransactions.rows[0].manual_count),
        webhook: parseInt(totalTransactions.rows[0].webhook_count)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
