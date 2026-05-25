# Bappy — Comprehensive App Documentation

> **Version:** 1.0.0  
> **Last updated:** May 2026 (revised)  
> **Live URL:** https://bappy-app.web.app  
> **Firebase project:** `bappy-app`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack & Architecture](#2-tech-stack--architecture)
3. [Project Structure](#3-project-structure)
4. [Data Model](#4-data-model)
5. [State Management & Business Logic](#5-state-management--business-logic)
6. [Features](#6-features)
7. [Google Services Setup](#7-google-services-setup)
8. [Deployment](#8-deployment)
9. [Troubleshooting](#9-troubleshooting)
10. [User Guide](#10-user-guide)

---

## 1. Overview

**Bappy** is a personal budgeting progressive web app (PWA) designed for UK users. It lets you track accounts, log and import bank transactions, set budgets, schedule recurring payments, and receive smart nudges about your financial health. All data is stored locally in your browser and optionally synced to Google Sheets as a personal cloud backup — no server infrastructure required.

### Key principles

- **Privacy-first** — your financial data never leaves your browser unless you explicitly sync it to your own Google Sheet.
- **Zero back-end** — the app is 100% static HTML/JS/CSS, hosted on Firebase Hosting. All "cloud" features (sync, email) go through Google's own APIs using your OAuth token.
- **Offline-capable** — a PWA service worker caches all assets so the app runs without an internet connection after first load.
- **UK-native** — amounts default to GBP (£), dates display in British format (d MMM), and the default pay-cycle model assumes monthly salary.

---

## 2. Tech Stack & Architecture

| Layer | Technology |
|---|---|
| UI framework | React 18.3 with hooks (no class components) |
| Build tool | Vite 5.4 + `@vitejs/plugin-basic-ssl` (HTTPS dev server) |
| PWA | Custom service worker (`public/sw.js`) + `manifest.json` — cache-first for assets, network-first for navigation |
| Hosting | Firebase Hosting (`bappy-app` project) |
| Local storage | Dual-write: IndexedDB (primary, gigabyte capacity) + `localStorage` (fast sync backup, key: `bappy.state.v4`) via `bappy-storage.js` |
| Cloud sync | Google Sheets API v4 |
| Authentication | Google Identity Services (GIS) — OAuth 2.0 implicit token flow |
| Email | Gmail API v1 (send only, via user's own account) |
| Spreadsheet import | SheetJS (`xlsx` v0.18.5) loaded dynamically |
| Charts | Custom SVG components (no chart library dependency) |
| Styling | Inline styles + CSS custom properties (no Tailwind, no CSS-in-JS library) |

### Architecture overview

```
Browser
  ├── bappy-app.jsx          ← Root shell: router, sheet overlay, sync banner
  ├── bappy-state.jsx        ← Single global state (useReducer) + localStorage + Google Sheets sync
  ├── bappy-nav.jsx          ← Stack-based router + ScreenHeader + TabBar + FAB
  │
  ├── Screens (tabs)
  │   ├── bappy-screens-home.jsx         ← Dashboard / Home tab
  │   ├── bappy-screens-money.jsx        ← Accounts, ledger, add/edit transactions
  │   ├── bappy-screens-plan.jsx         ← Budgets, recurring payments, forecast
  │   ├── bappy-screens-insights.jsx     ← Spending insights (overview + categories)
  │   ├── bappy-screens-insights-reports.jsx ← Reports and debt projections
  │   └── bappy-screens-more.jsx         ← Settings, nudge rules, import, export
  │
  ├── Shared UI
  │   ├── bappy-primitives.jsx  ← Card, Button, Sheet, Toggle, ListRow, Tag, Segmented…
  │   ├── bappy-icons.jsx       ← SVG icon set + BappyLogo
  │   └── bappy-charts.jsx      ← Sparkline, AreaChart, Donut, BarChart, StackedDebt, DebtCurve
  │
  └── Services
      ├── bappy-data.js      ← DEFAULT_CATEGORIES, DEFAULT_NUDGE_RULES, DEFAULT_SETTINGS, BAPPY_SEED
      ├── bappy-storage.js   ← Dual-write storage layer (IndexedDB + localStorage); migration helper
      ├── google-auth.js     ← OAuth token client, Gmail send, profile fetch
      └── gsheets.js         ← Sheets read/write, Drive file lookup/create
```

### Data flow

```
User action
    │
    ▼
dispatch(action)    ← useReducer in BappyProvider
    │
    ▼
bappyReducer()      ← pure function, returns new state
    │
    ├──► Storage.save(state)   [debounced 250 ms]
    │      ├── IndexedDB.put()    (primary — gigabyte capacity)
    │      └── localStorage.set() (backup — fast sync read on next load)
    │          If both fail → storageError shown in yellow SyncBanner
    │
    └──► React re-renders all consumers via BappyContext
              │
              ├──► (debounced 1.5 s, auto, Google sign-in only)
              │    writeAll(token, sheetId, state) → Google Sheets API
              │
              └──► (on tab focus / visibility change, throttled 120 s, auto)
                   readAll(token, sheetId) → MERGE_REMOTE → state
```

---

## 3. Project Structure

```
MyBudgetApp v1/
├── index.html                 ← Entry point; loads Google Identity Services script
├── vite.config.js             ← Vite + React + PWA plugin config; HTTPS dev server
├── package.json               ← Dependencies (react, react-dom, xlsx + vite plugins)
├── .env.local                 ← VITE_GOOGLE_CLIENT_ID (not committed)
├── firebase.json              ← Firebase Hosting config (rewrites all to index.html)
├── .firebaserc                ← Project alias: bappy-app
├── BAPPY_DOCS.md              ← This file
│
└── src/
    ├── main.jsx               ← ReactDOM.createRoot; mounts <App />; registers SW (prod only)
    ├── bappy-app.jsx          ← <App> root: BappyAuthProvider → BappyProvider → BappyRouter
    ├── bappy-data.js          ← Static seed data (categories, rules, defaults)
    ├── bappy-state.jsx        ← State, reducer, BappyContext, BappyAuthContext, BappyUtil
    ├── bappy-storage.js       ← Dual-write storage layer (IndexedDB primary + localStorage backup)
    ├── bappy-nav.jsx          ← BappyRouter, BappyRouteContext, ScreenHeader, TabBar, FAB
    ├── bappy-primitives.jsx   ← Reusable UI primitives
    ├── bappy-icons.jsx        ← SVG icon definitions
    ├── bappy-charts.jsx       ← SVG chart components
    ├── google-auth.js         ← GIS token client + Gmail API helper
    ├── gsheets.js             ← Google Sheets + Drive API helpers
    ├── bappy-screens-home.jsx
    ├── bappy-screens-money.jsx
    ├── bappy-screens-plan.jsx
    ├── bappy-screens-insights.jsx
    ├── bappy-screens-insights-reports.jsx
    ├── bappy-screens-more.jsx
    └── bappy-screens-login.jsx
```

---

## 4. Data Model

All state lives in a single JS object persisted to `localStorage`. The shape is defined in `BAPPY_SEED` inside `bappy-data.js`.

### Top-level state shape

```js
{
  categories:     Category[],      // spending categories (taxonomy)
  accounts:       Account[],       // bank accounts, credit cards, loans
  transactions:   Transaction[],   // all posted transactions
  recurring:      Recurring[],     // recurring payment templates
  budgets:        Budget[],        // monthly budget envelopes
  suggestions:    Suggestion[],    // AI-style spend suggestions (not yet persisted to Sheets)
  nudges:         Nudge[],         // notification queue
  nudgeRules:     NudgeRule[],     // routing / throttling / escalation rules
  nudgeTypePrefs: object,          // per-nudge-type channel overrides (optional, defaults to {})
  pushDevices:    PushDevice[],    // registered web push subscriptions (optional, defaults to [])
  settings:       Settings,        // user preferences
  lastImport:     ImportRecord | null, // metadata for import rollback
}
```

---

### Category

```js
{
  id:    'cat-grocery',    // string, stable ID
  name:  'Groceries',      // display name
  glyph: 'cart',           // icon name (from bappy-icons.jsx)
  tint:  '#02A8B9',        // hex colour used for icon backgrounds and charts
}
```

**14 built-in categories** (cannot be deleted; user-added categories can be deleted):
`Groceries, Transport, Utilities, Rent, Eating out, Subscriptions, Personal care, Clothing, Household, Entertainment, Fees & charges, Income, Transfer, Other`

---

### Account

```js
{
  id:        'acc-1234567890',  // generated: 'acc-' + Date.now()
  name:      'Monzo Current',
  type:      'current',         // 'current' | 'savings' | 'credit_card' | 'loan' | 'investment' | 'pension'
  balance:   1234.56,           // live running balance, maintained by reducer
  currency:  'GBP',
  last4:     '1234',            // last 4 digits of card (optional)
  limit:     2000,              // credit limit (credit cards only, optional)
  apr:       22.9,              // APR % (credit cards + loans, optional)
  principal: 8500,              // original loan amount (loans only, optional)
}
```

**Balance sign convention:**
- Current / savings / cash accounts: positive = money you have.
- Credit card: **negative** = you owe money. (e.g. −£450 means £450 owing.)
- Loan: **negative** = outstanding debt.

---

### Transaction

```js
{
  id:                    'tx-1234567890',  // generated: 'tx-' + Date.now()
  date:                  '2026-05-20',     // ISO date string YYYY-MM-DD
  amount:                42.50,            // always positive; direction determines sign
  direction:             'expense',        // 'expense' | 'income' | 'transfer' | 'transfer-in'
  description:           'Tesco Extra',
  accountId:             'acc-xxx',        // owning account
  categoryId:            'cat-grocery',
  type:                  'one_off',        // 'one_off' | 'recurring'
  status:                'posted',         // 'posted' | 'pending' | 'projected'
  recurrenceTemplateId:  null,             // set when created from a recurring template
  transferToId:          null,             // destination account ID (transfer-out leg only)
}
```

**Transfer pairs:** When a transfer is recorded, two transactions are created:
- **transfer-out** leg on the source account (`direction: 'transfer'`, `transferToId: destId`)
- **transfer-in** leg on the destination account (`direction: 'transfer-in'`, `transferToId: srcId`)

Deleting a transfer-out automatically deletes the paired transfer-in and reverses both account balances.

---

### Recurring

```js
{
  id:          'rec-xxx',
  payee:       'Netflix',
  amount:      17.99,
  direction:   'expense',   // 'expense' | 'income'
  frequency:   'monthly',   // 'monthly' | 'weekly' | 'annually'
  nextDue:     '2026-06-01', // ISO date of next occurrence
  accountId:   'acc-xxx',
  categoryId:  'cat-subs',
  active:      true,
}
```

---

### Budget

```js
{
  id:         'bud-xxx',
  categoryId: 'cat-grocery',
  amount:     300,           // monthly spending limit in GBP
  period:     'monthly',     // 'monthly' | 'weekly' | 'annually'
  scope:      'category',    // always 'category' for now
  spent:      0,             // stored at creation but NOT used for display —
                             // live spent is computed from transactions at render time
}
```

> **Note:** `budget.spent` is a stale write-once field. All progress bars and health
> calculations derive spend dynamically via `computeSpent(state, budget)`, which
> sums matching expense transactions in the current calendar month.

---

### Nudge

```js
{
  id:        'nudge-xxx',
  type:      'low_balance',  // nudge type key
  severity:  'warning',      // 'info' | 'warning' | 'alert'
  title:     'Balance getting low',
  body:      'Your Monzo balance is £87.',
  status:    'new',          // 'new' | 'seen' | 'acted'
  createdAt: '2026-05-20T10:00:00Z',
  channels:  ['in_app', 'email'],
}
```

---

### NudgeRule

```js
{
  id:       'R1',
  axis:     'routing',       // 'routing' | 'throttling' | 'escalation'
  priority: 100,             // higher = evaluated first
  name:     'Base routing — all nudges get in-app',
  when:     { nudge_type: '*' },
  then:     { add_channels: ['in_app'] },
  active:   true,
}
```

Rules are evaluated in priority order within each axis. `set_channels` overrides all; `add_channels` adds; `remove_channels` removes.

---

### Settings

```js
{
  payFrequency:                  'monthly',   // 'monthly' | 'weekly' | 'biweekly'
  payAnchorDay:                  25,          // day of month for monthly pay (1–31)
  payAnchorWeekday:              5,           // JS weekday: 0=Sun, 1=Mon … 6=Sat
  forecastHorizonDays:           90,          // days to project cash-flow forward
  detectionConfidenceThreshold:  0.7,         // min confidence for recurring detection
  quietHours:                    { start: '22:00', end: '07:00' },
  emailDigestMode:               'immediate', // 'immediate' | 'daily' | 'weekly'
  lowBalanceFloor:               200,         // £ threshold for low-balance nudge
  currency:                      'GBP',
  weekStart:                     'Mon',
}
```

---

### ImportRecord (lastImport)

Stored after every bulk import to enable rollback:

```js
{
  ids:      ['tx-1234', 'tx-1235', ...],  // transaction IDs in this batch
  count:    34,                           // number of transactions imported
  date:     '2026-05-20',                 // date of import
  filename: 'statement_May26.xlsx',        // original filename
}
```

`lastImport` is set to `null` after a successful rollback, and overwritten by each new import (only the most recent import can be rolled back).

---

## 5. State Management & Business Logic

### Reducer actions (dispatch reference)

| Action type | Payload | Effect |
|---|---|---|
| `RESET` | — | Restores `BAPPY_SEED` (wipes all personal data) |
| `RESTORE` | `{ state }` | Replaces full state (used by async IndexedDB load to upgrade initial localStorage snapshot) |
| `MERGE_REMOTE` | `{ remote: { Categories, Accounts, Transactions, … } }` | Replaces local arrays with Sheets data (remote wins if non-empty); deduplicates transaction IDs |
| `ADD_ACCOUNT` | `{ account: { name, type, balance, … } }` | Adds account, assigns `acc-{timestamp}` id |
| `UPDATE_ACCOUNT` | `{ id, patch }` | Merges patch into account |
| `DELETE_ACCOUNT` | `{ id }` | Removes account **and** all its transactions (cascade) |
| `IMPORT_BATCH` | `{ txns: Transaction[], filename }` | Atomically adds all txns, adjusts account balances, records `lastImport` |
| `ROLLBACK_IMPORT` | — | Removes all txns in `lastImport.ids`, reverses balance changes, clears `lastImport` |
| `ADD_TRANSACTION` | `{ txn: Transaction }` | Adds txn, adjusts account balance; for transfers adds both legs |
| `UPDATE_TRANSACTION` | `{ id, patch }` | Reverses old balance effect, applies new — handles account or direction change |
| `DELETE_TRANSACTION` | `{ id }` | Removes txn, reverses balance; for transfer-out also removes paired transfer-in |
| `ADD_RECURRING` | `{ rec }` | Adds recurring template |
| `TOGGLE_RECURRING` | `{ id }` | Flips `active` on a recurring template |
| `UPDATE_RECURRING` | `{ id, patch }` | Updates recurring template fields |
| `DELETE_RECURRING` | `{ id }` | Removes recurring template |
| `MARK_RECURRING_PAID` | `{ id }` | Posts a cleared transaction for today, adjusts account balance, advances `nextDue` by one period |
| `ADD_BUDGET` | `{ budget }` | Adds budget envelope |
| `UPDATE_BUDGET` | `{ id, patch }` | Updates budget |
| `DELETE_BUDGET` | `{ id }` | Removes budget |
| `ACCEPT_SUGGESTION` | `{ id }` | Creates a recurring template from a suggestion, marks suggestion `accepted` |
| `DISMISS_SUGGESTION` | `{ id }` | Marks suggestion `dismissed` |
| `ADD_CATEGORY` | `{ cat }` | Adds user-defined category |
| `UPDATE_CATEGORY` | `{ id, patch }` | Updates category |
| `DELETE_CATEGORY` | `{ id }` | Removes category |
| `UPDATE_NUDGE` | `{ id, patch }` | Updates nudge (e.g. status `'new'` → `'seen'` → `'acted'`) |
| `UPDATE_NUDGE_TYPES` | `{ patch }` | Replaces `nudgeTypePrefs` object |
| `TOGGLE_RULE` | `{ id }` | Flips `active` on a nudge rule |
| `UPDATE_RULE` | `{ id, patch }` | Merges patch into a nudge rule |
| `ADD_RULE` | `{ axis }` | Appends a blank rule for the given axis |
| `ADD_DEVICE` | `{ device }` | Registers a web push device subscription |
| `REMOVE_DEVICE` | `{ id }` | Removes a web push device subscription |
| `UPDATE_SETTINGS` | `{ patch }` | Merges patch into settings |

---

### Balance calculation

Account balances are **always kept in sync by the reducer** — never calculated on the fly from the transaction list. This means:

- Every `ADD_TRANSACTION` atomically applies the delta: `+amount` for income, `−amount` for expense/transfer.
- Every `DELETE_TRANSACTION` reverses the delta.
- `UPDATE_TRANSACTION` first reverses the *old* delta on the *old* account, then applies the *new* delta on the *new* account (supporting account changes and direction flips in one step).
- `IMPORT_BATCH` sums all deltas per account and applies them in a single pass.

Because balances are stored on the account object and saved to `localStorage` on every state change, they survive page reloads without rescanning all transactions.

---

### Pay schedule & "available to spend"

`BappyUtil.nextPayday(settings)` computes the next pay date:
- **Monthly:** find day `payAnchorDay` in the current month; if already past, advance to next month.
- **Weekly / bi-weekly:** find the next occurrence of `payAnchorWeekday` (JS convention: 0=Sun, 1=Mon … 6=Sat).

`BappyUtil.availableToSpend(state)` = current account balance minus all recurring expenses projected between now and the next pay date. This is the "safe to spend" figure shown on the home screen.

---

### Cash-flow forecast

`BappyUtil.projectCashFlow(state, days)` simulates the running balance of the primary account day by day up to `forecastHorizonDays`:
1. Seeds with the current account balance.
2. For each day, adds/subtracts any recurring transactions due on that date.
3. Returns `[{ date, balance }]` — used by the forecast area chart in Plan tab.

---

### Debt payoff simulation

`BappyUtil.simulateDebt(balance, apr, monthlyPayment)` runs a month-by-month amortisation:
- Computes monthly interest = `balance × (apr/100/12)`.
- Principal reduction = `payment − interest`.
- If payment ≤ interest, debt never clears (`neverClears: true`).
- Returns `{ payoffMonths, interestPaid, curve, neverClears }` — used by DebtCurve chart in Reports.

---

### Recurring detection

The app detects likely recurring transactions by looking for payees that appear repeatedly at consistent intervals with consistent amounts. The `detectionConfidenceThreshold` setting (default 0.7) controls how confidently a pattern must be detected before surfacing a suggestion to the user.

---

### Nudge rule engine

Nudge rules are evaluated in three passes (highest priority first within each axis):
1. **Routing** — determines which channels (in_app, email, web_push) receive the nudge.
2. **Throttling** — caps how many notifications can be sent per channel per day/type.
3. **Escalation** — re-pushes unacted nudges with upgraded severity after a timeout.

Rules use a DSL stored in `nudgeRules[]`. The active/inactive toggle on each rule lets users customise behaviour without deleting rules.

---

## 6. Features

### 6.1 Accounts

**What it does:** Track all your bank accounts, credit cards, loans, and cash wallets in one place.

**Account types:**
| Type | Balance convention | Extra fields |
|---|---|---|
| `current` | Positive = funds available | — |
| `savings` | Positive = funds saved | — |
| `credit_card` | Negative = balance owed | `limit`, `apr`, `last4` |
| `loan` | Negative = debt outstanding | `apr`, `principal` |
| `investment` | Positive = portfolio value | — |
| `pension` | Positive = pension value | — |

**Operations:**
- **Add account** — tap the `+` FAB on the Money tab, fill in type, name, opening balance.
- **Edit account** — tap the pencil icon on any account detail screen to change name, balance, or credit parameters.
- **Delete account** — in edit view, tap "Delete account & N transactions". This permanently removes the account and all associated transactions (with an automatic balance reversal).

---

### 6.2 Transactions

**What it does:** Log, view, edit, and delete individual transactions against any account.

**Transaction directions:**
| Direction | Effect on balance |
|---|---|
| `expense` | Decreases account balance |
| `income` | Increases account balance |
| `transfer` | Decreases source, increases destination |
| `transfer-in` | System-generated mirror of a transfer |

**Viewing:** Transactions are listed per account on the Account Detail screen and across all accounts on the Ledger screen (Money tab → "All transactions").

**Adding:** Tap the `+` FAB while on a Money tab screen. Use the number pad to enter an amount, toggle income/expense/transfer, select category and date, optionally add a description.

**Editing:** Tap any transaction row to open the Edit Transaction sheet:
- For regular transactions: change amount, direction, account, category, date, description.
- For transfers: only date and note are editable (to preserve the paired leg integrity).

**Deleting:** Inside Edit Transaction, tap "Delete transaction". For a transfer, this removes both legs and reverses both account balances.

---

### 6.3 Import from file

**What it does:** Import transaction history from bank statement exports (Excel or CSV).

**Supported formats:**
- Excel `.xlsx` / `.xls` / `.xlsm` (parsed with SheetJS)
- CSV (any delimiter — comma-based auto-parser)

**How it works:**
1. Open More → Import transactions.
2. Select a file from your device.
3. The app reads the first sheet, auto-detects the header row, and maps columns (date, description, amount or debit/credit).
4. A preview shows how many valid rows were found and a sample of parsed transactions.
5. Select the target account and tap "Import N transactions".
6. All transactions are added atomically via `IMPORT_BATCH`.

**Date format detection** (smart parser supports all common bank export formats):
| Format | Example | Detection rule |
|---|---|---|
| ISO | `2026-05-20` | Direct match |
| UK slash | `20/05/2026` | 4-digit year + first field ≤ 12 if second > 12, else first field |
| US credit card | `5/20/26` | 2-digit year, second field > 12 → M/D/YY |
| UK day-month | `05/06/2026` | 4-digit year, both ≤ 12 → assume D/M |
| Named month | `20 May 26` | `DD Mon YY` pattern |
| Excel serial | `46200` | Numeric > 40000 → converted from Excel epoch |

**Zero rows returned?** The most common causes are:
- All dates in an unrecognised format → check the "Date format" section in Troubleshooting.
- All amounts are zero (blank debit + blank credit rows).
- The file has no header row — add headers manually.

---

### 6.4 Import rollback

**What it does:** Undo the most recent file import with one tap.

After any successful import, the More home screen shows a persistent row:  
*"Undo last import — N transactions from filename.xlsx (date)"*

Tapping it dispatches `ROLLBACK_IMPORT` which:
1. Identifies all transaction IDs from the import batch (stored in `state.lastImport`).
2. Removes those transactions.
3. Reverses all account balance changes.
4. Clears `lastImport` (rollback can only be done once per import).

**Important:** Only the most recent import can be rolled back. If you import again, the previous rollback window is lost.

---

### 6.5 Export / Backup

Access from More → Backup & export.

| Export type | Contents | Format |
|---|---|---|
| **Excel export** | Transactions, Accounts, Budgets (Category, Limit, Period), Recurring (Payee, Amount, Frequency, NextDue, Active) — 4 sheets | `.xlsx` |
| **CSV export** | All transactions (Date, Description, Amount, Direction, Account, Category, Status) | `.csv` |
| **JSON export** | Full app state (all data, settings, rules) | `.json` |

Excel and CSV exports use SheetJS loaded dynamically on demand. All exports trigger a browser file download.

**Cloud sync** (via Google Sheets) is a separate live sync feature — see section 6.12.

---

### 6.6 Budgets

**What it does:** Set spending limits per category and track progress.

- Add a budget via Plan tab → Budgets → **+ New** (opens a category picker, period selector, and amount field).
- Each budget card shows a coloured progress bar: green → amber (> 80%) → red (≥ 100%).
- Spending is calculated dynamically from transactions in the current calendar month — `budget.spent` stored on the record is intentionally ignored.
- **Budget health donut** (top of the Budgets screen): summarises all budgets in a single chart. The spent arc is split into three health tiers:
  - 🟢 **Seafoam** — spend from budgets still under 80% of limit
  - 🟡 **Amber** — spend from budgets between 80–99%
  - 🔴 **Coral** — spend from budgets at or over 100%
  - ⬜ **Grey** — unspent remainder of the total envelope
  - Below the donut: a count per tier (e.g. "3 on track · 1 at risk · 1 over") and a total aggregate progress bar.

---

### 6.7 Recurring payments

**What it does:** Track bills, subscriptions, and regular income so they appear in forecasts.

- Templates have a `frequency` (monthly / weekly / annually) and a `nextDue` date.
- `BappyUtil.projectRecurring(recurring, days)` projects all active templates forward over a given horizon, used by the Plan tab and the cash-flow forecast.
- **Mark as paid** — a "✓ Mark as paid" button appears on any active template that is due within the next 3 days or is overdue. Tapping it: posts a cleared transaction dated today, adjusts the account balance, and advances `nextDue` by one period (`MARK_RECURRING_PAID` action). Overdue items also show a red "overdue" tag.
- **Pause/resume** — the toggle on each row flips `active`. Inactive templates are excluded from projections and do not show the "Mark as paid" button.
- Items flagged as `source: 'detected'` show a "detected" tag. Items where `amount > baseline × 1.1` show a "drift" tag.

---

### 6.8 Insights

**Home tiles:** Cash flow (30-day projection sparkline), Debt-free date, Available to spend, and Upcoming payments (next 7 days).

**This month — by type:** Donut chart + legend showing expenses split by transaction *type* (`direct_debit`, `subscription`, `one_off`, etc.), not by category. Total spend shown in the centre.

**Other reports** (grid of tiles at the bottom of Insights Home):
- By category — period picker + income/expense toggle + sortable bar chart
- Summaries — 6-month income vs expense bar chart + net saving line + month-by-month list
- Net worth — see §6.9

---

### 6.9 Reports

**Net worth** (Insights → Other reports → Net worth)

- **Hero card:** current net worth (total assets minus total liabilities), month-on-month change badge, and assets / liabilities subtotals.
- **6-month history chart:** per-month grouped bar chart — green bars rise above the zero line for total assets; red bars descend below it for liabilities; a teal dot-connected line shows net worth. Balance history is reconstructed by reversing transactions that occurred after each month's end against the current live balance.
- **Assets breakdown:** each account with a positive balance, its type, amount, share of total assets, and a proportional mini-bar.
- **Liabilities breakdown:** each account with a negative balance, its type, APR (if set), amount, and share of total liabilities.
- **Asset-to-debt ratio bar:** two-tone bar (green assets / red liabilities) with debt-to-asset % and a health label (Healthy < 30%, Moderate 30–60%, High > 60%).

**Debt payoff calculator** (Insights → Debt-free)

- Per-debt simulator: configurable extra monthly payment + one-off lump sum; shows months saved and interest saved vs baseline.
- All-debts view: compare Avalanche, Snowball, and Even-split strategies side by side; stacked debt area chart.

**Cash-flow forecast** (Insights → Cash flow)

- Area chart projecting the primary account balance day by day.
- Configurable horizon (30 / 60 / 90 / 180 days).
- What-if slider: add a one-off income event at day 7 to see the effect.
- Liquidity alerts: dates when balance dips below the low-balance floor.
- Pay-cycle table: opening and closing balance per pay period.

---

### 6.10 Nudges (notifications)

Nudges are smart alerts that surface at the right time via the right channel.

**Nudge types:**
- `low_balance` — balance approaching the low-balance floor.
- `bill_due` — a recurring expense is due soon.
- `budget_threshold` — spending reaches 80% or 100% of a budget.
- `pay_day` — pay day is tomorrow.
- `detection_available` — new recurring pattern detected.
- `large_spend` — unusually large transaction.
- `unusual_merchant` — new merchant not seen before.

**Channels:**
- `in_app` — shown in the notification bell (top-right of every screen header).
- `email` — sent via Gmail API to your Google account address.
- `web_push` — browser push notification (requires permission grant).

**Rule system:** See section 5 (NudgeRule schema) and section 6.11 below.

---

### 6.11 Nudge rules editor

Access from More → Nudge rules.

Three axes of rules, each with priority ordering:

**Routing rules** — decide which channels a nudge uses:
- `add_channels` — add channels to the current set.
- `remove_channels` — remove channels from the current set.
- `set_channels` — replace the channel set entirely.

**Throttling rules** — prevent notification fatigue:
- `max_per_day` — total per-channel daily cap.
- `max_per_type_per_day` — per-nudge-type daily cap.
- `min_gap` — minimum time between same-channel pushes.

**Escalation rules** — re-surface unacted nudges:
- `not_acted_within` — time threshold.
- `re_push: true`, `add_channels`, `bump_severity` — escalation actions.

Each rule can be toggled active/inactive. The default rule set ships with sensible defaults covering all three axes.

---

### 6.12 Google Sheets sync

**What it does:** Saves all your data to a Google Sheet in your own Google Drive, enabling cross-device access and a readable backup.

**Setup:** Go to More → Backup & export → sign in with Google, or use the Google sign-in button on the login screen.

**How it works:**
1. On first sync, the app uses the Drive API to search for a spreadsheet named "Bappy Budget" in your Drive. If not found, it creates one.
2. The spreadsheet ID is saved to `localStorage` under `bappy.sheetId`.
3. `ensureTabs()` checks the existing spreadsheet for any missing tabs (handles schema migrations — e.g. the `Categories` tab was added after initial release) and creates them before writing.
4. `writeAll()` clears all tabs and rewrites: `Categories`, `Accounts`, `Transactions`, `Recurring`, `Budgets`, `NudgeRules`, `Settings`.
5. `readAll()` fetches all tabs via `batchGet` and merges into local state via `MERGE_REMOTE` (remote wins if non-empty for each collection).

**Auto-push:** Every state change triggers a debounced (1.5 s) write to Sheets, so your data is continuously backed up without any manual action.

**Auto-pull on focus:** A `visibilitychange` + `window.focus` listener (throttled to once per 120 s) automatically pulls the latest data from Sheets whenever you switch back to the app tab or window. This is the primary mechanism for keeping two devices in sync without user intervention.

**Manual pull:** More → Backup & export → "Pull latest from cloud" triggers an immediate `readAll` + `MERGE_REMOTE`. Use this after making changes on another device if you don't want to wait for the auto-pull. The backup screen also shows a live **last synced** timestamp and the current sync status (Active / Error).

**`lastSynced`:** A timestamp (ISO string) stored in React state and updated after every successful read or write. Displayed in the Backup screen as "Last synced X min ago".

**Required Google APIs:** Sheets API v4, Drive API v3, Gmail API v1 (for email nudges) — all enabled in the same Google Cloud project as your OAuth client. See section 7.

---

### 6.13 Categories management

Access from More → Categories.

- View all 14 built-in categories + any user-added categories.
- **Add category:** tap the `+` row at the bottom of the list, enter a name, pick a glyph (18 icons), pick a colour tint (7 options).
- **Edit category:** tap any category row to edit its name, glyph, or tint inline.
- **Delete category:** available for user-added categories only (built-in categories cannot be deleted). Shows a confirmation prompt.

---

### 6.14 General settings & pay schedule

Access from More → General & pay schedule.

- **Pay frequency:** Monthly, Weekly, or Bi-weekly.
- **Monthly anchor day:** the day of month you get paid (1–31).
- **Weekly/bi-weekly anchor weekday:** the day of week you get paid.

These settings power `nextPayday()` and the "available to spend" calculation on the home screen.

---

### 6.15 Email channel

Access from More → Email channel.

- Choose between **Immediate** (each nudge triggers an individual email), **Daily** (batched into one email per day), and **Weekly** (batched into one email per week).
- **Test email:** sends a real test email via Gmail API to verify the connection. Requires Google sign-in. The button shows sending → sent state, and displays any API error with a link to enable the Gmail API if needed.

**Email encoding:** All email subjects use RFC 2047 Base64 encoding for non-ASCII characters (em dashes, pound signs, etc.) so they render correctly in all email clients.

---

### 6.16 Login / authentication

Bappy uses Google Sign-In (OAuth 2.0). The login screen provides:
- **Google sign-in** — initiates the GIS token flow.
- **Sign in with code** — manual entry of a one-time code (for secondary device linking scenarios).
- **Resend code** — shows a 3-second "✓ Code resent" confirmation.

OAuth token is cached in memory and refreshed automatically (the GIS library handles re-prompting when the token expires).

---

## 7. Google Services Setup

### Step 1 — Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create a new project (e.g. `bappy-budget`).

### Step 2 — Enable APIs

In APIs & Services → Library, enable:
- **Google Sheets API**
- **Google Drive API**
- **Gmail API**

### Step 3 — Create an OAuth 2.0 client

1. APIs & Services → Credentials → Create Credentials → OAuth client ID.
2. Application type: **Web application**.
3. Authorised JavaScript origins:
   - `https://bappy-app.web.app` (production)
   - `https://localhost:5173` (local dev)
4. No redirect URIs needed (implicit token flow, no redirects).
5. Copy the **Client ID**.

### Step 4 — Configure consent screen

1. APIs & Services → OAuth consent screen.
2. User type: **External**.
3. Add scopes:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/gmail.send`
   - `openid`, `email`, `profile`
4. Add your email as a **test user** (while in Testing mode, only listed users can sign in).
5. For production use: submit for verification or set to Internal if using Google Workspace.

### Step 5 — Add Client ID to the app

Create `.env.local` in the project root:
```
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE.apps.googleusercontent.com
```

This is read at build time as `import.meta.env.VITE_GOOGLE_CLIENT_ID`.

---

## 8. Deployment

### Local development

```powershell
# Node TLS workaround required on some machines (Windows + corporate proxy)
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"

# Install dependencies (first time)
npm install

# Start dev server (HTTPS, port 5173)
npm run dev
```

Open `https://localhost:5173`. Accept the self-signed certificate warning in your browser.

### Build for production

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
npm run build
```

Output goes to `dist/`.

### Deploy to Firebase Hosting

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"

# First time only: login and set project
npx firebase login
npx firebase use bappy-app

# Deploy
npx firebase deploy --only hosting
```

The live app is available at `https://bappy-app.web.app` immediately after deploy.

### Firebase configuration files

**`firebase.json`:**
```json
{
  "hosting": {
    "site": "bappy-app",
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      { "source": "**/*.@(js|css)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
      { "source": "/",             "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
    ]
  }
}
```

**`.firebaserc`:**
```json
{
  "projects": { "default": "bappy-app" }
}
```

### PWA / install as app

The service worker (`public/sw.js`) is copied to `dist/` at build time. It uses a cache-first strategy for all assets and network-first for navigation requests. The cache name is versioned (`bappy-v2`) — bump the version string in `public/sw.js` on every deploy to evict stale caches on all connected devices.

The service worker is only registered in production builds (`import.meta.env.PROD` guard in `main.jsx`). In dev mode it is never registered, so Vite's HMR continues to work normally.

After visiting `https://bappy-app.web.app` in Chrome/Edge, you can install it as a standalone app via the browser's "Install app" prompt.

---

## 9. Troubleshooting

### Import returns "0 valid rows"

**Cause A: Unrecognised date format**
The date parser supports ISO (`YYYY-MM-DD`), UK slash (`DD/MM/YYYY`), US credit card (`M/D/YY`), named month (`20 May 26`), and Excel serial numbers. If your statement uses a format outside these, no rows will parse.

*Fix:* Open your statement in Excel, format the date column as `YYYY-MM-DD` and re-export.

**Cause B: Zero-amount rows**
Rows where both the debit and credit columns are blank (or contain non-numeric text like `" - "`) are skipped.

*Fix:* Delete blank or summary rows from your statement before importing.

**Cause C: No header row detected**
The auto-detector needs at least one row with text columns (date, description, amount) before the data rows.

*Fix:* Make sure your file has a header row (even a simple one like `Date, Description, Amount`).

**Cause D: Wrong column mapping**
The auto-detector maps columns by keyword (looks for "date", "memo", "desc", "amount", "debit", "credit"). If your headers are unusual (e.g. "Transaction Date", "Narrative"), mapping may fail.

*Fix:* Rename your column headers to match keywords, or use the column mapping selector in the import preview.

---

### Email subject shows garbled characters (e.g. "BappyÃ¢Â€Â"")

**Cause:** Your email client is interpreting UTF-8 bytes as Latin-1. This happens when the `Subject:` header contains raw multibyte characters (em dashes, pound signs) without encoding.

**Status: Fixed.** The app now uses RFC 2047 Base64 encoding (`=?UTF-8?B?...?=`) for all non-ASCII content in email headers. If you still see garbled subjects, the cached version of the app may be running — force-refresh with Ctrl+Shift+R or clear the service worker in DevTools → Application → Service Workers → Unregister.

---

### Gmail send fails with 403

**Cause:** The Gmail API is not enabled for your Google Cloud project, or your OAuth consent screen does not include the `gmail.send` scope.

*Fix:*
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Library → search "Gmail API" → Enable.
2. Verify the consent screen includes `https://www.googleapis.com/auth/gmail.send`.
3. Sign out and sign back in so the new scope is included in the consent prompt.

---

### Google Sheets sync fails with "The caller does not have permission"

**Cause:** The Sheets or Drive API is not enabled, or the OAuth scope does not include Sheets.

*Fix:* Enable Google Sheets API and Google Drive API in your Cloud project (see section 7). Re-authenticate so the updated scopes are granted.

---

### "firebase: command not found" when deploying

*Fix:* Use `npx firebase` instead of `firebase`:
```powershell
npx firebase deploy --only hosting
```

Or install globally: `npm install -g firebase-tools`

---

### Firebase deploy fails with SSL/TLS certificate error

**Cause:** Corporate or Windows proxy intercepts TLS connections.

*Fix:* Set the Node TLS bypass variable in every terminal session before running Firebase commands:
```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
npx firebase deploy --only hosting
```

---

### App shows a blank screen after deployment

**Cause A: Old service worker caching the previous build.**
*Fix:* Ctrl+Shift+R (hard reload) or DevTools → Application → Service Workers → Unregister, then reload.

**Cause B: Missing `.env.local` / client ID not set.**
*Fix:* Ensure `VITE_GOOGLE_CLIENT_ID` is set in `.env.local` before running `npm run build`. The build bakes the value in; changing `.env.local` after build has no effect.

---

### Sync overwrites my local data

`MERGE_REMOTE` uses "remote wins if non-empty" logic — if the spreadsheet has data for a collection (accounts, transactions, etc.), it replaces whatever is in the local device for that collection.

**Auto-push** runs continuously (1.5 s debounce after every change), so in normal usage both devices stay current. The risky scenario is making changes on Device B while it is offline or not signed in, then pulling from a Device A that overwrote that data.

*Safe workflow:*
1. Make sure both devices are signed in with Google before making changes.
2. If you've been offline on Device B and are about to pull, export a JSON backup first (More → Backup & export → Download raw data) so you have a local copy of Device B's state.
3. Use "Pull latest from cloud" only when you know Device A has the authoritative data.

---

### Balance is wrong after editing a transaction

`UPDATE_TRANSACTION` reverses the *old* balance effect and applies the *new* one in a single atomic reducer step. If you edited a transaction and the balance seems off:
1. Check the transaction's direction (income vs expense) is correct.
2. For credit cards, remember balance is negative (owing) — an expense *increases* the debt (makes the balance more negative).

---

### Rollback button not showing after import

The rollback row only appears in More → home while `state.lastImport` is non-null. It disappears after:
- You roll back successfully.
- You import again (the previous batch can no longer be rolled back).

If you imported 0 rows (e.g., the file had no valid dates), `lastImport` was not set because `IMPORT_BATCH` is only dispatched when there's at least one valid transaction.

---

## 10. User Guide

### Getting started

1. **Open the app** at `https://bappy-app.web.app` and tap "Sign in with Google".
2. Grant the requested permissions (Google Sheets, Drive, Gmail).
3. On the **More** tab → **General & pay schedule**, set your pay frequency and pay day.
4. On the **Money** tab, tap the `+` button to add your first account (e.g. your current account with its current balance).
5. Add any other accounts (savings, credit cards, loans).

---

### Adding a transaction manually

1. Go to the **Money** tab.
2. Tap the `+` (FAB) button.
3. Use the number pad to type the amount.
4. Toggle **Expense / Income / Transfer** using the segment control.
5. Select a **category**.
6. Tap the date chip to change the date if needed.
7. Optionally type a description.
8. For a transfer, select the destination account.
9. Tap **Save**.

---

### Importing a bank statement

1. Export your statement from your bank as Excel or CSV.
2. In the app, go to **More** tab → **Import transactions**.
3. Tap **Choose file** and select your statement.
4. Review the preview — check the row count and sample transactions look right.
5. Select the **target account** from the dropdown.
6. Tap **Import N transactions**.
7. You'll see a success confirmation with the count.
8. If anything looks wrong, tap **Undo this import** (or find "Undo last import" on the More home screen).

---

### Setting up budgets

1. Go to the **Plan** tab → **Budgets** tile.
2. Tap **+ New** in the section header (or the dashed "New budget" row at the bottom of the list).
3. Pick a category from the icon grid (categories already budgeted are hidden).
4. Select a period: Monthly, Weekly, or Annually.
5. Enter the budget amount (a monthly equivalent hint is shown for weekly/annual budgets).
6. Tap **Add budget**.
7. The budget immediately reflects this month's spending and appears in the health donut.

---

### Setting up recurring payments

1. Go to the **Plan** tab → **Upcoming bills** section.
2. Tap **+ Add recurring**.
3. Enter the payee name, amount, frequency, next due date, account, and category.
4. Tap Save.
5. The payment will appear in the upcoming timeline and in the cash-flow forecast.

---

### Syncing to Google Sheets

1. Go to **More** tab → **Backup & export**.
2. If not signed in, use the Google sign-in button on the login screen.
3. On first sync, a new Google Sheet called "Bappy Budget" is created in your Drive.
4. Data pushes automatically (1.5 s debounce after every change). Use **Push local data to cloud** to force an immediate overwrite of the cloud copy.
5. On another device, open the app, sign in with the same Google account, and tap **Pull latest from cloud** to load your data.

The spreadsheet is yours — you can open it directly in Google Sheets to browse or export your data.

---

### Sending a test nudge email

1. Go to **More** → **Email channel**.
2. Scroll to the **Test email** section.
3. Tap **Send test email**.
4. The button changes to "Sending…" then "Sent ✓" when successful.
5. Check your inbox (the address shown on the More home screen profile card).

If you see an error, it usually means the Gmail API isn't enabled — tap the link in the error message to go directly to the Google Cloud console.

---

### Undoing an import

**Immediately after import:**
The final step of the import sheet shows an **"Undo this import"** button. Tap it to reverse everything.

**After closing the import sheet:**
Go to **More** tab home. If a rollback is available, you'll see a row:
> *Undo last import — 34 transactions from statement_may.xlsx (2026-05-20)*

Tap it, confirm, and all those transactions are removed and account balances are restored.

---

### Editing or deleting a transaction

- **From the Home screen:** tap any recent transaction row.
- **From the Money tab:** tap an account, then tap any transaction in the list.
- **From the Ledger:** tap any transaction row.

The Edit Transaction sheet opens. Make your changes and tap **Save**, or scroll down and tap **Delete transaction** to remove it permanently.

---

### Editing or deleting an account

1. Go to **Money** tab → tap an account to open its detail screen.
2. Tap the **pencil icon** (top right of the screen header).
3. Edit the name, balance, or card details.
4. Tap **Save changes**, or scroll down and tap **Delete account & N transactions** to remove the account and all its transactions permanently.

**Note on credit card balance:** The balance field for credit cards accepts negative numbers (enter a minus sign before the amount). A balance of −450 means you owe £450.

---

### Customising categories

1. Go to **More** → **Categories**.
2. Tap any category to edit its name, icon, or colour.
3. Tap the **+ Add category** row at the bottom to create a new one.
4. To delete a user-added category, open it and tap Delete.

Built-in categories (Groceries, Transport, etc.) cannot be deleted.

---

### Adjusting nudge rules

1. Go to **More** → **Nudge rules**.
2. Use the toggle on each rule to enable/disable it.
3. The three tabs (Routing, Throttling, Escalation) show rules by axis.
4. Rules evaluate from highest priority (top) to lowest; later rules can add or remove channels that earlier rules set.

---

### Changing pay schedule

1. Go to **More** → **General & pay schedule**.
2. Select your frequency (Monthly / Weekly / Bi-weekly).
3. For monthly: enter the day of month you're paid (e.g. 25).
4. For weekly/bi-weekly: select the day of the week.
5. Tap Save.

This immediately updates the "safe to spend" calculation on the Home screen and the cash-flow forecast.

---

### Installing the app on your phone

On an iPhone (Safari):
1. Open `https://bappy-app.web.app`.
2. Tap the Share button → **Add to Home Screen**.
3. The app opens in full-screen mode with no browser chrome.

On Android (Chrome):
1. Open `https://bappy-app.web.app`.
2. Tap the three-dot menu → **Add to Home Screen** (or "Install app" banner if shown).

On desktop (Chrome / Edge):
1. Click the install icon in the address bar (or three-dot menu → Install Bappy).

The PWA service worker caches all assets so the app works offline after first load.

---

*End of Bappy documentation.*
