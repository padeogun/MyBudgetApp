# MyBudgetApp — Project Brief (v1 — as built)

A personal budget and money management application for tracking income, expenses, accounts, and recurring obligations. The app is **proactive** — it forecasts cash flow, simulates debt payoff, detects recurring patterns, and nudges the user on what matters across in-app, email, and Web Push, governed by a small rules engine.

> **Document status**: reflects the implemented v1 codebase as of May 2026. Decisions marked ~~strikethrough~~ were superseded during build; replacements are noted inline.

---

## 1. Goal

Build a personal budget and money management app that:

- Replaces the current Excel-based tracking of transactions and accounts.
- Shows at a glance what is owed, what is coming up, what is left to spend until the next pay day, and when debts will be cleared under different repayment strategies.
- **Forecasts cash flow** ahead to surface liquidity risk before it bites.
- **Detects recurring payments** from transaction history so templates are not all manual.
- **Nudges** about due bills, budget thresholds, unusual spend, and debt-payoff opportunities — across in-app, email, and Web Push, with routing, throttling, and escalation controlled by editable rules.
- Runs on device and in a browser, using a single shared cloud data store.

---

## 2. Scope

### In scope (v1 — implemented)

- Single-user login (Google sign-in via Firebase Auth).
- Cross-platform: installable PWA + web, single React codebase.
- Data stored in **Firebase Firestore** (one document per authenticated user).
- Real-time sync across devices via Firestore `onSnapshot` listener.
- Offline-capable via IndexedDB + localStorage fallback; auto-syncs on reconnect.
- Import of Excel / CSV data for transactions.
- Manage accounts, transactions, recurring items, categories, transfers, and budgets.
- Track credit cards with APR, credit limit, current balance, and minimum repayment.
- Track loans with APR, principal, monthly repayment, number of payments, start date, and end date.
- Configurable pay schedule (weekly / bi-weekly / monthly).
- **Debt repayment simulation** per credit card, per loan, and aggregate.
- **Cash flow forecasting** over a configurable horizon.
- **Recurring payment detection** from historic and incoming transactions.
- **Duplicate detection** on manual add, import, and recurring template creation.
- **Transfer linking** — import-detected transfers can be linked retroactively; exact matches auto-link on import.
- **Nudge engine** with delivery across **in-app**, **email**, and **Web Push** channels, governed by an editable **rules engine** (routing / throttling / escalation).
- Reports and dashboards as graphic cards.

### Out of scope (v1)

- Multi-user / sharing.
- ~~Paid cloud database~~ — Firebase Firestore free tier is used; within free-tier limits for a single user.
- Open banking / direct bank feeds (manual entry + Excel/CSV import only).
- Investment tracking, FX, or tax reporting.
- Multi-currency (GBP only).
- **SMS notifications** — dropped (cost and complexity not worth it given email + Web Push).
- ~~Google Apps Script worker~~ — replaced by Firebase; nudge dispatch is client-driven (in-app) with email and Web Push stubs for future implementation.

---

## 3. Users & Access

- **Single user**.
- **Authentication**: Google sign-in or email/password via **Firebase Auth**.
- **Devices**: laptop and mobile, sharing a single Firestore document; real-time sync keeps both current.
- **Deployment**: Firebase Hosting at `bappy-app.web.app`; installable as a PWA.

---

## 4. Data & Storage

- **Primary store**: **Firebase Firestore** — one document at `users/{uid}`. The document mirrors the full in-memory app state: accounts, transactions, categories, recurring templates, budgets, nudge rules, settings, and metadata. Firestore documents are capped at 1 MB — ample for a typical single user (~2,000 transactions ≈ 400 KB).
- **Local store**: IndexedDB (primary) with localStorage fallback — both updated on every state change (debounced 250 ms). The app renders immediately from local store on load.
- **Real-time sync**: Firestore `onSnapshot` listener starts on sign-in and applies remote changes within ~1–2 seconds. Guards prevent echo-back of local writes.
- **Conflict resolution**: `lastModifiedAt` epoch-ms timestamp, bumped on every mutation. Remote wins only if `remoteTimestamp > localTimestamp`; otherwise local is pushed to Firestore.
- **On sign-in**: one-time version-compared read, then real-time listener started.
- **On tab focus**: throttled pull (once per 2 minutes) as a fallback for reconnection scenarios.
- ~~Google Apps Script worker~~ — not used. Nudge dispatch is client-driven.
- ~~Google Sheets~~ — replaced by Firestore in full.

---

## 5. Domain Model

### 5.1 Account

| Field | Notes |
| --- | --- |
| id | unique |
| name | e.g. "Barclays Current" |
| type | `current` / `savings` / `credit_card` / `loan` |
| balance | current balance (negative for credit card / loan debt) |
| last4 | last 4 digits — current and savings only |
| limit | credit limit — credit card only |
| apr | interest rate % — credit card and loan |
| principal | original borrowed amount — loan only |
| repaymentAmount | monthly repayment amount — loan only |
| numPayments | total number of payments / term length — loan only |
| startDate | loan start date — loan only |
| endDate | loan end date — loan only |
| minRepayRule | e.g. "fixed" or "% of balance" — credit card only |
| rate | AER % — savings only |

### 5.2 Transaction

| Field | Notes |
| --- | --- |
| id | unique (`tx-{timestamp}`) |
| date | ISO date string |
| amount | positive value |
| direction | `income` / `expense` / `transfer` / `transfer-in` |
| accountId | linked account (required) |
| transferToId | destination account ID for transfer pairs; null otherwise |
| transferLinked | `true` when a transfer was linked retroactively from an import |
| categoryId | links to category |
| type | `one_off` / `recurring` / `transfer` |
| description | free text |
| recurrenceTemplateId | links back to the recurring template, if any |
| status | `posted` (all manual/imported) / `scheduled` (projected) |

### 5.3 Recurrence Template

| Field | Notes |
| --- | --- |
| id | unique (`rec-{timestamp}`) |
| payee | description / counterparty |
| accountId | which account the transaction hits |
| categoryId | default category |
| direction | `income` / `expense` |
| amount | planned amount |
| frequency | `weekly` / `monthly` / `annually` |
| anchorDay | day-of-month |
| nextDue | ISO date of next due instance |
| baseline | original amount — used to detect subscription drift |
| active | bool |
| source | `manual` (user-created) / `detected` (accepted from suggestions) |

### 5.4 Recurrence Suggestion

A candidate recurring pattern surfaced by the detection engine, awaiting accept/dismiss.

| Field | Notes |
| --- | --- |
| id | unique |
| payee | inferred payee / description |
| amount | typical or median amount |
| frequency | `weekly` / `monthly` / `annually` |
| confidence | 0–1 |
| status | `pending` / `accepted` / `dismissed` |

### 5.5 Categories

21 default categories (taxonomy — not personal data):

| ID | Name | ID | Name |
| --- | --- | --- | --- |
| `cat-grocery` | Groceries | `cat-phone` | Phone |
| `cat-transport` | Transport | `cat-carloan` | Car Loan Repayment |
| `cat-utility` | Utilities | `cat-ccrepay` | Credit Card Repayment |
| `cat-rent` | Rent | `cat-loan` | Loan |
| `cat-eatout` | Eating out | `cat-car` | Car |
| `cat-subs` | Subscriptions | `cat-children` | Children |
| `cat-personal` | Personal care | `cat-shopping` | Shopping |
| `cat-clothing` | Clothing | `cat-transfer` | Transfer |
| `cat-house` | Household | `cat-other` | Other |
| `cat-fun` | Entertainment | `cat-income` | Income |
| `cat-fees` | Fees & charges | | |

Custom categories can be added by the user.

### 5.6 Budget

| Field | Notes |
| --- | --- |
| id | unique |
| period | `week` / `month` / `year` (calendar-aligned) |
| categoryId | null = overall budget; set = per-category |
| amount | planned limit |

Actual spend is derived from transactions in the period.

### 5.7 Nudge

| Field | Notes |
| --- | --- |
| id | unique |
| type | `bill_due` / `budget_threshold` / `unusual_spend` / `debt_opportunity` / `low_balance` / `subscription_drift` / `pay_day` / `detection_available` |
| severity | `info` / `warning` / `alert` |
| title | short headline |
| body | one-line detail |
| action | optional deep-link |
| context | JSON of evaluator-relevant facts |
| createdAt | timestamp |
| status | `new` / `seen` / `dismissed` / `acted` |

### 5.8 Nudge Rule

Editable rule on one of three axes: **routing**, **throttling**, **escalation**.

| Field | Notes |
| --- | --- |
| id | unique |
| name | human-readable |
| axis | `routing` / `throttling` / `escalation` |
| priority | integer; higher = evaluated first |
| when | match conditions |
| then | action |
| active | bool |

15 default rules ship with the app (see §10).

### 5.9 User Settings

| Field | Notes |
| --- | --- |
| payFrequency | `weekly` / `monthly` |
| payAnchorDay | day-of-month |
| payAnchorWeekday | 0–6 (Mon=1) |
| currency | `GBP` |
| weekStart | `Mon` |
| forecastHorizonDays | default 90 |
| detectionConfidenceThreshold | default 0.7 |
| quietHours | `{ start, end }` — default 22:00–07:00 |
| emailDigestMode | `immediate` / `daily_morning` / `weekly` |
| lowBalanceFloor | default £200 |

---

## 6. Functional Requirements

### 6.1 Transactions

- Add, edit, and delete transactions; the linked account balance updates accordingly.
- **Duplicate detection on manual add**: if a transaction with the same account, direction, and amount (±£0.01) exists within the last 3 days, a soft amber warning is shown below the Save button. Non-blocking — the user can proceed.
- **Transfers** between accounts are stored as **paired transactions** — one `direction: 'transfer'` on the source account and one `direction: 'transfer-in'` on the destination, both with `transferToId` pointing to the other account.
- Categorise each transaction; allow custom categories.
- Every transaction must be linked to an account.

### 6.2 Transfer Linking

Transfers imported from Excel/CSV arrive as two unlinked income/expense transactions (one per account). They can be linked in three ways:

1. **Auto-link on import** — exact matches (same date, same amount, both categorised as Transfer, different accounts) are linked automatically during import. No user action needed.
2. **Manual linking** — any unlinked Transfer-category transaction shows a "Link as transfer" panel in the edit sheet, listing ranked candidates from other accounts (scored by amount match + date proximity). One tap links the pair.
3. **Near-match banner** — the Accounts screen shows an amber banner with a count of unlinked Transfer transactions, prompting review.

Linked transfers carry `transferLinked: true` to distinguish them from natively-created transfers.

### 6.3 Recurring Items

Recurring items are stored as **templates** with a `nextDue` date. On or before the due date, the user marks them paid — this posts a transaction and advances `nextDue` by one period.

Supported frequencies: weekly / monthly / annually.

**Duplicate guard**: before creating a new recurring template (either from Add Transaction or by marking an existing transaction as recurring), the app checks `state.recurring` and `state.suggestions` for templates matching on payee name similarity OR same amount + account + direction. If a conflict is found:

- An amber warning card is shown listing the matching templates / detected patterns.
- The save button label changes to **"Create anyway"**.
- A second tap proceeds, bypassing the guard.

Templates carry `source: 'manual'` (user-created) or `source: 'detected'` (accepted from a suggestion).

### 6.4 Accounts

- Manage current, savings, credit card, and loan accounts.
- **Credit cards**: APR, credit limit, current balance; available credit (limit − balance); utilisation %.
- **Loans**: APR, principal, monthly repayment, number of payments, start date, end date.
- **Current / savings**: last 4 digits; AER for savings.
- Live balance per account and aggregate net position (cash − debt).

### 6.5 Budgets

- Create overall and per-category budgets.
- Track actual spend vs budget within the period.

### 6.6 Excel / CSV Import

A 4-step wizard (Upload → Map → Preview → Done):

1. **Upload** — `.xlsx`, `.xls`, or `.csv` accepted.
2. **Map** — column mapping (date, description, amount, debit/credit split, category). Auto-detection of common header names. Toggle: **"Skip likely duplicates"** (default ON) — skips rows already in the ledger (same account + date + direction + amount ±£0.01 + description, case-insensitive).
3. **Preview** — first 6 rows with category and duplicate badges.
4. **Done** — reports: transactions added, duplicates skipped, transfer pairs auto-linked, near-match transfers needing review.

Imported transactions with `category = Transfer` are candidates for transfer linking (§6.2).

### 6.7 Pay Schedule

Configure pay frequency (weekly / monthly) and anchor day. The app computes the next pay day and uses it for:

- "Available to spend" horizon.
- Cash flow per-pay-cycle view.

### 6.8 Recurring Payment Detection

Automatically detect recurring patterns from transaction history.

- **Pattern signals**: same/fuzzy-matched payee, similar amount (±5–10%), regular interval over 2+ occurrences.
- **Output**: `RecurrenceSuggestion` with confidence score.
- **User actions**: Accept → creates template; Edit then accept; Dismiss.
- Runs on import (bulk) and incrementally as new transactions arrive.

### 6.9 Nudge Engine

Rules-driven proactive prompts. Nudges are stored in state; delivery is governed by `NudgeRule` entries on three axes — **routing**, **throttling**, **escalation**.

Nudge types: `bill_due`, `budget_threshold`, `unusual_spend`, `debt_opportunity`, `low_balance`, `subscription_drift`, `pay_day`, `detection_available`.

Lifecycle: **Generation → Routing pass → Throttling pass → Dispatch → Escalation pass**.

---

## 7. Reports & Dashboards

All reports rendered as graphic cards. Charts are hand-rolled SVG (no third-party chart library).

| Report | Chart type | Notes |
| --- | --- | --- |
| Spending by category | Donut | Top 5 in legend; current month |
| Cash flow | Area chart | Projected balance curve; configurable horizon |
| Debt repayment — per debt | Curve | Balance curve, payoff date, extra-payment what-if |
| Debt repayment — all debts | Stacked bar + curve | Avalanche / Snowball / Even-spread comparison |
| Budget health | Donut | Committed vs remaining vs free |
| Net worth | Grouped bar + line | Assets up, liabilities down, net worth overlay |
| Transaction summaries | Bar chart | Income vs expenses bars + net line; 6-month view |
| Available to spend | Tile | Headline figure; days to pay day |
| Upcoming payments | List | Next day / this week / this month / annual |

---

## 8. Tech Stack (implemented)

| Concern | Choice |
| --- | --- |
| Framework | **React** (Vite), single codebase |
| Routing / nav | Custom BappyRouter (hash-free, stack-based) |
| State | `useReducer` + `useContext` (`BappyProvider`) |
| Local storage | IndexedDB (primary) + localStorage (fallback) |
| Cloud store | **Firebase Firestore** |
| Auth | **Firebase Auth** (Google sign-in + email/password) |
| Real-time sync | Firestore `onSnapshot` (`subscribeUserState`) |
| Hosting | **Firebase Hosting** (`bappy-app.web.app`) |
| Charts | Hand-rolled SVG — Sparkline, AreaChart, Donut, BarChart, StackedDebtChart, DebtCurve |
| Icons | Custom SVG path library (`bappy-icons.jsx`) |
| Excel parsing | `xlsx` (SheetJS) |
| Styling | Inline styles with CSS custom properties (design tokens) |

---

## 9. Resolved Decisions

| # | Decision | Resolution |
| --- | --- | --- |
| 1 | Storage | **Firebase Firestore** — one document per authenticated user at `users/{uid}`. Replaced Google Sheets. |
| 2 | Offline behaviour | **IndexedDB + localStorage** — renders immediately from local store; syncs to Firestore on every state change (debounced 1.5 s). |
| 3 | Tech stack | **React PWA** (Vite), single codebase, deployed on Firebase Hosting. |
| 4 | Auth | **Firebase Auth** — Google sign-in + email/password. |
| 5 | Recurring engine | **Templates with nextDue** — user marks paid; nextDue advances by one period. |
| 6 | Transfers | **Paired transactions** (`direction: 'transfer'` + `'transfer-in'`), linked by `transferToId`. Imported transfers can be linked retroactively via auto-link or manual UI. |
| 7 | Multi-currency | **GBP only.** |
| 8 | Conflict resolution | **`lastModifiedAt` epoch-ms** — remote wins only if strictly newer; otherwise local pushes to Firestore. |
| 9 | Default categories | **21 categories** — original 14 + Phone, Car Loan Repayment, Credit Card Repayment, Loan, Car, Children, Shopping. |
| 10 | Reporting period | **Calendar month** for reports; **pay day** horizon for "available to spend". |
| 11 | Notification channels | **In-app + Email + Web Push.** SMS dropped. |
| 12 | Scheduled worker | ~~Google Apps Script~~ — not used. Client-driven in-app nudges only; email/push stubs for future. |
| 13 | Notification dispatch | **Rules engine** on routing / throttling / escalation axes; 15 default rules; editable in-app. |
| 14 | Real-time sync | **Firestore `onSnapshot`** — listener starts on sign-in, stops on sign-out; echo suppression via 5 s write-cooldown + version check. |
| 15 | Duplicate detection | **Three-layer guard** — manual-add near-duplicate warning (3-day window), import deduplication (exact match, toggleable), recurring template conflict check (name + amount match against templates and suggestions). |
| 16 | Transfer linking | **Auto-link on import** (exact matches) + **manual link UI** in edit sheet (ranked candidates) + **near-match banner** on Accounts screen. |
| 17 | Loan account fields | **repaymentAmount, numPayments, startDate, endDate** added to loan accounts in both Add and Edit sheets. |

---

## 10. Default Nudge Rule Set (15 rules, shipped with app)

All rules can be disabled, edited, or extended by the user. Higher `priority` = evaluated first within axis.

**Routing rules**

| ID | Name | When | Then |
| --- | --- | --- | --- |
| R1 | Base routing — all nudges get in-app | `nudge_type: *` | `add_channels: [in_app]` |
| R2 | Alerts go everywhere | `severity: alert` | `add_channels: [in_app, email, web_push]` |
| R3 | Warnings get email | `severity: warning` | `add_channels: [email]` |
| R4 | Bill due ≤1 day — escalate channels | `nudge_type: bill_due`, `days_until_due ≤ 1` | `add_channels: [email, web_push]` |
| R5 | Pay day — broadcast | `nudge_type: pay_day` | `add_channels: [email, web_push]` |
| R6 | Detection available — in-app only | `nudge_type: detection_available` | `set_channels: [in_app]` |
| R7 | Quiet hours suppress Web Push for non-alerts | `time_of_day: in quiet_hours`, `severity ≠ alert` | `remove_channels: [web_push]` |
| R8 | Quiet hours defer email to digest | `time_of_day: in quiet_hours`, `severity ≠ alert`, `email_digest_mode: immediate` | `remove_channels: [email]` |

**Throttling rules**

| ID | Name | When | Then |
| --- | --- | --- | --- |
| T1 | Web Push daily cap | `channel: web_push` | `max_per_day: 4` |
| T2 | Web Push per-type daily cap | `channel: web_push` | `max_per_type_per_day: 1` |
| T3 | Web Push minimum gap | `channel: web_push` | `min_gap: 2h` |
| T4 | Email immediate per-type daily cap | `channel: email`, `email_digest_mode: immediate` | `max_per_type_per_day: 2` |

**Escalation rules**

| ID | Name | When | Then |
| --- | --- | --- | --- |
| E1 | Low balance not acted in 12h | `nudge_type: low_balance`, `not_acted_within: 12h` | `re_push`, `add_channels: [email, web_push]`, `bump_severity` |
| E2 | Bill due ≤6h, not acted | `nudge_type: bill_due`, `days_until_due ≤ 0.25`, `not_acted_within: 2h` | `re_push`, `add_channels: [email, web_push]`, `bump_severity` |
| E3 | Budget at 100%, not acted in 24h | `nudge_type: budget_threshold`, `percent_of_budget ≥ 100`, `not_acted_within: 24h` | `re_push`, `add_channels: [email]` |

---

## 11. Source Files

| File | Purpose |
| --- | --- |
| `src/bappy-app.jsx` | App shell, routing, sheet dispatch, FAB |
| `src/bappy-state.jsx` | Reducer, BappyProvider, BappyAuthProvider, sync |
| `src/bappy-data.js` | Default categories, nudge rules, settings seed |
| `src/bappy-nav.jsx` | BappyRouter, ScreenHeader, TabBar, FAB |
| `src/bappy-screens-home.jsx` | Home / Dashboard |
| `src/bappy-screens-money.jsx` | Accounts, Ledger, Add/Edit Transaction, Add/Edit Account |
| `src/bappy-screens-plan.jsx` | Budgets, Recurring templates, Suggestions inbox |
| `src/bappy-screens-insights.jsx` | Insights home, spending donut, sparklines |
| `src/bappy-screens-insights-reports.jsx` | Full report screens (summaries, forecast, debt simulation, net worth) |
| `src/bappy-screens-more.jsx` | Settings, import wizard, backup |
| `src/bappy-screens-login.jsx` | Sign-in screen |
| `src/bappy-charts.jsx` | SVG chart components |
| `src/bappy-icons.jsx` | SVG icon path library |
| `src/bappy-primitives.jsx` | Shared UI components (Card, Button, Sheet, Tag, etc.) |
| `src/bappy-storage.js` | IndexedDB + localStorage persistence layer |
| `src/firebase.js` | Firebase app init (single instance) |
| `src/firebase-auth.js` | Firebase Auth helpers |
| `src/firebase-db.js` | Firestore read / write / `onSnapshot` |

---

## Appendix A — Original Brief (for traceability)

- App: Create a Budget and money management app.
- Access: deployed on device but also available on the web; login so only I can access; data stored through Google files; not in any paid cloud service.
- Transactions: Excel file of expenses and income by dates; credit card and loan debts; bills, direct debits, standing orders and subscriptions; every transaction linked to an account; categorise spending with custom categories; add new transactions; allow transfers between accounts; create budgets.
- Accounts: Excel file of accounts — current, savings, credit card, loans.
- Reports: summaries by day / week / month / year; expenses by type; expenses by category; available to spend; upcoming payments; percentages; graphic cards.

Additions from decision rounds 1–4 (pay schedule, credit card tracking, debt simulation, cash flow forecasting, recurring detection, nudge engine, rules engine, Web Push) — all implemented.
