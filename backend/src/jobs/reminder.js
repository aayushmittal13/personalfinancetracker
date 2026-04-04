const cron = require('node-cron');
const pool = require('../../db/pool');
const { sendDailySummary } = require('../utils/telegram');

function getISTDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

// Run at 9pm every day IST (3:30pm UTC)
cron.schedule('30 15 * * *', async () => {
  try {
    const ist = getISTDate();
    const today = ist.toISOString().slice(0, 10);
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM transactions WHERE date = $1 AND source = 'manual'`,
      [today]
    );
    if (parseInt(rows[0].count) === 0) {
      console.log(`[Reminder] No manual transactions logged today (${today})`);
      await pool.query(`
        INSERT INTO settings (key, value) VALUES ('reminder_pending', 'true')
        ON CONFLICT (key) DO UPDATE SET value='true', updated_at=NOW()
      `);
    } else {
      await pool.query(`
        INSERT INTO settings (key, value) VALUES ('reminder_pending', 'false')
        ON CONFLICT (key) DO UPDATE SET value='false', updated_at=NOW()
      `);
    }

    sendDailySummary().catch(err =>
      console.error('[Reminder] Telegram daily summary failed:', err.message)
    );
  } catch (err) {
    console.error('[Reminder] Error:', err.message);
  }
});

console.log('[Reminder] Cron scheduled');
