const router = require('express').Router();
const pool = require('../../db/pool');

// GET /api/transactions?month=2026-03&limit=50&offset=0
router.get('/', async (req, res) => {
  try {
    const { month, limit = 50, offset = 0 } = req.query;
    let where = '';
    const params = [];

    if (month) {
      const [y, m] = month.split('-');
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
      params.push(`${month}-01`);
      params.push(`${month}-${String(lastDay).padStart(2, '0')}`);
      where = `WHERE t.date BETWEEN $1 AND $2`;
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

// POST /api/transactions - manual add
router.post('/', async (req, res) => {
  try {
    const { date, description, amount, type, account_id, category_id } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO transactions (date, description, amount, type, account_id, category_id, source)
      VALUES ($1, $2, $3, $4, $5, $6, 'manual')
      RETURNING *
    `, [date, description, amount, type, account_id, category_id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/transactions/:id/category
router.patch('/:id/category', async (req, res) => {
  try {
    const { category_id } = req.body;
    const { rows } = await pool.query(
      `UPDATE transactions SET category_id = $1 WHERE id = $2 RETURNING *`,
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
