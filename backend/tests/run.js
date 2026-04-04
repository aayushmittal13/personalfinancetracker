const assert = require('assert');

const { parseEmail } = require('../src/parsers/emailParsers');
const { categorize, ruleBasedCategory } = require('../src/parsers/categorizer');
const { getMonthRange, getPreviousMonth } = require('../src/utils/dateUtils');
const { buildSyncQuery, getQueryStartEpoch } = require('../src/utils/gmailSyncUtils');

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
