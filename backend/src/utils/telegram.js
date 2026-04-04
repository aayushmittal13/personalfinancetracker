const pool = require('../../db/pool');

async function getSetting(key) {
  const { rows } = await pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
  return rows[0]?.value || null;
}

async function sendTelegramMessage(text, parseMode = 'HTML') {
  const botToken = await getSetting('telegram_bot_token');
  const chatId = await getSetting('telegram_chat_id');

  if (!botToken || !chatId) return null;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode
      })
    });
    const data = await response.json();
    if (!data.ok) {
      console.error('[Telegram] Send failed:', data.description);
    }
    return data;
  } catch (err) {
    console.error('[Telegram] Error:', err.message);
    return null;
  }
}

function formatCurrency(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

async function notifyTransaction(txn, categoryName) {
  const emoji = txn.type === 'credit' ? '💰' : '💳';
  const typeLabel = txn.type === 'credit' ? 'Credit' : 'Debit';
  const text = [
    `${emoji} <b>New ${typeLabel}</b>`,
    '',
    `Amount: <b>${formatCurrency(txn.amount)}</b>`,
    `Description: ${txn.description}`,
    categoryName ? `Category: ${categoryName}` : '',
    `Date: ${txn.date}`,
    `Source: ${txn.source}`
  ].filter(Boolean).join('\n');

  return sendTelegramMessage(text);
}

async function sendDailySummary() {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  try {
    const daySpent = await pool.query(`
      SELECT COALESCE(SUM(CASE WHEN is_split THEN split_amount ELSE amount END), 0) as total,
             COUNT(*) as count
      FROM transactions WHERE type = 'debit' AND date = $1
    `, [today]);

    const { start, end } = require('./dateUtils').getMonthRange(month);
    const monthSpent = await pool.query(`
      SELECT COALESCE(SUM(CASE WHEN is_split THEN split_amount ELSE amount END), 0) as total
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'debit' AND t.date BETWEEN $1 AND $2
      AND (c.name IS NULL OR c.name NOT IN ('Investments'))
    `, [start, end]);

    const todayTotal = parseFloat(daySpent.rows[0].total);
    const todayCount = parseInt(daySpent.rows[0].count);
    const monthTotal = parseFloat(monthSpent.rows[0].total);

    const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
    const dayOfMonth = new Date().getDate();
    const dailyAverage = monthTotal / dayOfMonth;
    const projectedMonthly = dailyAverage * daysInMonth;

    const text = [
      '📊 <b>Daily Summary</b>',
      '',
      `Today: <b>${formatCurrency(todayTotal)}</b> (${todayCount} transaction${todayCount !== 1 ? 's' : ''})`,
      `Month so far: <b>${formatCurrency(monthTotal)}</b>`,
      `Daily average: ${formatCurrency(dailyAverage)}`,
      `Projected monthly: ${formatCurrency(projectedMonthly)}`,
      '',
      todayCount === 0 ? '✅ No expenses logged today.' : ''
    ].filter(Boolean).join('\n');

    return sendTelegramMessage(text);
  } catch (err) {
    console.error('[Telegram Daily Summary] Error:', err.message);
    return null;
  }
}

module.exports = { sendTelegramMessage, notifyTransaction, sendDailySummary, formatCurrency };
