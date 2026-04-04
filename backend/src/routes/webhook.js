const router = require('express').Router();
const pool = require('../../db/pool');
const { categorize } = require('../parsers/categorizer');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || null;

function authenticate(req, res, next) {
  if (!WEBHOOK_SECRET) return next();
  const token = req.headers['x-webhook-secret'] || req.query.secret;
  if (token !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }
  next();
}

function parseAmount(val) {
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[₹,\s]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

// POST /api/webhook/import
// Accepts transaction data from external sources (SMS parsers, n8n, Telegram bots, etc.)
// Body: { sender, amount, type, date, message, description, category, account_last4, source_id }
router.post('/import', authenticate, async (req, res) => {
  try {
    const { sender, amount, type, date, message, description, category, account_last4, source_id } = req.body;

    const parsedAmount = parseAmount(amount);
    if (!parsedAmount) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const txnType = ['debit', 'credit'].includes(type) ? type : 'debit';
    const txnDate = date || new Date().toISOString().slice(0, 10);
    const txnDescription = description || message || sender || 'Webhook import';

    if (source_id) {
      const existing = await pool.query(
        `SELECT id FROM transactions WHERE source = 'webhook' AND raw_text LIKE $1`,
        [`%"source_id":"${source_id}"%`]
      );
      if (existing.rows.length > 0) {
        return res.json({
          status: 'skipped',
          reason: 'duplicate',
          transaction_id: existing.rows[0].id
        });
      }
    }

    let category_id = null;
    let categoryName = category || null;

    if (category) {
      const catRow = await pool.query(`SELECT id FROM categories WHERE LOWER(name) = LOWER($1)`, [category]);
      if (catRow.rows[0]) {
        category_id = catRow.rows[0].id;
      }
    }

    if (!category_id) {
      categoryName = await categorize(txnDescription, parsedAmount, txnType);
      const catRow = await pool.query(`SELECT id FROM categories WHERE name = $1`, [categoryName]);
      category_id = catRow.rows[0]?.id || null;
    }

    let account_id = null;
    if (account_last4) {
      const accRow = await pool.query(`SELECT id FROM accounts WHERE last4 = $1 LIMIT 1`, [account_last4]);
      account_id = accRow.rows[0]?.id || null;
    } else if (sender) {
      const accRow = await pool.query(`SELECT id FROM accounts WHERE LOWER(bank) = LOWER($1) LIMIT 1`, [sender]);
      account_id = accRow.rows[0]?.id || null;
    }

    const rawMeta = JSON.stringify({
      source_id: source_id || null,
      sender: sender || null,
      original_message: message || null,
      imported_at: new Date().toISOString()
    });

    const { rows } = await pool.query(`
      INSERT INTO transactions (date, description, amount, type, account_id, category_id, source, raw_text)
      VALUES ($1, $2, $3, $4, $5, $6, 'webhook', $7)
      RETURNING *
    `, [txnDate, txnDescription, parsedAmount, txnType, account_id, category_id, rawMeta]);

    res.json({
      status: 'imported',
      transaction: rows[0],
      category: categoryName || 'Others'
    });
  } catch (err) {
    console.error('[Webhook Import Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/webhook/import/batch
// Import multiple transactions at once
router.post('/import/batch', authenticate, async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'transactions array is required' });
    }

    if (transactions.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 transactions per batch' });
    }

    const results = { imported: 0, skipped: 0, failed: 0, errors: [] };

    for (const txn of transactions) {
      try {
        const innerRes = { json: (d) => d, status: () => ({ json: (d) => d }) };
        const fakeReq = { body: txn, headers: req.headers, query: req.query };

        const amount = parseAmount(txn.amount);
        if (!amount) {
          results.failed++;
          results.errors.push({ transaction: txn, error: 'Invalid amount' });
          continue;
        }

        const txnType = ['debit', 'credit'].includes(txn.type) ? txn.type : 'debit';
        const txnDate = txn.date || new Date().toISOString().slice(0, 10);
        const txnDescription = txn.description || txn.message || txn.sender || 'Webhook import';

        if (txn.source_id) {
          const existing = await pool.query(
            `SELECT id FROM transactions WHERE source = 'webhook' AND raw_text LIKE $1`,
            [`%"source_id":"${txn.source_id}"%`]
          );
          if (existing.rows.length > 0) {
            results.skipped++;
            continue;
          }
        }

        let category_id = null;
        if (txn.category) {
          const catRow = await pool.query(`SELECT id FROM categories WHERE LOWER(name) = LOWER($1)`, [txn.category]);
          category_id = catRow.rows[0]?.id || null;
        }
        if (!category_id) {
          const catName = await categorize(txnDescription, amount, txnType);
          const catRow = await pool.query(`SELECT id FROM categories WHERE name = $1`, [catName]);
          category_id = catRow.rows[0]?.id || null;
        }

        let account_id = null;
        if (txn.account_last4) {
          const accRow = await pool.query(`SELECT id FROM accounts WHERE last4 = $1 LIMIT 1`, [txn.account_last4]);
          account_id = accRow.rows[0]?.id || null;
        }

        const rawMeta = JSON.stringify({
          source_id: txn.source_id || null,
          sender: txn.sender || null,
          original_message: txn.message || null,
          imported_at: new Date().toISOString()
        });

        await pool.query(`
          INSERT INTO transactions (date, description, amount, type, account_id, category_id, source, raw_text)
          VALUES ($1, $2, $3, $4, $5, $6, 'webhook', $7)
        `, [txnDate, txnDescription, amount, txnType, account_id, category_id, rawMeta]);

        results.imported++;
      } catch (err) {
        results.failed++;
        results.errors.push({ transaction: txn, error: err.message });
      }
    }

    res.json(results);
  } catch (err) {
    console.error('[Webhook Batch Import Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
