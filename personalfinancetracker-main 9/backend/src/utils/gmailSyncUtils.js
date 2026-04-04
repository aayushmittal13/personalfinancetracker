const DEFAULT_SYNC_LOOKBACK_DAYS = 45;
const SYNC_OVERLAP_SECONDS = 12 * 60 * 60;
const DEFAULT_BANK_SENDERS = [
  'alerts@hdfcbank.net',
  'hdfcbank@hdfcbank.com',
  'alerts@hdfcbank.bank.in',
  'creditcards@axisbank.com',
  'alerts@axisbank.com',
  'icicibank@icicibank.com',
  'alerts@icicibank.com',
  'indusind@indusindbank.com',
  'alerts@indusindbank.com'
];

const DEFAULT_BANK_KEYWORDS = [
  'debited',
  'credited',
  'spent',
  '"upi txn"',
  '"transaction reference"',
  '"txn"',
  '"payment"'
];

function getQueryStartEpoch(lastSyncEpoch, now = Date.now()) {
  const fallbackEpoch = Math.floor((now - DEFAULT_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000);
  if (!lastSyncEpoch) return fallbackEpoch;
  return Math.max(fallbackEpoch, Number(lastSyncEpoch) - SYNC_OVERLAP_SECONDS);
}

function buildSyncQuery({ lastSyncEpoch, now = Date.now() }) {
  const afterEpoch = getQueryStartEpoch(lastSyncEpoch, now);
  const senderQuery = `from:(${DEFAULT_BANK_SENDERS.join(' OR ')})`;
  const keywordQuery = `(${DEFAULT_BANK_KEYWORDS.join(' OR ')})`;
  return [`after:${afterEpoch}`, senderQuery, keywordQuery].join(' ');
}

module.exports = {
  DEFAULT_SYNC_LOOKBACK_DAYS,
  DEFAULT_BANK_SENDERS,
  DEFAULT_BANK_KEYWORDS,
  getQueryStartEpoch,
  buildSyncQuery
};
