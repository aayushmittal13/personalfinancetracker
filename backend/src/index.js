const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

const { categoriesRouter, accountsRouter, fixedExpensesRouter, investmentsRouter, flatmatesRouter, settingsRouter } = require('./routes/other');

app.use('/api/transactions',   require('./routes/transactions'));
app.use('/api/categories',     categoriesRouter);
app.use('/api/accounts',       accountsRouter);
app.use('/api/fixed-expenses', fixedExpensesRouter);
app.use('/api/investments',    investmentsRouter);
app.use('/api/flatmates',      flatmatesRouter);
app.use('/api/dashboard',      require('./routes/dashboard'));
app.use('/api/gmail',          require('./routes/gmail'));
app.use('/api/settings',       settingsRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Paisa backend running on ${PORT}`));

// Start cron jobs
// Start cron jobs - wrapped so startup errors don't break the server
try { require('./jobs/reminder'); } catch(e) { console.error('Reminder job failed to load:', e.message); }
try { require('./jobs/gmailSync'); } catch(e) { console.error('Gmail sync job failed to load:', e.message); }
