const assert = require('assert');

const { parseEmail } = require('../src/parsers/emailParsers');
const { categorize, ruleBasedCategory } = require('../src/parsers/categorizer');
const { getMonthRange, getPreviousMonth, toIsoDateFromEpochMs } = require('../src/utils/dateUtils');
const { buildSyncQuery, getQueryStartEpoch } = require('../src/utils/gmailSyncUtils');
// recurringMatch is tested implicitly via cron; unit tests focus on parsers/utils

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('parses HDFC UPI Zerodha debit with correct amount and date', () => {
  const parsed = parseEmail(
    'You have done a UPI txn. Check details!',
    'Dear Customer, Rs.37500.00 has been debited from account 5059 to VPA zerodha.iccl3.brk@validhdfc ICCL ZERODHA on 01-04-26. Your UPI transaction reference number is 103010503917.',
    'alerts@hdfcbank.bank.in'
  );

  assert(parsed, 'expected parser to return a transaction');
  assert.strictEqual(parsed.amount, 37500);
  assert.strictEqual(parsed.type, 'debit');
  assert.strictEqual(parsed.account_last4, '5059');
  assert.strictEqual(parsed.date, '2026-04-01');
  assert.match(parsed.description.toLowerCase(), /zerodha/);
});

test('keeps decimal amounts instead of multiplying them', () => {
  const parsed = parseEmail(
    'HDFC Alert',
    'Rs.5000.00 has been debited from account 5059 to VPA fitgym@upi on 01-04-26.',
    'alerts@hdfcbank.bank.in'
  );

  assert(parsed, 'expected parser to return a transaction');
  assert.strictEqual(parsed.amount, 5000);
});

test('categorizes Zerodha-like descriptions as Investments', async () => {
  const category = await categorize('VPA zerodha.iccl3.brk@validhdfc ICCL ZERODHA', 37500, 'debit');
  assert.strictEqual(category, 'Investments');
});

test('does not auto-label generic large credits as Salary', async () => {
  const category = await categorize('Rohan transferred funds', 25000, 'credit');
  assert.strictEqual(category, 'Others');
});

test('parses single-digit day with month names', () => {
  const parsed = parseEmail(
    'HDFC Alert',
    'Rs.1200.00 has been debited from account 5059 to VPA quickpay@upi on 1 Apr 2026.',
    'alerts@hdfcbank.bank.in'
  );

  assert(parsed, 'expected parser to return a transaction');
  assert.strictEqual(parsed.date, '2026-04-01');
});

test('uses real month boundaries for shorter months', () => {
  assert.deepStrictEqual(getMonthRange('2026-02'), {
    start: '2026-02-01',
    end: '2026-02-28'
  });
  assert.strictEqual(getPreviousMonth('2026-03'), '2026-02');
});

test('builds incremental Gmail sync query with overlap', () => {
  const lastSyncEpoch = 1712100000;
  const now = 1712500000000;
  const query = buildSyncQuery({ lastSyncEpoch, now });

  assert.strictEqual(getQueryStartEpoch(lastSyncEpoch, now), 1712056800);
  assert.match(query, /after:1712056800/);
  assert.match(query, /alerts@hdfcbank\.bank\.in/);
  assert.match(query, /transaction reference/);
});

test('rule matching is boundary aware', () => {
  assert.strictEqual(ruleBasedCategory('payment to zerodha') , 'Investments');
  assert.notStrictEqual(ruleBasedCategory('payment to zerodha'), 'House');
});

test('categorizes subscription services correctly', async () => {
  assert.strictEqual(await categorize('Netflix Monthly renewal', 499, 'debit'), 'Subscriptions');
  assert.strictEqual(await categorize('Spotify premium', 119, 'debit'), 'Subscriptions');
  assert.strictEqual(await categorize('YouTube Premium', 129, 'debit'), 'Subscriptions');
});

test('categorizes health-related expenses correctly', async () => {
  assert.strictEqual(await categorize('Apollo pharmacy medicines', 500, 'debit'), 'Health');
  assert.strictEqual(await categorize('Dr. Sharma clinic consultation', 800, 'debit'), 'Health');
});

test('categorizes transport correctly', async () => {
  assert.strictEqual(await categorize('Uber trip to office', 250, 'debit'), 'Transport');
  assert.strictEqual(await categorize('Ola cab', 180, 'debit'), 'Transport');
  assert.strictEqual(await categorize('IRCTC train booking', 1200, 'debit'), 'Transport');
});

test('categorizes house expenses correctly', async () => {
  assert.strictEqual(await categorize('Monthly rent payment', 15000, 'debit'), 'House');
  assert.strictEqual(await categorize('Airtel WiFi broadband', 699, 'debit'), 'House');
  assert.strictEqual(await categorize('Electricity BESCOM bill', 2500, 'debit'), 'House');
});

test('toIsoDateFromEpochMs handles valid and invalid inputs', () => {
  assert.strictEqual(toIsoDateFromEpochMs(1712000000000), '2024-04-01');
  assert.strictEqual(toIsoDateFromEpochMs(null), null);
  assert.strictEqual(toIsoDateFromEpochMs(0), null);
  assert.strictEqual(toIsoDateFromEpochMs('invalid'), null);
});

test('getMonthRange returns correct ranges for leap years', () => {
  assert.deepStrictEqual(getMonthRange('2024-02'), {
    start: '2024-02-01',
    end: '2024-02-29'
  });
  assert.deepStrictEqual(getMonthRange('2026-12'), {
    start: '2026-12-01',
    end: '2026-12-31'
  });
});

test('parses HDFC credit alert correctly', () => {
  const parsed = parseEmail(
    'HDFC Bank Credit Alert',
    'Rs.85000.00 has been credited to A/c **4821 on 01-04-2026. Info: SALARY NEFT',
    'alerts@hdfcbank.net'
  );
  assert(parsed, 'expected parser to return a transaction');
  assert.strictEqual(parsed.amount, 85000);
  assert.strictEqual(parsed.type, 'credit');
  assert.strictEqual(parsed.account_last4, '4821');
});

test('parses UPI sent payment correctly', () => {
  const parsed = parseEmail(
    'UPI Payment',
    'You have sent Rs.340 to swiggy@upi on 15-03-2026',
    'alerts@hdfcbank.net'
  );
  assert(parsed, 'expected parser to return a transaction');
  assert.strictEqual(parsed.amount, 340);
  assert.strictEqual(parsed.type, 'debit');
});

test('parses UPI received payment correctly', () => {
  const parsed = parseEmail(
    'UPI Credit',
    'You have received Rs.6500 from rahul@upi on 15-03-2026',
    'alerts@hdfcbank.net'
  );
  assert(parsed, 'expected parser to return a transaction');
  assert.strictEqual(parsed.amount, 6500);
  assert.strictEqual(parsed.type, 'credit');
});

async function main() {
  let failures = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(error.stack || error.message);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
    console.error(`\n${failures} test(s) failed.`);
    return;
  }

  console.log(`\n${tests.length} tests passed.`);
}

main();
