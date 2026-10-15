# MyBudgetApp — Project Brief (v1 — as built)

A personal budget and money management application for tracking income, expenses, accounts, and recurring obligations. The app is **proactive** — it forecasts cash flow, simulates debt payoff, detects recurring patterns, nudges the user on what matters, and helps build positive financial habits through Goals.

> **Document status**: reflects the implemented v1 codebase as of June 2026. Decisions marked ~~strikethrough~~ were superseded during build; replacements are noted inline.

---

## 1. Goal

Build a personal budget and money management app that:

- Replaces the current Excel-based tracking of transactions and accounts.
- Shows at a glance what is owed, what is coming up, what is left to spend until the next pay day, and when debts will be cleared under different repayment strategies.
- **Forecasts cash flow** ahead to surface liquidity risk before it bites.
- **Detects recurring payments** from transaction history so templates are not all manual.
- **Nudges** about due bills, budget thresholds, unusual spend, and debt-payoff opportunities — across in-app, email, and Web Push, with routing, throttling, and escalation controlled by editable rules.
- **Encourages positive habits** through Goals — savings milestones, debt payoff targets, net worth growth, emergency fund, and monthly surplus streaks.
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
- **Debt repayment simulation** per credit card, per loan, and aggregate; what-if controls for extra repayment and lump sum.
- **Cash flow forecasting** over a configurable horizon; additional income what-if to find the break-even income level.
- **Recurring payment detection** from historic and incoming transactions; templates support end dates and max payment limits.
- **Duplicate detection** on manual add, import, and recurring template creation.
- **Transfer linking** — import-detected transfers can be linked retroactively; exact matches auto-link on import.
- **Scheduled transactions** — future-dated transactions do not deplete the account balance until their date; auto-post when the date arrives.
- **Budget suggestions** — spending pattern analysis surfaces missing budgets, budgets that are too tight, and budgets that are too generous.
- **Goals** — savings milestones, debt-free targets, net worth milestones, emergency fund, and monthly surplus habit; milestone celebrations.
- **Client-side nudge generation** — live detection of bills due, budget thresholds, and low balance without a backend worker.
- **Nudge engine** with delivery across **in-app**, **email**, and **Web Push** channels, governed by an editable **rules engine** (routing / throttling / escalation).
- Reports and dashboards as graphic cards with smooth spline SVG charts.

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

- **Primary store**: **Firebase Firestore** — one document at `users/{uid}`. The document mirrors the full in-memory app state: accounts, transactions, categories, recurring templates, budgets, goals, nudge rules, settings, and metadata. Firestore documents are capped at 1 MB — ample for a typical single user (~2,000 transactions ≈ 400 KB).
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
| balance | **posted balance only** — does not include scheduled (future-dated) transactions |
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
| status | `posted` — affects balance; `scheduled` — future date, balance unaffected until date arrives; `cleared` — posted by MARK_RECURRING_PAID |

**Scheduled transaction lifecycle:** If a transaction's date is in the future at the time it is added (manually or via import), it is stored as `status: 'scheduled'` and its amount is **not** applied to the account balance. On every app load and every time the tab regains focus, `AUTO_POST_SCHEDULED` scans for scheduled transactions where `date ≤ today`, applies their balance delta, and promotes their status to `posted`.

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
| active | bool — auto-set to `false` when endDate passes or maxPayments is reached |
| source | `manual` (user-created) / `detected` (accepted from suggestions) |
| endDate | optional ISO date — template auto-deactivates when nextDue passes this |
| maxPayments | optional integer — template auto-deactivates when paymentsMade reaches this |
| paymentsMade | count of times MARK_RECURRING_PAID has been called on this template |

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

Actual spend is derived live from transactions in the current period. A budget is "over" only when `spend > amount` (strictly greater than); at exactly 100% it is "at limit" (amber), not "over" (coral).

### 5.7 Goal

| Field | Notes |
| --- | --- |
| id | unique (`goal-{timestamp}`) |
| type | `savings` / `debt_payoff` / `net_worth` / `emergency_fund` / `spending_habit` |
| title | user-provided label |
| targetAmount | target £ value — null for `emergency_fund` (auto-calculated) and `spending_habit` |
| targetMonths | target streak length — `spending_habit` only |
| targetDate | optional ISO date |
| linkedAccountId | savings account or debt account to measure against |
| baselineAmount | snapshot at goal creation — used to compute growth for savings and debt_payoff |
| milestonesDone | array of milestone % values already celebrated (e.g. `[25, 50]`) |
| active | bool — set to `false` when achieved |
| achievedAt | ISO date when 100% was first reached |
| createdAt | ISO date of creation |

**Progress is computed live from state** — never stored. `BappyUtil.goalProgress(goal, state)` returns `{ current, target, pct, isAchieved, uncelebrated, onTrack }`.

Goal type details:

| Type | `current` value | `target` value |
| --- | --- | --- |
| `savings` | `account.balance` | `targetAmount` |
| `debt_payoff` | `baselineAmount − abs(account.balance)` | `baselineAmount` |
| `net_worth` | Sum of all account balances | `targetAmount` |
| `emergency_fund` | `account.balance` | Auto: 3× average monthly expenses (last 90 days) |
| `spending_habit` | Consecutive months with income > expenses | `targetMonths` |

### 5.8 Nudge

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

### 5.9 Nudge Rule

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

### 5.10 User Settings

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
- **Future-dated transactions** are saved with `status: 'scheduled'` and do not affect the account balance. They appear in a dedicated "Upcoming · not yet posted" section at the top of the Ledger and in the Upcoming Payments screen. The balance updates automatically when the date arrives.
- **Duplicate detection on manual add**: if a transaction with the same account, direction, and amount (±£0.01) exists within the last 3 days, a soft amber warning is shown below the Save button. Non-blocking — the user can proceed.
- **Transfers** between accounts are stored as **paired transactions** — one `direction: 'transfer'` on the source account and one `direction: 'transfer-in'` on the destination, both with `transferToId` pointing to the other account.
- Categorise each transaction; allow custom categories.
- Every transaction must be linked to an account.

### 6.2 Transfer Linking

Transfers imported from Excel/CSV arrive as two unlinked income/expense transactions (one per account). They can be linked in three ways:

1. **Auto-link on import** — exact matches (same date, same amount, both categorised as Transfer, different accounts) are linked automatically during import. No user action needed.
2. **Manual linking** — any unlinked Transfer-category transaction shows a "Link as transfer" panel in the edit sheet, listing ranked candidates from other accounts (scored by amount match + date proximity). One tap links the pair.
3. **Link transfers sheet** — the "Tap to link →" banner on the Accounts screen opens a dedicated sheet listing all unlinked transfers with their best candidate; a "Link all" button handles exact matches in bulk.

Linked transfers carry `transferLinked: true` to distinguish them from natively-created transfers.

### 6.3 Recurring Items

Recurring items are stored as **templates** with a `nextDue` date. On or before the due date, the user marks them paid — this posts a transaction and advances `nextDue` by one period.

Supported frequencies: weekly / monthly / annually.

**End dates and payment limits**: templates can be given an optional `endDate` or `maxPayments`. When either is reached, the template is automatically deactivated (`active: false`). Progress is shown inline on the recurring row.

**Editing**: tapping a recurring row opens an edit sheet pre-filled with all fields including end date, max payments, next due date, category, and account.

**Duplicate guard**: before creating a new recurring template the app checks existing templates and suggestions for conflicts; a two-tap confirm flow is required if a match is found.

Templates carry `source: 'manual'` (user-created) or `source: 'detected'` (accepted from a suggestion).

### 6.4 Accounts

- Manage current, savings, credit card, and loan accounts.
- **Credit cards**: APR, credit limit, current balance; available credit (limit − balance); utilisation %.
- **Loans**: APR, principal, monthly repayment, number of payments, start date, end date. A progress bar from "Now" to the target end date is shown when both dates are set.
- **Current / savings**: last 4 digits; AER for savings.
- Live balance per account (posted transactions only) and aggregate net position (cash − debt).

### 6.5 Budgets

- Create overall and per-category budgets.
- Track actual spend vs budget within the period.
- A budget at exactly 100% is "at limit" (amber); only spending that **exceeds** the limit is flagged as "over" (coral).

**Budget suggestions** — the Budgets screen analyses the last 3 complete calendar months of transaction data and surfaces up to 5 suggestions:

| Type | Trigger | Suggested action |
| --- | --- | --- |
| Missing budget | Category averages ≥ £30/mo but has no budget | Set budget at avg + 10% buffer |
| Too tight | Budget exceeded in 2+ of last 3 months | Raise to avg spend × 1.05 |
| Too generous | Budget used < 40% on average over last 3 months | Lower to avg spend × 1.25 |

Tapping "Apply" on a missing-budget suggestion opens the Add Budget sheet pre-filled. For adjustments, the budget is updated immediately. Each suggestion can be dismissed.

### 6.6 Excel / CSV Import

A 4-step wizard (Upload → Map → Preview → Done):

1. **Upload** — `.xlsx`, `.xls`, or `.csv` accepted.
2. **Map** — column mapping (date, description, amount, debit/credit split, category). Auto-detection of common header names. Toggle: **"Skip likely duplicates"** (default ON) — skips rows already in the ledger. Toggle: **account selector** and **default category**.
3. **Preview** — first 6 rows with "from file" and "duplicate" badges.
4. **Done** — reports: transactions added, duplicates skipped, transfer pairs auto-linked, near-match transfers needing review.

Future-dated rows in the import are saved as `scheduled` and do not affect the account balance.

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

### 6.9 Cash Flow Forecast

Projects inflows and outflows over a forward horizon (default 90 days, configurable to 30 / 60 / 90 / 180 days).

- Starts from current posted balance (scheduled transactions excluded).
- Applies projected recurring templates day by day.
- **Also applies manually-entered scheduled transactions** on their respective dates — ensuring the forecast includes known future payments without double-counting.
- **Additional income what-if**: two sliders — extra monthly income (£0–£3,000) and one-off lump sum (£0–£5,000). The app calculates the break-even monthly income needed to keep the balance above the low-balance floor, and shows it with an "Apply" shortcut. Outcome card shows whether the what-if keeps the balance positive.

### 6.10 Nudge Engine

Rules-driven proactive prompts. Nudges are stored in state; delivery is governed by `NudgeRule` entries on three axes — **routing**, **throttling**, **escalation**.

**Client-side live nudge generation**: `computeNudges(state)` runs on every Nudges Inbox render and generates virtual nudge objects (not stored in state) for:

| Nudge type | Trigger |
| --- | --- |
| `bill_due` | Any active recurring template due within 7 days |
| `budget_threshold` (warning) | Budget spend ≥ 80% but not yet over |
| `budget_threshold` (alert) | Budget spend **strictly over** 100% |
| `low_balance` | Primary current account balance below `lowBalanceFloor` |

Virtual nudges are merged with any server-generated nudges stored in state. They reappear on each render unless the underlying condition resolves.

Nudge types: `bill_due`, `budget_threshold`, `unusual_spend`, `debt_opportunity`, `low_balance`, `subscription_drift`, `pay_day`, `detection_available`.

Lifecycle: **Generation → Routing pass → Throttling pass → Dispatch → Escalation pass**.

### 6.11 Goals

Goals track progress toward financial aspirations. Progress is computed live from state; no progress values are stored. Milestone celebrations (25% / 50% / 75% / 100%) appear as a highlighted card in the Goals screen and only fire once each (tracked in `milestonesDone`).

**Goal types:**

| Type | Tracks | Auto-configures |
| --- | --- | --- |
| Savings | Account balance vs target | — |
| Debt-free | Amount paid off vs original debt | Baseline from account balance at creation |
| Net worth | Net position vs milestone | — |
| Emergency fund | Account balance vs 3× monthly expenses | Target updates automatically as spending changes |
| Surplus habit | Consecutive months where income > expenses | — |

**Suggested goals**: the Goals screen scans for missing goal types and surfaces personalised setup cards — e.g. if a savings account exists but no emergency fund goal is set, it shows the calculated 3× target and a "Set up" button that opens the Add Goal sheet pre-filled.

**Goal locations**: Plan → Goals tile; Home dashboard shows top 2 active goals as progress bar cards.

---

## 7. Reports & Dashboards

All reports rendered as graphic cards. Charts are hand-rolled SVG using **Catmull-Rom → cubic bezier spline curves** for smooth rendering (no third-party chart library). All charts are **responsive** via `useContainerWidth` (ResizeObserver) or SVG `viewBox` scaling.

| Report | Chart type | Notes |
| --- | --- | --- |
| Spending by category | Donut | Top 5 in legend; current month |
| Cash flow | Spline area chart | Smooth curve; configurable horizon; additional income what-if |
| Debt repayment — per debt | Spline curve | Balance curve, payoff date, extra-payment + lump-sum what-if; "Never clears" state with minimum viable payment hint |
| Debt repayment — all debts | Stacked area curves | Avalanche / Snowball / Even-spread comparison |
| Budget health | Donut | Committed vs remaining vs over |
| Net worth | Grouped bar + spline line | Assets up, liabilities down, net worth overlay |
| Transaction summaries | Bar chart | Income vs expenses bars + net line; 6-month view |
| Available to spend | Tile | Headline figure; days to pay day |
| Upcoming payments | List | Merges recurring template projections + manually-entered scheduled transactions |

**Insight tile grid** (Insights home screen): each tile has `minHeight: clamp(130px, 14vw, 220px)`, growing with viewport width to match the Cash Flow chart card on larger screens.

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
| Charts | Hand-rolled SVG with Catmull-Rom spline — Sparkline, AreaChart, Donut, BarChart, StackedDebtChart, DebtCurve |
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
| 5 | Recurring engine | **Templates with nextDue** — user marks paid; nextDue advances by one period. Auto-deactivation on endDate or maxPayments. |
| 6 | Transfers | **Paired transactions** (`direction: 'transfer'` + `'transfer-in'`), linked by `transferToId`. Imported transfers can be linked retroactively via auto-link, manual link UI, or bulk Link Transfers sheet. |
| 7 | Multi-currency | **GBP only.** |
| 8 | Conflict resolution | **`lastModifiedAt` epoch-ms** — remote wins only if strictly newer; otherwise local pushes to Firestore. |
| 9 | Default categories | **21 categories** — original 14 + Phone, Car Loan Repayment, Credit Card Repayment, Loan, Car, Children, Shopping. |
| 10 | Reporting period | **Calendar month** for reports; **pay day** horizon for "available to spend". |
| 11 | Notification channels | **In-app + Email + Web Push.** SMS dropped. |
| 12 | Scheduled worker | ~~Google Apps Script~~ — not used. Client-driven nudge generation; email/push stubs for future. |
| 13 | Notification dispatch | **Rules engine** on routing / throttling / escalation axes; 15 default rules; editable in-app. |
| 14 | Real-time sync | **Firestore `onSnapshot`** — listener starts on sign-in, stops on sign-out; echo suppression via 5 s write-cooldown + version check. |
| 15 | Duplicate detection | **Three-layer guard** — manual-add near-duplicate warning (3-day window), import deduplication (exact match, toggleable), recurring template conflict check. |
| 16 | Transfer linking | **Auto-link on import** (exact matches) + **manual link UI** in edit sheet (ranked candidates) + **near-match banner** + **Link Transfers sheet** with bulk "Link all" for exact matches. |
| 17 | Loan account fields | **repaymentAmount, numPayments, startDate, endDate** — shown with progress bar in Account Detail when both dates are set. |
| 18 | Chart rendering | **Catmull-Rom cubic bezier spline** for all line/area charts — smooth curves through every data point. All chart components are responsive via `useContainerWidth` (ResizeObserver) or SVG `viewBox`. |
| 19 | Budget "Over" threshold | **Strictly greater than 100%** — at exactly 100% a budget is "at limit" (amber), not "over" (coral). Applies across all UI: cards, progress bars, daily spend chart, nudges. |
| 20 | Client-side nudges | **`computeNudges(state)`** generates virtual nudge objects live (bills due ≤7 days, budgets ≥80%/>100%, low balance). Merged with stored nudges in the Nudges Inbox; no server needed. |
| 21 | Budget suggestions | **`computeBudgetSuggestions(state)`** analyses 3 complete calendar months: surfaces missing budgets (≥£30/mo avg), too-tight (exceeded 2+/3 months), too-generous (<40% avg usage). Shown on Budgets screen; "Apply" pre-fills Add Budget sheet or adjusts existing budget directly. |
| 22 | Goals | **Five goal types** — Savings, Debt-free, Net worth, Emergency fund, Surplus habit. Progress is derived live from state. Milestones at 25/50/75/100% trigger a celebration card (one-time per milestone). Suggested goals auto-detected from state. |
| 23 | Surplus habit streak | **`spending_habit` goal** — counts consecutive months (backwards from now) where income > expenses using `state.transactions`. Displays a 6-month bar chart of surplus/deficit months. |
| 24 | Scheduled transactions | **Future-dated transactions do not deplete account balance** — stored as `status: 'scheduled'`. `AUTO_POST_SCHEDULED` promotes them to `posted` and applies the balance delta when `date ≤ today`, running on app load and on tab focus. One-time `MIGRATE_SCHEDULED_TRANSACTIONS` fixes existing data. |
| 25 | Upcoming payments | **Merges recurring template projections + scheduled transactions** — `UpcomingScreen` and `projectCashFlow` both include manually-entered future-dated transactions alongside recurring template forecasts, deduplicating where the same date/amount/account matches. |
| 26 | Recurring end date / payments | **`endDate` and `maxPayments`** on recurring templates — `MARK_RECURRING_PAID` auto-deactivates the template when either limit is reached. Editable via the Edit Recurring sheet. |
| 27 | Subscriptions filter | **`RecurringScreen` accepts a `filter` param** — the Subscriptions tile navigates with `{ filter: 'subscriptions' }`, showing only `cat-subs` items with a distinct "Subscriptions" heading. |
| 28 | Payoff simulation — neverClears | **`neverClears` state** — when a credit card payment does not cover monthly interest, the simulation shows "Never clears" (not "Invalid Date"), calculates the minimum viable payment, and displays an actionable warning with the slider pre-ranged to be useful. |

---

## 10. Default Nudge Rule Set (15 rules, shipped with app)

All rules can be disabled, edited, or extended by the user. Higher `priority` = evaluated first within axis.

### Routing rules

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

### Throttling rules

| ID | Name | When | Then |
| --- | --- | --- | --- |
| T1 | Web Push daily cap | `channel: web_push` | `max_per_day: 4` |
| T2 | Web Push per-type daily cap | `channel: web_push` | `max_per_type_per_day: 1` |
| T3 | Web Push minimum gap | `channel: web_push` | `min_gap: 2h` |
| T4 | Email immediate per-type daily cap | `channel: email`, `email_digest_mode: immediate` | `max_per_type_per_day: 2` |

### Escalation rules

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
| `src/bappy-state.jsx` | Reducer, BappyProvider, BappyAuthProvider, sync, goalProgress, surplusMonths |
| `src/bappy-data.js` | Default categories, nudge rules, settings seed |
| `src/bappy-nav.jsx` | BappyRouter, ScreenHeader, TabBar, extended FAB |
| `src/bappy-screens-home.jsx` | Home / Dashboard; TxnListRow (with SCHEDULED badge); client-side nudge generation |
| `src/bappy-screens-money.jsx` | Accounts, Ledger (upcoming/posted split), Add/Edit Transaction, Add/Edit Account, Link Transfers sheet |
| `src/bappy-screens-plan.jsx` | Budgets (with suggestions), Recurring (with edit sheet, end date, subscriptions filter), Goals (all types, milestone celebrations), Suggestions inbox |
| `src/bappy-screens-insights.jsx` | Insights home, Cash Flow forecast (with additional income what-if), Debt simulation (neverClears handling), Upcoming Payments (merges scheduled + recurring) |
| `src/bappy-screens-insights-reports.jsx` | Full report screens (summaries, net worth) — self-measuring responsive charts |
| `src/bappy-screens-more.jsx` | Settings, import wizard (with skip-duplicates toggle), backup |
| `src/bappy-screens-login.jsx` | Sign-in screen |
| `src/bappy-charts.jsx` | SVG charts with Catmull-Rom spline — Sparkline, AreaChart, Donut, BarChart, StackedDebtChart, DebtCurve; useContainerWidth hook |
| `src/bappy-icons.jsx` | SVG icon path library (phone, car, bag, child added) |
| `src/bappy-primitives.jsx` | Shared UI components (Card, Button, Sheet, Tag, ProgressBar, etc.) |
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

Additions from build sessions (rounds 5+): transfer linking, duplicate guards, real-time sync, loan fields, new categories, Goals (5 types + milestone celebrations), budget suggestions, scheduled transaction architecture, smooth spline charts, responsive chart sizing, recurring end dates, budget suggestions, client-side nudges, subscription filter, payoff simulation improvements.
