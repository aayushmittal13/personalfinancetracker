const router = require('express').Router();
const { google } = require('googleapis');
const pool = require('../../db/pool');
const { parseEmail } = require('../parsers/emailParsers');
const { categorize } = require('../parsers/categorizer');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// GET /api/gmail/auth - start OAuth
router.get('/auth', (req, res) => {
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
  res.redirect(url);
});

// GET /api/gmail/callback - OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(req.query.code);
    // Save tokens to settings
    await pool.query(`
      INSERT INTO settings (key, value) VALUES ('gmail_tokens', $1)
      ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()
    `, [JSON.stringify(tokens)]);
    res.send('Gmail connected. You can close this tab.');
  } catch (err) {
    res.status(500).send('OAuth failed: ' + err.message);
  }
});

// POST /api/gmail/sync - pull new emails and parse transactions
router.post('/sync', async (req, res) => {
  try {
    const result = await syncGmail();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function syncGmail() {
  // Get stored tokens
  const tokenRow = await pool.query(`SELECT value FROM settings WHERE key='gmail_tokens'`);
  if (!tokenRow.rows.length) throw new Error('Gmail not connected');

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(JSON.parse(tokenRow.rows[0].value));

  // Refresh token if needed
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.refresh_token) {
      await pool.query(`
        INSERT INTO settings (key, value) VALUES ('gmail_tokens', $1)
        ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()
      `, [JSON.stringify(tokens)]);
    }
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Search for bank emails from last sync
  const lastSyncRow = await pool.query(`SELECT value FROM settings WHERE key='gmail_last_sync'`);
  const lastSync = lastSyncRow.rows[0]?.value || 'now-7d';

  const query = [
    'from:(alerts@hdfcbank.net OR hdfcbank@hdfcbank.com OR creditcards@axisbank.com OR icicibank@icicibank.com OR indusind@indusindbank.com)',
    `after:${lastSync}`
  ].join(' ');

  const listRes = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 100 });
  const messages = listRes.data.messages || [];

  let imported = 0;
  let skipped = 0;

  for (const msg of messages) {
    try {
      // Check if already imported
      const exists = await pool.query(`SELECT id FROM transactions WHERE gmail_message_id=$1`, [msg.id]);
      if (exists.rows.length) { skipped++; continue; }

      const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
      const headers = full.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';

      // Extract body
      let body = '';
      const parts = full.data.payload.parts || [full.data.payload];
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf8');
        }
      }

      const parsed = parseEmail(subject, body, from);
      if (!parsed) { skipped++; continue; }

      // Find matching account
      const accountRow = await pool.query(
        `SELECT id FROM accounts WHERE last4=$1 LIMIT 1`,
        [parsed.account_last4]
      );
      const account_id = accountRow.rows[0]?.id || null;

      // Auto-categorize
      const categoryName = await categorize(parsed.description, parsed.amount, parsed.type);
      const categoryRow = await pool.query(`SELECT id FROM categories WHERE name=$1`, [categoryName]);
      const category_id = categoryRow.rows[0]?.id || null;

      await pool.query(`
        INSERT INTO transactions (date, description, amount, type, account_id, category_id, gmail_message_id, source, raw_text)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'gmail', $8)
      `, [parsed.date, parsed.description, parsed.amount, parsed.type, account_id, category_id, msg.id, body.slice(0, 500)]);

      imported++;
    } catch (e) {
      console.error('Error parsing message', msg.id, e.message);
      skipped++;
    }
  }

  // Update last sync timestamp
  await pool.query(`
    INSERT INTO settings (key, value) VALUES ('gmail_last_sync', $1)
    ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()
  `, [Math.floor(Date.now() / 1000).toString()]);

  return { imported, skipped, total: messages.length };
}

// Export router as default for Express mounting
// Export syncGmail as named export for cron job
module.exports = router;
module.exports.syncGmail = syncGmail;
router.syncGmail = syncGmail;
