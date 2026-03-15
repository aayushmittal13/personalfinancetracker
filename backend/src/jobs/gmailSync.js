const cron = require('node-cron');
const gmailRouter = require('../routes/gmail');
const syncGmail = gmailRouter.syncGmail;

// Sync every 4 hours
cron.schedule('0 */4 * * *', async () => {
  try {
    const result = await syncGmail();
    console.log(`[Gmail Sync] imported=${result.imported} skipped=${result.skipped}`);
  } catch (err) {
    // Gmail not connected yet - that's fine
    if (!err.message.includes('not connected')) {
      console.error('[Gmail Sync] Error:', err.message);
    }
  }
});

console.log('[Gmail Sync] Cron scheduled');
