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
  const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });
  res.redirect(url);
});

// GET /api/gmail/callback - OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(req.query.code);
    console.log('[Gmail OAuth] Tokens received:', JSON.stringify({ has_refresh: !!tokens.refresh_token }));
    await pool.query(`
      INSERT INTO settings (key, value) VALUES ('gmail_tokens', $1)
      ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()
    `, [JSON.stringify(tokens)]);
    res.send('Gmail connected. You can close this tab.');
  } catch (err) {
    console.error('[Gmail OAuth Error]', err.message);
    res.status(500).send('OAuth failed: ' + err.message);
  }
});

// GET /api/gmail/reset-sync - reset last sync to pull older emails
router.get('/reset-sync', async (req, res) => {
  try {
    await pool.query(`DELETE FROM settings WHERE key='gmail_last_sync'`);
    res.json({ ok: true, message: 'Last sync reset. Next sync will fetch last 30 days.' });
  } catch (err) {
    console.error('[Gmail Reset Sync Error]', err.message);
    res.status(500).json({ error: 'Failed to reset sync' });
  }
});

// GET /api/gmail/status - current Gmail connection state
router.get('/status', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT key, value
      FROM settings
      WHERE key IN ('gmail_tokens', 'gmail_last_sync')
    `);

    const settings = {};
    rows.forEach(({ key, value }) => {
      settings[key] = value;
    });

    let hasRefreshToken = false;
    if (settings.gmail_tokens) {
      try {
        hasRefreshToken = !!JSON.parse(settings.gmail_tokens).refresh_token;
      } catch (err) {
        console.error('[Gmail Status] Invalid token payload:', err.message);
      }
    }

    const lastSyncEpoch = Number(settings.gmail_last_sync);
    const lastSync = Number.isFinite(lastSyncEpoch) && lastSyncEpoch > 0
      ? new Date(lastSyncEpoch * 1000).toISOString()
      : null;

    res.json({
      connected: !!settings.gmail_tokens,
      hasRefreshToken,
      lastSync
    });
  } catch (err) {
    console.error('[Gmail Status Error]', err.message);
    res.status(500).json({ error: 'Failed to check Gmail status' });
  }
});

// POST /api/gmail/sync - pull new emails and parse transactions
router.post('/sync', async (req, res) => {
  try {
    const result = await syncGmail();
    console.log('[Gmail Sync Result]', JSON.stringify(result));
    res.json(result);
  } catch (err) {
    console.error('[Gmail Sync Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

function decodeGmailBody(data) {
  if (!data) return '';

  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch (err) {
    return '';
  }
}

function stripHtml(html) {
  return (html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectParts(part, bucket) {
  if (!part) return;

  if (part.body?.data) {
    const decoded = decodeGmailBody(part.body.data);
    if (decoded) {
      if (part.mimeType === 'text/html') {
        bucket.html.push(stripHtml(decoded));
      } else if (part.mimeType === 'text/plain') {
        bucket.plain.push(decoded);
      }
    }
  }

  if (Array.isArray(part.parts)) {
    part.parts.forEach(child => collectParts(child, bucket));
  }
}

function extractReadableBody(message) {
  const bucket = { plain: [], html: [] };
  collectParts(message?.payload, bucket);

  const text = [...bucket.plain, ...bucket.html, message?.snippet || '']
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

async function syncGmail() {
  const tokenRow = await pool.query(`SELECT value FROM settings WHERE key='gmail_tokens'`);
  if (!tokenRow.rows.length) throw new Error('Gmail not connected');

  const tokens = JSON.parse(tokenRow.rows[0].value);
  console.log('[Gmail Sync] Has refresh token:', !!tokens.refresh_token);

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);

  oauth2Client.on('tokens', async (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    await pool.query(`
      INSERT INTO settings (key, value) VALUES ('gmail_tokens', $1)
      ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()
    `, [JSON.stringify(merged)]);
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Always look back 30 days
  const lastSync = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000).toString();
  console.log('[Gmail Sync] Looking back 30 days from:', lastSync);

  const query = [
    'from:(alerts@hdfcbank.net OR hdfcbank@hdfcbank.com OR alerts@hdfcbank.bank.in OR creditcards@axisbank.com OR icicibank@icicibank.com OR indusind@indusindbank.com)',
    `after:${lastSync}`
  ].join(' ');

  console.log('[Gmail Sync] Query:', query);

  const listRes = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 100 });
  const messages = listRes.data.messages || [];
  console.log('[Gmail Sync] Messages found:', messages.length);

  let imported = 0;
  let skipped = 0;

  for (const msg of messages) {
    try {
      const exists = await pool.query(`SELECT id FROM transactions WHERE gmail_message_id=$1`, [msg.id]);
      if (exists.rows.length) { skipped++; continue; }

      const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
      const headers = full.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const body = extractReadableBody(full.data);

      console.log('[Gmail Sync] Parsing:', subject, '|', from);
      const parsed = parseEmail(subject, body, from);
      if (!parsed) {
        console.log('[Gmail Sync] Could not parse:', subject, '| preview:', body.slice(0, 180));
        skipped++;
        continue;
      }

      const accountRow = await pool.query(
        `SELECT id FROM accounts WHERE last4=$1 LIMIT 1`,
        [parsed.account_last4]
      );
      const account_id = accountRow.rows[0]?.id || null;

      const categoryName = await categorize(parsed.description, parsed.amount, parsed.type);
      const categoryRow = await pool.query(`SELECT id FROM categories WHERE name=$1`, [categoryName]);
      const category_id = categoryRow.rows[0]?.id || null;

      await pool.query(`
        INSERT INTO transactions (date, description, amount, type, account_id, category_id, gmail_message_id, source, raw_text)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'gmail', $8)
      `, [parsed.date, parsed.description, parsed.amount, parsed.type, account_id, category_id, msg.id, body.slice(0, 500)]);

      console.log('[Gmail Sync] Imported:', parsed.description, parsed.amount);
      imported++;
    } catch (e) {
      console.error('[Gmail Sync] Error parsing message', msg.id, e.message);
      skipped++;
    }
  }

  await pool.query(`
    INSERT INTO settings (key, value) VALUES ('gmail_last_sync', $1)
    ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()
  `, [Math.floor(Date.now() / 1000).toString()]);

  return { imported, skipped, total: messages.length };
}

module.exports = router;
module.exports.syncGmail = syncGmail;
router.syncGmail = syncGmail;
