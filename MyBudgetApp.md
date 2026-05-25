# MyBudgetApp — Project Brief

A personal budget and money management application for tracking income, expenses, accounts, and recurring obligations, with a single private user and Google-based storage. The app is **proactive** — it forecasts cash flow, simulates debt payoff, detects recurring patterns, and nudges me on what matters across in-app, email, and Web Push, governed by a small rules engine.

---

## 1. Goal

Build a personal budget and money management app that:

- Replaces the current Excel-based tracking of transactions and accounts.
- Lets me see, at a glance, what I owe, what's coming up, what I have left to spend until my next pay day, and when my debts will be cleared under different repayment strategies.
- **Forecasts cash flow** ahead so I can see liquidity risk before it bites.
- **Detects recurring payments** from my transaction history so templates aren't all manual.
- **Nudges me** about due bills, budget thresholds, unusual spend, and debt-payoff opportunities — across in-app, email, and Web Push, with routing, throttling, and escalation controlled by editable rules.
- Runs both on my device and in a browser, using my own Google files as the data store (no paid cloud services).

---

## 2. Scope

### In scope (v1)
- Single-user login (me only), via Google sign-in.
- Cross-platform access: device app + web, single codebase.
- Data stored in **Google Sheets**, queryable via the Sheets API.
- Offline-capable on device; syncs when connection is available.
- Import of existing Excel data for transactions and accounts.
- Manage accounts, transactions, recurring items, categories, transfers, and budgets.
- Track credit cards with APR, credit limit, and current balance.
- Configurable pay schedule (weekly / bi-weekly / monthly).
- **Debt repayment simulation** per credit card, per loan, and aggregate.
- **Cash flow forecasting** over a configurable horizon.
- **Recurring payment detection** from historic and incoming transactions.
- **Nudge engine** with delivery across **in-app**, **email**, and **Web Push** channels, governed by an editable **rules engine** (routing / throttling / escalation), dispatched by an Apps Script worker.
- Reports and dashboards as graphic cards.

### Out of scope (v1)
- Multi-user / sharing.
- Paid cloud database or hosting.
- Open banking / direct bank feeds (manual entry + Excel import only).
- Investment tracking, FX, or tax reporting.
- Multi-currency (GBP only).
- **SMS notifications** — out of scope (cost and complexity not worth it given email + Web Push cover the same ground).

---

## 3. Users & Access

- **Single user**: me.
- **Authentication**: Google sign-in (same Google identity that owns the Sheets data store).
- **Devices**: laptop and mobile, via the same data store; each device can independently subscribe to Web Push.
- **Deployment targets**: native/installable on device, and a web build, from a single codebase.

---

## 4. Data & Storage

- **Primary store**: Google Sheets, accessed via the Sheets API.
  - One workbook per concern (or one workbook with multiple tabs — to confirm during build): e.g. `Accounts`, `Transactions`, `RecurrenceTemplates`, `RecurrenceSuggestions`, `Categories`, `Budgets`, `Nudges`, `NudgeRules`, `PushSubscriptions`, `Settings`.
  - Tabular structure makes data easy to eyeball and edit directly in Sheets if needed.
- **Scheduled worker**: **Google Apps Script** bound to the workbook, with time-driven triggers. Same Google identity, no extra auth surface, free tier. Responsible for evaluating nudge rules on schedule and dispatching email + Web Push.
- **Offline behaviour**: device app caches data locally and operates offline; changes are queued and synced to Sheets when a connection is available.
- **Conflict resolution**: last-write-wins, using a `last_modified` timestamp on each row.
- **No paid cloud service.**
- Two existing Excel files are the seed data:
  - **Transactions** — expenses and income by date, including which are recurrent; credit card and loan debts with monthly due days; bills, direct debits, standing orders and subscriptions with due dates and frequency (weekly / monthly / annually).
  - **Accounts** — current, savings, credit card, and loans.

---

## 5. Domain Model

### 5.1 Account

| Field | Notes |
|---|---|
| id | unique |
| name | e.g. "Barclays Current" |
| type | current / savings / credit card / loan |
| opening_balance | from Excel |
| current_balance | derived from transactions |
| credit_limit | credit card only |
| apr | credit card and loan |
| principal | loan only (original borrowed amount) |
| min_repayment_rule | e.g. fixed amount, or % of balance for credit cards |
| last_modified | for sync conflict resolution |

### 5.2 Transaction

| Field | Notes |
|---|---|
| id | unique |
| date | due / posted date |
| amount | positive value |
| direction | income / expense / transfer |
| account_id | linked account (required) |
| transfer_id | links the paired transaction for transfers (see §6.1) |
| category_id | links to category |
| type | direct debit / credit card repayment / loan repayment / regular upkeep / one-off / etc. |
| description | free text |
| is_recurring | bool |
| recurrence_template_id | links back to the recurring template that generated it, if any |
| status | scheduled / posted / cleared |
| last_modified | for sync conflict resolution |

### 5.3 Recurrence Template
A template that auto-posts a transaction on its due date (see §6.2).

| Field | Notes |
|---|---|
| id | unique |
| account_id | which account the transaction hits |
| category_id | optional default category |
| direction | income / expense |
| amount | planned amount |
| frequency | weekly / monthly / annually |
| anchor_day | day-of-month or weekday |
| start_date | first instance |
| end_date | optional |
| active | bool |
| source | manual / detected (from §6.7) |

### 5.4 Recurrence Suggestion
A candidate recurring pattern surfaced by the detection engine (§6.7), awaiting accept/dismiss.

| Field | Notes |
|---|---|
| id | unique |
| matched_transaction_ids | the transactions evidencing the pattern |
| inferred_payee | description / counterparty |
| inferred_amount | typical or median amount |
| inferred_frequency | weekly / monthly / annually |
| inferred_anchor_day | day-of-month or weekday |
| confidence | 0–1 |
| status | pending / accepted / dismissed |

### 5.5 Category
For classifying spending. Default set + user-defined custom categories.

### 5.6 Budget

| Field | Notes |
|---|---|
| period | week / month / year (calendar-aligned) |
| scope | overall or per-category |
| amount | planned limit |
| spent | derived |

### 5.7 Nudge
A delivered prompt from the nudge engine (§6.8). Persisted so dismissals stick and the worker doesn't repeat-send.

| Field | Notes |
|---|---|
| id | unique |
| type | bill_due / budget_threshold / unusual_spend / debt_opportunity / low_balance / subscription_drift / pay_day / detection_available |
| severity | info / warning / alert |
| title | short headline |
| body | one-line detail |
| action | optional deep-link (e.g. "open Barclaycard", "review suggestion") |
| context | JSON of evaluator-relevant facts (e.g. `days_until_due`, `amount`, `account_id`, `account_type`, `percent_of_budget`) — rules read this without re-deriving |
| created_at | timestamp |
| status | new / seen / dismissed / acted |
| planned_channels | the channel set computed by the routing pass, e.g. `[in_app, email, web_push]` |
| sent_via_in_app_at | timestamp |
| sent_via_email_at | timestamp |
| sent_via_webpush_at | timestamp |
| delivery_state | pending / dispatched / partial_failure / failed |
| acted_at | when user acknowledged or acted; null otherwise |

### 5.8 Push Subscription
One row per device that has opted in to Web Push.

| Field | Notes |
|---|---|
| id | unique |
| device_label | e.g. "iPhone", "MacBook" — user-editable |
| endpoint | push service URL provided by the browser |
| p256dh_key | encryption key from the subscription |
| auth_key | auth secret from the subscription |
| created_at | when the device subscribed |
| last_used_at | last successful push |
| active | bool — set to false on repeated 410/404 from the push service |

### 5.9 Nudge Rule
An editable rule governing how nudges are delivered. Rules sit on three independent axes — **routing**, **throttling**, **escalation** — and are evaluated in priority order within each axis.

| Field | Notes |
|---|---|
| id | unique |
| name | human-readable, e.g. "Quiet hours: suppress Web Push for non-alerts" |
| axis | `routing` / `throttling` / `escalation` |
| priority | integer; **higher number = evaluated first** within its axis |
| when | JSON match conditions (see below) |
| then | JSON action (see below) |
| active | bool |
| last_modified | for sync conflict resolution |

**`when` — conditions, all of which must match:**
- `nudge_type` — one of the types in §5.7, or list, or wildcard
- `severity` — `info` / `warning` / `alert`, list, or wildcard
- `time_of_day` — local-time window, e.g. `"22:00-07:00"`
- `days_of_week` — e.g. `[Mon, Tue, Wed, Thu, Fri]`
- `context_match` — predicates over the Nudge `context` JSON, e.g. `days_until_due <= 1`, `amount >= 100`, `account_type == "credit_card"`
- `channel` — used by throttling rules only, e.g. `web_push`
- `not_acted_within` — used by escalation rules only, e.g. `12h`

**`then` — actions, depending on axis:**
- *Routing actions* (build the channel set for a nudge):
  - `set_channels: [...]` — replace
  - `add_channels: [...]` — union
  - `remove_channels: [...]` — subtract
- *Throttling actions* (cap dispatch frequency):
  - `max_per_day` — across all nudges on the matched channel
  - `max_per_type_per_day` — within nudges of the matched type/channel
  - `min_gap` — minimum interval between sends on the matched channel/type, e.g. `4h`
- *Escalation actions* (act on un-acted nudges on a scheduler tick):
  - `re_push: true`
  - `add_channels: [...]`
  - `bump_severity: true`

### 5.10 User Settings

| Field | Notes |
|---|---|
| pay_frequency | weekly / bi-weekly / monthly |
| pay_anchor_date | reference date used to compute next pay day |
| currency | GBP (v1) |
| reporting_week_start | e.g. Monday |
| forecast_horizon_days | default 90 |
| detection_confidence_threshold | min confidence to surface a suggestion (default ~0.7) |
| nudge_type_preferences | per-type `enabled` flag and optional `severity_override`; channel selection is now handled by rules (§5.9) |
| quiet_hours | start/end times referenced by rules |
| email_address | destination for email nudges (defaults to Google sign-in address) |
| email_digest_mode | immediate / daily_morning / weekly |
| email_digest_time | local time-of-day for daily/weekly digest |

---

## 6. Functional Requirements

### 6.1 Transactions
- Add new transactions; the linked account balance updates accordingly.
- **Transfers** between accounts are stored as **paired transactions linked by a `transfer_id`** — one debit on the source account, one credit on the destination, both sharing the same `transfer_id`.
- Categorise each transaction; allow custom categories.
- Edit, delete, and view history of transactions.
- Every transaction must be linked to an account.

### 6.2 Recurring items (templates that auto-post)
Recurring items are stored as **templates** that automatically post a transaction on the due date. First-class support for:
- Credit card repayments (monthly due day).
- Loan repayments (monthly due day).
- Bills, direct debits, standing orders, subscriptions (weekly / monthly / annually).
- Recurring income (driven by the pay schedule — see §6.6).

Behaviour:
- On (or before) the due date, the template posts a transaction against the linked account.
- Posted transactions carry `recurrence_template_id` so they can be traced back, edited individually, or skipped.
- Upcoming-payment views also project future instances that have not yet posted.

### 6.3 Accounts
- Manage current, savings, credit card, and loan accounts.
- For credit cards: track **APR, credit limit, and current balance**; show available credit (limit − balance).
- For loans: track APR and principal alongside current balance.
- See live balance per account and aggregate net position.

### 6.4 Budgets
- Create budgets (overall and/or by category).
- Track actual spend vs budget within the period.

### 6.5 Excel import
- One-time import from existing Transactions Excel.
- One-time import from existing Accounts Excel.
- Mapping step (Excel column → app field) to keep this resilient.
- Imported transactions are passed through **Recurring Payment Detection** (§6.7) to surface suggested templates.

### 6.6 Pay schedule
- Configure pay frequency: **weekly**, **bi-weekly**, or **monthly**, with an anchor date.
- App computes the **next pay day** from this.
- Pay schedule drives:
  - The horizon for the "available to spend" card (§7.4).
  - Auto-posting of recurring income.
  - The pay-cycle view in cash flow forecasting (§7.8).

### 6.7 Recurring Payment Detection
Automatically detect recurring patterns from transaction history so the user doesn't have to declare every template by hand.

- **Inputs**: all posted transactions (from Excel import and ongoing entry).
- **Pattern signals**:
  - Same or fuzzy-matched payee / description.
  - Similar amount (±5–10% to handle small bill changes).
  - Regular interval (weekly / fortnightly / monthly / annually) over 2+ occurrences.
- **Output**: a `RecurrenceSuggestion` (§5.4) per detected pattern, with a confidence score.
- **User actions** on each suggestion:
  - **Accept** → creates a Recurrence Template (§5.3), links matching historic transactions to it.
  - **Edit then accept** → tweak amount, day, or category before creating the template.
  - **Dismiss** → suppressed so it isn't re-suggested.
- Runs in two modes:
  - **Bulk** on Excel import.
  - **Incremental** as new transactions are added — surfaced via the nudge engine when a new pattern crosses the confidence threshold.

### 6.8 Nudge Engine
A rules-driven proactive prompts system. Nudges are persisted as `Nudge` rows (§5.7); delivery across **in-app**, **email**, and **Web Push** is governed by editable `NudgeRule` rows (§5.9) on three axes — **routing**, **throttling**, **escalation**.

**Nudge types in v1**:
- **bill_due** — a scheduled payment is due in N days (configurable).
- **budget_threshold** — a budget has crossed 80% / 100% (thresholds configurable).
- **unusual_spend** — category spend this period is materially above the typical baseline.
- **debt_opportunity** — extra £X/month would clear a card/loan N months sooner (sourced from §7.7).
- **low_balance** — projected balance before next pay day falls below a configurable floor (sourced from §7.8).
- **subscription_drift** — a recurring template's posted amount has crept up vs its baseline.
- **pay_day** — pay day has arrived (good moment to allocate to budgets or savings).
- **detection_available** — one or more new Recurrence Suggestions are pending review (§6.7).

**Lifecycle of a nudge**:
1. **Generation** — either the client (from real-time activity) or the Apps Script worker (from scheduled sweeps) writes a new `Nudge` row, populating `type`, `severity`, `title`, `body`, `action`, and the `context` JSON the rules need.
2. **Routing pass** — the evaluator starts with an empty channel set and walks `axis = routing` rules in priority order; each rule may `set`, `add`, or `remove` channels. The resulting set is stored as `planned_channels`.
3. **Throttling pass** — `axis = throttling` rules drop channels that have already hit their daily caps or minimum-gap windows, based on prior `sent_via_*_at` timestamps. The surviving set is the dispatch plan.
4. **Dispatch**:
   - **In-app** — rendered on the dashboard and inbox; `sent_via_in_app_at` is set when first surfaced to the user.
   - **Email** — sent via Gmail from Apps Script, honouring `email_digest_mode` (immediate / daily_morning / weekly); digest mode bundles all qualifying nudges into one email.
   - **Web Push** — sent via VAPID-signed requests from Apps Script to each active `PushSubscription`; service worker on the client renders the notification with click-through to the deep-link.
5. **Escalation pass** — on each worker tick, `axis = escalation` rules evaluate un-acted nudges (`acted_at` is null and `not_acted_within` has elapsed); matching rules may `re_push`, widen channels, or bump severity, and the lifecycle re-enters from step 2.

**Evaluator details**:
- Rules within an axis are evaluated in descending `priority` order; ties broken by `id`.
- A rule whose `when` does not match is skipped silently; only matching rules contribute.
- Routing produces a channel **set**, not a sequence — duplicates are collapsed.
- If routing produces an empty set, the nudge is still persisted (`planned_channels = []`) so escalation rules can re-evaluate it later.
- Cleanup: if a push subscription returns 410/404 three times consecutively, set `active = false` and stop targeting it.

**Where the engine runs**:
- The Apps Script worker owns the rules engine (routing + throttling + escalation) and external dispatch.
- The client renders in-app nudges from the `Nudges` tab directly; the worker still records `sent_via_in_app_at` on first surfacing for throttling purposes.

**Editing rules**:
- Rules live in the `NudgeRules` tab and can be edited directly in Sheets or via a Settings UI screen.
- A starter rule set (see §10) ships with the app; the user can disable, edit, or add rules freely.

---

## 7. Reports & Dashboards

All reports rendered as **graphic cards** on a dashboard.

### 7.1 Transaction summaries
- By **day**, **week**, **month**, **year** (calendar-aligned).

### 7.2 Expenses by type
- Direct debits
- Credit card repayments
- Loan repayments
- Regular upkeep
- (Other types as needed)

### 7.3 Expenses by category
- Totals and shares per category.

### 7.4 Available to spend
- "How much I have available to spend" between now and the **next pay day**, after subtracting upcoming committed outflows (bills, direct debits, scheduled repayments) in that window.

### 7.5 Upcoming payments
- Next day
- Within the week
- Within the month
- Annual payments

### 7.6 Percentage shares
- What % of expenses each category / type represents.

### 7.7 Debt Repayment Simulation
Model how each debt is paid down under different strategies — per credit card, per loan, and aggregated across all debts.

**Per-debt simulation** (one card or loan):
Inputs: current balance, APR, scheduled recurring repayment, minimum-repayment rule.
Outputs:
- Estimated payoff date.
- Total interest payable until payoff.
- Month-by-month projected balance curve.
- **What-if controls**:
  - Pay an extra £X per month → revised payoff date + interest saved.
  - One-off lump sum on date D → revised payoff date + interest saved.
  - Change scheduled repayment → revised payoff date + interest saved.

**All-debts summary**:
- Aggregate total owed across all credit cards and loans.
- **Strategy comparison**:
  - **Avalanche** — pay extra on the highest-APR debt first.
  - **Snowball** — pay extra on the smallest-balance debt first.
  - **Even-spread** — split extra equally.
  - **Custom** — user-defined priority order.
- For each strategy: combined debt-free date, total interest paid, and a stacked balance curve over time.
- Side-by-side comparison so it's obvious which strategy clears debt fastest / cheapest for my situation.

The "extra £X" what-if also feeds the **debt_opportunity** nudge (§6.8) when it finds a materially better outcome.

### 7.8 Cash Flow Forecasting
Project inflows and outflows over a forward horizon (default **90 days**, configurable).

Inputs:
- Current balance per account.
- Scheduled instances from all active Recurrence Templates (§5.3).
- Pay schedule (§6.6).

Outputs:
- **Projected balance curve** per account and aggregate (line chart).
- **Per-pay-cycle view** — for each upcoming pay cycle: opening balance, total inflows, total committed outflows, projected closing balance, surplus or deficit.
- **Liquidity alerts** — dates where projected balance dips below a configurable floor (drives the **low_balance** nudge in §6.8).
- **What-if** — toggle a planned one-off expense or extra repayment and see the curve update.

---

## 8. Initial Data Migration

1. Inventory the columns in the current Transactions Excel and Accounts Excel.
2. Define mapping to the domain model in §5 (including APR, credit limit, and pay-schedule fields).
3. Build a one-off importer (with a dry-run / preview).
4. Validate: imported balances reconcile to Excel; credit cards have APR and limit populated.
5. Run **Recurring Payment Detection** (§6.7) over the imported transactions and review the suggestions to seed Recurrence Templates.
6. Seed the `NudgeRules` tab with the starter rule set from §10.

---

## 9. Resolved Decisions

| # | Decision | Resolution |
|---|---|---|
| 1 | Storage mechanics | **Google Sheets as the database**, via the Sheets API. |
| 2 | Offline behaviour | Device app **works offline and syncs** when a connection is available. |
| 3 | Tech stack | **Single codebase** — final framework pick (PWA / React Native / Flutter / Tauri) still to choose (see §10). |
| 4 | Auth model | **Google sign-in** (matches the storage choice). |
| 5 | Recurring transaction engine | **Templates that auto-post** on the due date. |
| 6 | Transfers | **Paired transactions linked by a `transfer_id`**. |
| 7 | Multi-currency | **GBP only.** |
| 8 | Conflict resolution | **Last-write-wins** via `last_modified` timestamp. |
| 9 | Default categories | Starter set drafted (see §10) — to be confirmed. |
| 10 | Reporting period definitions | **Calendar month** for reporting; **pay day** is a separate horizon used for "available to spend". |
| 11 | Notification channels | **In-app + Email + Web Push.** SMS dropped. |
| 12 | Scheduled worker | **Google Apps Script** bound to the workbook, time-driven triggers. |
| 13 | Notification dispatch model | **Rules engine** on three axes (routing / throttling / escalation), editable `NudgeRule` rows; starter set in §10. |

---

## 10. Open Follow-Ups

Small things still to settle before / during build:

1. **Framework choice** for the single codebase. Given the React experience already on hand, a **React-based PWA** is the lowest-friction default (one stack for web and installable device app, plays well with the Google APIs, and Web Push works natively); React Native or Tauri become relevant if a richer native feel is wanted. Worth a short spike before committing.
2. **Default category starter set** — draft proposal to confirm or amend:
   - Groceries
   - Transport (fuel, public transport)
   - Utilities (energy, water, broadband, phone)
   - Rent / mortgage
   - Eating out
   - Subscriptions
   - Insurance
   - Healthcare
   - Personal care
   - Clothing
   - Household
   - Giving / tithe
   - Entertainment
   - Travel
   - Gifts
   - Fees & charges
   - Other
3. **Sheets layout** — one workbook with multiple tabs, or separate workbooks per entity. One workbook is simpler and keeps the API surface small.
4. **Credit card minimum repayment rule** — fixed amount vs % of balance vs greater-of. Confirm per card for the debt repayment simulation.
5. **Debt repayment strategies to ship in v1** — confirm: Avalanche, Snowball, Even-spread, Custom. Anything else?
6. **Cash flow forecast horizon default** — 90 days proposed; confirm.
7. **Recurrence detection confidence threshold** — 0.7 proposed; tune during build with real data.
8. **Unusual-spend definition** — what counts as "materially above baseline"? (e.g. > 1.5× rolling 3-month median for that category). Confirm during build.
9. **Low-balance floor** — what £ amount triggers the liquidity alert? Per-account or aggregate? User-configurable, but need a sensible default.
10. **Apps Script trigger cadence** — proposed: hourly evaluation sweep + a dedicated daily 07:00 morning-digest trigger + a daily escalation sweep. Confirm.
11. **Quiet hours default** — proposed 22:00 – 07:00 local; alerts override.
12. **Email digest default** — proposed `daily_morning` at 07:00; alerts go immediate regardless via a routing rule.
13. **VAPID key management** — generate one VAPID key pair; private key stored in Apps Script script properties, public key embedded in the client for subscription.

### 10.14 Starter rule set — to confirm or amend

Ships in the `NudgeRules` tab seeded by §8 step 6. All rules can be disabled, edited, or extended by the user. `priority` higher = evaluated first within axis.

**Routing rules**

| # | name | axis | priority | when | then |
|---|---|---|---|---|---|
| R1 | Base routing — all nudges get in-app | routing | 100 | `nudge_type: *` | `add_channels: [in_app]` |
| R2 | Alerts go everywhere | routing | 90 | `severity: alert` | `add_channels: [in_app, email, web_push]` |
| R3 | Warnings get email | routing | 80 | `severity: warning` | `add_channels: [email]` |
| R4 | Bill due in ≤1 day → escalate channels | routing | 70 | `nudge_type: bill_due`, `context_match: days_until_due <= 1` | `add_channels: [email, web_push]` |
| R5 | Pay day — broadcast | routing | 60 | `nudge_type: pay_day` | `add_channels: [email, web_push]` |
| R6 | Detection available — in-app only | routing | 50 | `nudge_type: detection_available` | `set_channels: [in_app]` |
| R7 | Quiet hours suppress Web Push for non-alerts | routing | 40 | `time_of_day: in quiet_hours`, `severity: { not: alert }` | `remove_channels: [web_push]` |
| R8 | Quiet hours defer email for non-alerts to digest | routing | 35 | `time_of_day: in quiet_hours`, `severity: { not: alert }`, `email_digest_mode: immediate` | `remove_channels: [email]` |

**Throttling rules**

| # | name | axis | priority | when | then |
|---|---|---|---|---|---|
| T1 | Web Push daily cap | throttling | 100 | `channel: web_push` | `max_per_day: 4` |
| T2 | Web Push per-type daily cap | throttling | 90 | `channel: web_push` | `max_per_type_per_day: 1` |
| T3 | Web Push minimum gap | throttling | 80 | `channel: web_push` | `min_gap: 2h` |
| T4 | Email immediate per-type daily cap | throttling | 70 | `channel: email`, `email_digest_mode: immediate` | `max_per_type_per_day: 2` |

**Escalation rules**

| # | name | axis | priority | when | then |
|---|---|---|---|---|---|
| E1 | Low balance not acted in 12h | escalation | 100 | `nudge_type: low_balance`, `not_acted_within: 12h` | `re_push: true`, `add_channels: [email, web_push]`, `bump_severity: true` |
| E2 | Bill due ≤6h, not acted | escalation | 90 | `nudge_type: bill_due`, `context_match: days_until_due <= 0.25`, `not_acted_within: 2h` | `re_push: true`, `add_channels: [email, web_push]`, `bump_severity: true` |
| E3 | Budget at 100%, not acted in 24h | escalation | 80 | `nudge_type: budget_threshold`, `context_match: percent_of_budget >= 100`, `not_acted_within: 24h` | `re_push: true`, `add_channels: [email]` |

This is deliberately small. 15 rules cover the obvious cases; the rest can be added as patterns emerge in real use. If the rule count ever climbs past about 20, that's a signal the rules need consolidating, not extending.

---

## 11. Suggested Next Steps

1. Pick the framework (Open Follow-Up #1) — short spike if needed.
2. Export current Excel files and write up the actual column inventory in an appendix.
3. Stand up a Google Sheets workbook with the tabs implied by §5 and connect via the Sheets API.
4. Sketch the dashboard layout (the graphic cards, including simulation and forecast charts) on paper or Figma before coding.
5. Build a vertical slice: one account + add transaction + one report card (e.g. "available to spend"), end to end on Sheets.
6. Iterate in this order: recurring templates → pay schedule → **recurring payment detection** → budgets → **cash flow forecasting** → **debt repayment simulation** → **nudge engine (in-app first, no rules engine)** → **rules engine + Apps Script worker + email digest** → **Web Push** → remaining report cards → Excel importer polish.

The order matters: detection improves the seed data going into forecasting; forecasting and simulation provide the signals the nudge engine reacts to; the in-app nudge layer must exist before the rules engine has anything to route; the rules engine must be in place before external dispatch is meaningful.

---

## Appendix A — Source Brief

Original requirements as written (for traceability):

- App: Create a Budget and money management app.
- Access: deployed on my device but also available on the web; create my login profile so that I alone can access my transactions; data stored and accessed through my Google files so the app works from laptop or mobile, but not stored in any paid cloud service.
- Transactions: Excel file of expenses and income by dates, with known recurring items; credit card and loan debts with monthly due days; bills, direct debits, standing orders and subscriptions with due dates (weekly / monthly / annually); every transaction linked to an account; categorise spendings with custom categories; add new transactions and impact linked accounts; allow transfers between accounts; create budget.
- Accounts: Excel file of accounts — current, savings, credit card, loans.
- Reports and Dashboards: summary of transactions by day / week / month / year; expenses by type (direct debits, credit card repayments, loan repayments, regular upkeep); expenses by categories; how much available to spend; upcoming payments (next day / within week / month / annual); percentages of expenses; display as graphic cards.

Additions from decisions round 1:
- Pay Day with options of weekly, bi-weekly, and monthly.
- Track credit cards: APR, credit limit, and current balance.
- Report on when debts are likely to be paid off.

Additions from round 2:
- Debt Repayment Simulation for each credit card, each loan, and a summary across all debts (supersedes the original "debt payoff projection").
- Cash Flow Forecasting.
- Recurring Payment Detection.
- Nudge Engine.

Additions from round 3:
- Notification channels expanded from in-app only to **in-app + email + Web Push**.
- SMS explicitly dropped (cost / complexity not justified).
- Apps Script introduced as the scheduled worker bound to the workbook.

Additions from round 4:
- Static per-type channel map replaced by a **rules engine** on three axes — routing, throttling, escalation — via a new `NudgeRule` entity. Channel selection moved out of `nudge_type_preferences` and into rules. Starter rule set (15 rules) seeded on first run.
