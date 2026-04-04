const cron = require('node-cron');
const pool = require('../../db/pool');

function normalizeText(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function similarity(a, b) {
  const wordsA = new Set(normalizeText(a).split(' '));
  const wordsB = new Set(normalizeText(b).split(' '));
  if (!wordsA.size || !wordsB.size) return 0;
  let matches = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) matches++;
  }
  return matches / Math.max(wordsA.size, wordsB.size);
}

function amountMatch(txnAmount, expectedAmount) {
  const ratio = txnAmount / expectedAmount;
  if (ratio >= 0.95 && ratio <= 1.05) return 1.0;
  if (ratio >= 0.8 && ratio <= 1.2) return 0.5;
  return 0;
}

async function matchRecurring() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = `${month}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthEnd = `${month}-${String(nextMonth.getDate()).padStart(2, '0')}`;

  try {
    const fixedExpenses = await pool.query(
      `SELECT * FROM fixed_expenses WHERE is_active = true AND auto_detect = true`
    );
    const investments = await pool.query(
      `SELECT * FROM investments WHERE is_active = true AND auto_detect = true`
    );

    const unmatched = await pool.query(`
      SELECT t.* FROM transactions t
      WHERE t.date BETWEEN $1 AND $2
        AND t.type = 'debit'
        AND NOT EXISTS (SELECT 1 FROM recurring_matches rm WHERE rm.transaction_id = t.id AND rm.month = $3)
    `, [monthStart, monthEnd, month]);

    let matched = 0;

    for (const txn of unmatched.rows) {
      let bestMatch = null;
      let bestConfidence = 0;

      for (const fe of fixedExpenses.rows) {
        const nameSim = similarity(txn.description, fe.name);
        const amtSim = amountMatch(parseFloat(txn.amount), parseFloat(fe.amount));
        const confidence = nameSim * 0.6 + amtSim * 0.4;

        if (confidence > bestConfidence && confidence >= 0.5) {
          bestConfidence = confidence;
          bestMatch = { type: 'fixed_expense', id: fe.id };
        }
      }

      for (const inv of investments.rows) {
        const nameSim = similarity(txn.description, inv.name);
        const amtSim = amountMatch(parseFloat(txn.amount), parseFloat(inv.amount));
        const confidence = nameSim * 0.6 + amtSim * 0.4;

        if (confidence > bestConfidence && confidence >= 0.5) {
          bestConfidence = confidence;
          bestMatch = { type: 'investment', id: inv.id };
        }
      }

      if (bestMatch) {
        await pool.query(`
          INSERT INTO recurring_matches (transaction_id, fixed_expense_id, investment_id, month, confidence)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [
          txn.id,
          bestMatch.type === 'fixed_expense' ? bestMatch.id : null,
          bestMatch.type === 'investment' ? bestMatch.id : null,
          month,
          bestConfidence
        ]);
        matched++;
      }
    }

    if (matched > 0) {
      console.log(`[Recurring Match] Matched ${matched} transactions for ${month}`);
    }
  } catch (err) {
    console.error('[Recurring Match] Error:', err.message);
  }
}

cron.schedule('0 6 * * *', matchRecurring);

console.log('[Recurring Match] Cron scheduled');

module.exports = { matchRecurring };
