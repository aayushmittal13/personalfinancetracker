const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Accounts - your bank accounts and cards
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('bank', 'card')),
        bank TEXT NOT NULL,
        last4 TEXT,
        gmail_label TEXT,
        is_manual BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Categories
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#94a3b8',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed default categories
    await client.query(`
      INSERT INTO categories (name, color) VALUES
        ('Food', '#e05c5c'),
        ('Transport', '#4a8fd4'),
        ('Subscriptions', '#9b76e0'),
        ('Shopping', '#c48a2a'),
        ('House', '#4a8fd4'),
        ('Investments', '#1a9e6e'),
        ('Salary', '#1a9e6e'),
        ('Health', '#d45ca0'),
        ('Others', '#94a3b8')
      ON CONFLICT (name) DO NOTHING
    `);

    // Transactions - core table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
        account_id INTEGER REFERENCES accounts(id),
        category_id INTEGER REFERENCES categories(id),
        is_split BOOLEAN DEFAULT false,
        split_amount NUMERIC(12,2),
        split_group TEXT CHECK (split_group IN ('house', 'friends')),
        is_recovered BOOLEAN DEFAULT false,
        gmail_message_id TEXT UNIQUE,
        source TEXT NOT NULL CHECK (source IN ('gmail', 'manual')),
        raw_text TEXT,
        note TEXT,
        review_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (review_status IN ('pending', 'confirmed')),
        review_reason TEXT,
        parse_confidence NUMERIC(4,2),
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS note TEXT
    `);
    await client.query(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'confirmed'
    `);
    await client.query(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS review_reason TEXT
    `);
    await client.query(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS parse_confidence NUMERIC(4,2)
    `);
    await client.query(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ
    `);
    await client.query(`
      UPDATE transactions
      SET review_status = 'confirmed'
      WHERE review_status IS NULL
    `);
    await client.query(`
      ALTER TABLE transactions
      DROP CONSTRAINT IF EXISTS transactions_review_status_check
    `);
    await client.query(`
      ALTER TABLE transactions
      ADD CONSTRAINT transactions_review_status_check
      CHECK (review_status IN ('pending', 'confirmed'))
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS merchant_rules (
        id SERIAL PRIMARY KEY,
        pattern TEXT NOT NULL UNIQUE,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        hit_count INTEGER NOT NULL DEFAULT 0,
        last_used_at TIMESTAMPTZ
      )
    `);

    // Fixed expenses - recurring every month
    await client.query(`
      CREATE TABLE IF NOT EXISTS fixed_expenses (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
        account_id INTEGER REFERENCES accounts(id),
        category_id INTEGER REFERENCES categories(id),
        auto_detect BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Investments - SIPs and manual
    await client.query(`
      CREATE TABLE IF NOT EXISTS investments (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('sip', 'manual')),
        sip_day INTEGER CHECK (sip_day BETWEEN 1 AND 31),
        account_id INTEGER REFERENCES accounts(id),
        auto_detect BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Investment log - actual monthly entries
    await client.query(`
      CREATE TABLE IF NOT EXISTS investment_log (
        id SERIAL PRIMARY KEY,
        investment_id INTEGER REFERENCES investments(id),
        amount NUMERIC(12,2) NOT NULL,
        date DATE NOT NULL,
        source TEXT CHECK (source IN ('gmail', 'manual')),
        gmail_message_id TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Flatmates
    await client.query(`
      CREATE TABLE IF NOT EXISTS flatmates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        upi_id TEXT,
        expected_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Flatmate payments - what they actually paid you each month
    await client.query(`
      CREATE TABLE IF NOT EXISTS flatmate_payments (
        id SERIAL PRIMARY KEY,
        flatmate_id INTEGER REFERENCES flatmates(id),
        amount NUMERIC(12,2) NOT NULL,
        month TEXT NOT NULL,
        transaction_id INTEGER REFERENCES transactions(id),
        confirmed BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(flatmate_id, transaction_id)
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_flatmate_payments_unique
      ON flatmate_payments (flatmate_id, transaction_id)
    `);

    // Settings - salary, gmail token etc
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query('COMMIT');
    console.log('Migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
