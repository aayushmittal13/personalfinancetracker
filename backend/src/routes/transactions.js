const router = require('express').Router();
const pool = require('../../db/pool');
const { getMonthRange } = require('../utils/dateUtils');
const { merchantKeyFromDescription } = require('../parsers/categorizer');

function nullableId(value) {
  return value === '' || value === undefined ? null : value;
}

// GET /api/transactions?month=2026-03&limit=50&offset=0
router.get('/', async (req, res) => {
  try {
    const { month, limit = 50, offset = 0, review_status = 'confirmed' } = req.query;
    let where = '';
    const params = [];

    if (month) {
      const range = getMonthRange(month);
      params.push(range.start);
      params.push(range.end);
      where = `WHERE t.date BETWEEN $1 AND $2`;
    }

    if (review_status) {
      params.push(review_status);
      where += where ? ` AND t.review_status = $${params.length}` : `WHERE t.review_status = $${params.length}`;
    }

    const { rows } = await pool.query(`
      SELECT t.*, c.name as category_name, c.color as category_color, a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      ${where}
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/review', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const { rows } = await pool.query(`
      SELECT t.*, c.name as category_name, c.color as category_color, a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.review_status = 'pending'
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions - manual add
router.post('/', async (req, res) => {
  try {
    const { date, description, amount, type, account_id, category_id } = req.body;
    if (!date || !description || !amount || !type) {
      return res.status(400).json({ error: 'Date, description, amount, and type are required' });
    }
    if (!['debit', 'credit'].includes(type)) {
      return res.status(400).json({ error: 'Type must be debit or credit' });
    }
    const { rows } = await pool.query(`
      INSERT INTO transactions (date, description, amount, type, account_id, category_id, source, review_status, reviewed_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'manual', 'confirmed', NOW())
      RETURNING *
    `, [date, description, amount, type, nullableId(account_id), nullableId(category_id)]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/transactions/:id - update any fields
router.patch('/:id', async (req, res) => {
  try {
    const { description, amount, type, date, category_id, account_id } = req.body;
    const { rows } = await pool.query(`
      UPDATE transactions
      SET description = COALESCE($1, description),
          amount = COALESCE($2, amount),
          type = COALESCE($3, type),
          date = COALESCE($4, date),
          category_id = $5,
          account_id = $6,
          review_status = 'confirmed',
          reviewed_at = NOW(),
          review_reason = NULL
      WHERE id = $7 RETURNING *
    `, [description, amount, type, date, nullableId(category_id), nullableId(account_id), req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Transaction not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/review', async (req, res) => {
  const client = await pool.connect();

  try {
    const { description, amount, type, date, category_id, account_id, learn_rule = true } = req.body;
    if (!category_id) {
      return res.status(400).json({ error: 'Category is required to confirm a transaction' });
    }

    await client.query('BEGIN');
    const existing = await client.query(`SELECT * FROM transactions WHERE id = $1`, [req.params.id]);
    const txn = existing.rows[0];
    if (!txn) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const nextDescription = description ?? txn.description;
    const nextAmount = amount ?? txn.amount;
    const nextType = type ?? txn.type;
    const nextDate = date ?? txn.date;
    const nextAccountId = account_id === undefined ? txn.account_id : nullableId(account_id);

    const { rows } = await client.query(`
      UPDATE transactions
      SET description = $1,
          amount = $2,
          type = $3,
          date = $4,
          category_id = $5,
          account_id = $6,
          review_status = 'confirmed',
          reviewed_at = NOW(),
          review_reason = NULL
      WHERE id = $7
      RETURNING *
    `, [nextDescription, nextAmount, nextType, nextDate, nullableId(category_id), nextAccountId, req.params.id]);

    if (learn_rule && txn.source === 'gmail') {
      const pattern = merchantKeyFromDescription(nextDescription);
      if (pattern) {
        await client.query(`
          INSERT INTO merchant_rules (pattern, category_id, updated_at, hit_count, last_used_at)
          VALUES ($1, $2, NOW(), 1, NOW())
          ON CONFLICT (pattern)
          DO UPDATE SET
            category_id = EXCLUDED.category_id,
            updated_at = NOW(),
            hit_count = merchant_rules.hit_count + 1,
            last_used_at = NOW()
        `, [pattern, category_id]);
      }
    }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/transactions/:id/category
router.patch('/:id/category', async (req, res) => {
  try {
    const { category_id } = req.body;
    const { rows } = await pool.query(
      `UPDATE transactions SET category_id = $1, review_status = 'confirmed', reviewed_at = NOW(), review_reason = NULL WHERE id = $2 RETURNING *`,
      [category_id, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/transactions/:id/split - mark as split
router.patch('/:id/split', async (req, res) => {
  try {
    const { is_split, split_amount, split_group } = req.body;
    const { rows } = await pool.query(`
      UPDATE transactions SET is_split=$1, split_amount=$2, split_group=$3 WHERE id=$4 RETURNING *
    `, [is_split, split_amount, split_group, req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM transactions WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
