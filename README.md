# Paisa - Personal Finance Tracker

## Project structure

```
paisa/
  backend/   Node.js + Express + PostgreSQL
  frontend/  React
```

---

## Deploying to Railway

### 1. Backend

1. In your Railway project, create a **new service** → Deploy from GitHub (or local)
2. Add a **PostgreSQL plugin** to the project — Railway will auto-set `DATABASE_URL`
3. In the backend service settings, add these environment variables:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://YOUR-BACKEND-URL.railway.app/api/gmail/callback
FRONTEND_URL=https://YOUR-FRONTEND-URL.railway.app
```

4. Set the **start command** to: `npm start`
5. Set the **root directory** to: `backend`
6. After deploy, run the migration once:
   - Open Railway shell for the backend service
   - Run: `npm run migrate`

### 2. Frontend

1. Create another **new service** in the same Railway project
2. Set **root directory** to: `frontend`
3. Add environment variable:
```
REACT_APP_API_URL=https://YOUR-BACKEND-URL.railway.app
```
4. Build command: `npm run build`
5. Start command: `npx serve -s build`

---

## Setting up Gmail OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable the **Gmail API**
4. Create **OAuth 2.0 credentials** (Web application type)
5. Add authorized redirect URI: `https://YOUR-BACKEND-URL.railway.app/api/gmail/callback`
6. Copy Client ID and Client Secret into Railway env vars
7. After deploy, visit: `https://YOUR-BACKEND-URL.railway.app/api/gmail/auth`
8. Approve access — Gmail is now connected

Gmail will sync every 4 hours automatically. You can also trigger a manual sync from the dashboard (↻ sync button).

---

## First time setup

When you open the app for the first time, you'll go through a 4-step onboarding:

1. **Salary** — monthly amount and credit date
2. **Accounts** — your bank accounts and cards with last 4 digits
3. **Flatmates** — names, UPI IDs, expected monthly payments
4. **Fixed expenses + SIPs** — recurring costs and investments

After that you're live. Connect Gmail and transactions will start flowing in.

---

## Local development

```bash
# Backend
cd backend
cp .env.example .env   # fill in your values
npm install
npm run migrate
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm start
```

Frontend runs on `http://localhost:3000`, backend on `http://localhost:3001`.
The frontend API client auto-detects localhost and points to port 3001.

---

## Webhook Import API

Import transactions from external sources (SMS parsers, n8n workflows, Telegram bots, etc.) via a REST webhook.

### Single transaction

```bash
curl -X POST https://YOUR-BACKEND-URL/api/webhook/import \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -d '{
    "sender": "Jupiter",
    "amount": "340.00",
    "type": "debit",
    "date": "2026-04-01",
    "message": "UPI txn of Rs.340 to Swiggy",
    "description": "Swiggy order",
    "category": "Food",
    "source_id": "unique-sms-id-123"
  }'
```

### Batch import

```bash
curl -X POST https://YOUR-BACKEND-URL/api/webhook/import/batch \
  -H "Content-Type: application/json" \
  -d '{ "transactions": [ ... ] }'
```

Set `WEBHOOK_SECRET` in env to require authentication. The `source_id` field prevents duplicate imports.

---

## Budget Tracking

Set monthly budgets per category to track spending limits:

- Navigate to the **Budget** tab in the app
- Set a target amount for each spending category
- Progress bars show real-time spending vs budget
- Dashboard shows budget alerts when categories are over limit

---

## Telegram Notifications

Get transaction alerts and daily summaries via Telegram:

1. Create a bot via [@BotFather](https://t.me/BotFather) and get the bot token
2. Get your Chat ID (send a message to the bot, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates`)
3. Set these via the settings API:

```bash
curl -X POST https://YOUR-BACKEND-URL/api/settings \
  -H "Content-Type: application/json" \
  -d '{ "key": "telegram_bot_token", "value": "YOUR_BOT_TOKEN" }'

curl -X POST https://YOUR-BACKEND-URL/api/settings \
  -H "Content-Type: application/json" \
  -d '{ "key": "telegram_chat_id", "value": "YOUR_CHAT_ID" }'
```

Features:
- Daily expense summary at 9 PM IST
- Projected monthly spend based on daily average

---

## CSV Export

Export transactions as CSV from the Transactions tab or directly via API:

```bash
curl https://YOUR-BACKEND-URL/api/transactions/export?month=2026-03 -o transactions.csv
```
