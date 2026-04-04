const router = require('express').Router();
const { google } = require('googleapis');
const pool = require('../../db/pool');
const { parseEmail } = require('../parsers/emailParsers');
const { categorize } = require('../parsers/categorizer');
const { buildSyncQuery } = require('../utils/gmailSyncUtils');
const { toIsoDateFromEpochMs } = require('../utils/dateUtils');
const { getReviewMetadata } = require('../utils/reviewUtils');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const REPORT_SAMPLE_LIMIT = 5;

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function trimReportSamples(items) {
  return items.slice(0, REPORT_SAMPLE_LIMIT);
}

function summarizeSyncReport(report) {
  return {
    imported: report.imported,
    skipped: report.skipped_existing + report.skipped_unparsed + report.failed,
    total: report.total_messages,
    report
  };
}

async function saveSetting(key, value) {
  await pool.query(`
    INSERT INTO settings (key, value) VALUES ($1, $2)
    ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()
  `, [key, value]);
}

async function saveSyncReport(report) {
  await saveSetting('gmail_last_report', JSON.stringify(report));
}

async function getSetting(key) {
  const { rows } = await pool.query(`SELECT value FROM settings WHERE key=$1`, [key]);
  return rows[0]?.value || null;
}

async function fetchAllMessages(gmail, query) {
  const messages = [];
  let pageToken = undefined;

  do {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100,
      pageToken
    });

    messages.push(...(listRes.data.messages || []));
    pageToken = listRes.data.nextPageToken;
  } while (pageToken);

  return messages;
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
    await saveSetting('gmail_tokens', JSON.stringify(tokens));
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
    res.json({ ok: true, message: 'Last sync reset. Next sync will fetch older emails again.' });
  } catch (err) {
    console.error('[Gmail Reset Sync Error]', err.message);
    res.status(500).json({ error: 'Failed to reset sync' });
  }
});

// GET /api/gmail/reset-imports - remove imported Gmail transactions and reset sync
router.get('/reset-imports', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const gmailTxnIds = await client.query(`SELECT id FROM transactions WHERE source='gmail'`);
    const ids = gmailTxnIds.rows.map(row => row.id);

    if (ids.length) {
      await client.query(`
        DELETE FROM flatmate_payments
        WHERE transaction_id = ANY($1::int[])
      `, [ids]);

      await client.query(`
        DELETE FROM transactions
        WHERE id = ANY($1::int[])
      `, [ids]);
    }

    await client.query(`DELETE FROM investment_log WHERE source='gmail'`);
    await client.query(`DELETE FROM settings WHERE key IN ('gmail_last_sync', 'gmail_last_report')`);
    await client.query('COMMIT');

    res.json({
      ok: true,
      deleted_transactions: ids.length,
      message: 'Deleted Gmail-imported transactions and reset sync state.'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/gmail/report - latest sync report
router.get('/report', async (req, res) => {
  try {
    const report = await getSetting('gmail_last_report');
    if (!report) return res.json(null);
    res.json(JSON.parse(report));
  } catch (err) {
    console.error('[Gmail Report Error]', err.message);
    res.status(500).json({ error: 'Failed to load Gmail report' });
  }
});

// GET /api/gmail/status - current Gmail connection state
router.get('/status', async (req, res) => {
  try {
    const tokenValue = await getSetting('gmail_tokens');
    const lastSyncValue = await getSetting('gmail_last_sync');

    let hasRefreshToken = false;
    if (tokenValue) {
      try {
        hasRefreshToken = !!JSON.parse(tokenValue).refresh_token;
      } catch (err) {
        console.error('[Gmail Status] Invalid token payload:', err.message);
      }
    }

    const lastSyncEpoch = Number(lastSyncValue);
    res.json({
      connected: !!tokenValue,
      hasRefreshToken,
      lastSync: Number.isFinite(lastSyncEpoch) && lastSyncEpoch > 0
        ? new Date(lastSyncEpoch * 1000).toISOString()
        : null
    });
  } catch (err) {
    console.error('[Gmail Status Error]', err.message);
    res.status(500).json({ error: 'Failed to check Gmail status' });
  }
});

// POST /api/gmail/sync - pull new emails and parse transactions
router.post('/sync', async (req, res) => {
  try {
    const result = await syncGmail('manual');
    console.log('[Gmail Sync Result]', JSON.stringify({
      imported: result.imported,
      skipped: result.skipped,
      total: result.total
    }));
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
      if (part.mimeType === 'text/html') bucket.html.push(stripHtml(decoded));
      if (part.mimeType === 'text/plain') bucket.plain.push(decoded);
    }
  }

  if (Array.isArray(part.parts)) {
    part.parts.forEach(child => collectParts(child, bucket));
  }
}

function extractReadableBody(message) {
  const bucket = { plain: [], html: [] };
  collectParts(message?.payload, bucket);
  return [...bucket.plain, ...bucket.html, message?.snippet || '']
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
}

async function syncGmail(source = 'cron') {
  const report = {
    source,
    status: 'running',
    started_at: new Date().toISOString(),
    completed_at: null,
    total_messages: 0,
    imported: 0,
    skipped_existing: 0,
    skipped_unparsed: 0,
    failed: 0,
    uncategorized: 0,
    unmatched_account: 0,
    parse_failures: [],
    import_failures: [],
    uncategorized_samples: [],
    unmatched_account_samples: [],
    error: null
  };

  try {
    const tokenValue = await getSetting('gmail_tokens');
    if (!tokenValue) throw new Error('Gmail not connected');

    const tokens = JSON.parse(tokenValue);
    const lastSyncEpoch = Number(await getSetting('gmail_last_sync')) || null;
    const query = buildSyncQuery({ lastSyncEpoch });
    report.query = query;

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(tokens);
    oauth2Client.on('tokens', async (newTokens) => {
      await saveSetting('gmail_tokens', JSON.stringify({ ...tokens, ...newTokens }));
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const messages = await fetchAllMessages(gmail, query);
    report.total_messages = messages.length;

    for (const msg of messages) {
      let subject = '';
      let from = '';
      let body = '';

      try {
        const exists = await pool.query(`SELECT id FROM transactions WHERE gmail_message_id=$1`, [msg.id]);
        if (exists.rows.length) {
          report.skipped_existing++;
          continue;
        }

        const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
        const headers = full.data.payload.headers || [];
        subject = headers.find(h => h.name === 'Subject')?.value || '';
        from = headers.find(h => h.name === 'From')?.value || '';
        body = extractReadableBody(full.data);

        const parsed = parseEmail(subject, body, from);
        if (!parsed) {
          report.skipped_unparsed++;
          report.parse_failures = trimReportSamples([
            ...report.parse_failures,
            { subject, from, preview: body.slice(0, 180) || '(empty body)' }
          ]);
          continue;
        }

        const fallbackDate = toIsoDateFromEpochMs(full.data.internalDate);
        parsed.date = parsed.date || fallbackDate || new Date().toISOString().slice(0, 10);

        const accountRow = parsed.account_last4
          ? await pool.query(`SELECT id FROM accounts WHERE last4=$1 LIMIT 1`, [parsed.account_last4])
          : { rows: [] };
        const account_id = accountRow.rows[0]?.id || null;
        if (!account_id) {
          report.unmatched_account++;
          report.unmatched_account_samples = trimReportSamples([
            ...report.unmatched_account_samples,
            {
              description: parsed.description,
              account_last4: parsed.account_last4 || null,
              amount: parsed.amount
            }
          ]);
        }

        const categoryName = await categorize(parsed.description, parsed.amount, parsed.type);
        const categoryRow = await pool.query(`SELECT id FROM categories WHERE name=$1`, [categoryName]);
        const category_id = categoryRow.rows[0]?.id || null;
        const review = getReviewMetadata({
          source: 'gmail',
          categoryName,
          accountId: account_id,
          parsed
        });

        if (!category_id || categoryName === 'Others') {
          report.uncategorized++;
          report.uncategorized_samples = trimReportSamples([
            ...report.uncategorized_samples,
            {
              description: parsed.description,
              amount: parsed.amount,
              suggested_category: categoryName || null
            }
          ]);
        }

        await pool.query(`
          INSERT INTO transactions (
            date, description, amount, type, account_id, category_id, gmail_message_id,
            source, raw_text, review_status, review_reason, parse_confidence
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'gmail', $8, $9, $10, $11)
        `, [
          parsed.date,
          parsed.description,
          parsed.amount,
          parsed.type,
          account_id,
          category_id,
          msg.id,
          body.slice(0, 500),
          review.status,
          review.reason,
          review.confidence
        ]);

        report.imported++;
      } catch (err) {
        report.failed++;
        report.import_failures = trimReportSamples([
          ...report.import_failures,
          {
            subject: subject || '(subject unavailable)',
            from: from || '(sender unavailable)',
            reason: err.message
          }
        ]);
      }
    }

    await saveSetting('gmail_last_sync', String(Math.floor(Date.now() / 1000)));
    report.status = 'completed';
    report.completed_at = new Date().toISOString();
    await saveSyncReport(report);

    return summarizeSyncReport(report);
  } catch (err) {
    report.status = 'failed';
    report.completed_at = new Date().toISOString();
    report.error = err.message;
    await saveSyncReport(report);
    throw err;
  }
}

module.exports = router;
module.exports.syncGmail = syncGmail;
module.exports.buildSyncQuery = buildSyncQuery;
module.exports.extractReadableBody = extractReadableBody;
router.syncGmail = syncGmail;
