# MyBudgetApp — Screen Architecture

A working schema of the screens as implemented. Mobile-first; desktop is the same screens reflowed.

> **Document status**: reflects the implemented v1 codebase as of May 2026.

---

## 1. Navigation model

### Primary nav: 5-tab bottom bar

| Tab | Purpose | Houses |
| --- | --- | --- |
| **Home** | The day-to-day glance | Dashboard cards |
| **Money** | What I have, what I owe | Accounts + Ledger |
| **Plan** | What's set up and pending | Budgets + Recurring templates + Suggestions |
| **Insights** | What the data says | Reports + Forecast + Simulation |
| **More** | Everything else | Settings + Import + Backup + About |

### Persistent elements

- **Bell icon** — Nudge inbox (badge with unread count). Surfaces from every screen.
- **＋ Add transaction FAB** — Floating pill button, bottom-right. Appears on the **Money / Accounts screen only**. Label: "＋ Add transaction". Solid teal gradient.
- **＋ Account button** — Outlined teal pill ("＋ Account") in the Accounts section header. Distinct from the FAB: white background, teal border, smaller.

---

## 2. Screen map

```text
Auth
  └── Sign-in (Google or email/password)
      └── [auto-restore if previously signed in]

Home tab
  └── Dashboard

Money tab
  ├── Accounts (main screen — FAB lives here)
  │   ├── [＋ Account pill] → Add Account sheet
  │   └── Account row → Account Detail
  │       ├── [Simulate payoff] → Per-Debt Simulation (Insights)
  │       ├── [Transfer] → Transfer sheet
  │       └── [Add transaction] → Add Transaction sheet
  ├── Ledger (full transaction list, all accounts)
  │   └── Transaction row → Edit Transaction sheet
  │       └── [Link as transfer] panel (if unlinked Transfer category)
  └── [FAB] → Add Transaction sheet

Plan tab
  ├── Plan home
  │   ├── Budgets → Budget List
  │   ├── Recurring → Recurring Templates List
  │   └── Detected patterns → Suggestions Inbox
  ├── Budget List → Budget Detail
  ├── Recurring Templates List → Recurring Template Detail
  └── Suggestions Inbox (accept / dismiss detected patterns)

Insights tab
  ├── Insights home
  │   ├── Spending donut (this month by category)
  │   ├── Cash flow sparkline
  │   └── Navigation tiles → detail screens below
  ├── Transaction Summaries (6-month income vs expenses bar chart)
  ├── Cash Flow Forecast (area chart + per-pay-cycle table)
  ├── Per-Debt Simulation (balance curve, what-if controls)
  ├── All-Debts Comparison (Avalanche / Snowball / Even-spread)
  └── Net Worth (grouped bar + net worth line)

More tab
  ├── More home
  ├── Profile (account info, sign out)
  ├── General (pay schedule, forecast horizon, low-balance floor)
  ├── Preferences (detection threshold, quiet hours, email digest)
  ├── Categories (manage default + custom categories)
  ├── Nudge types (per-type enable + severity override)
  ├── Nudge rules (routing / throttling / escalation rules editor)
  ├── Email channel (address, digest mode)
  ├── Web Push devices (subscriptions, device labels)
  └── Backup / Export (export to XLSX, pull from cloud, push to cloud)
      └── Import wizard (Upload → Map → Preview → Done)
```

---

## 3. Screen inventory

Grouped by area. 🖼️ = full screen, 📋 = bottom sheet, ⚙️ = settings sub-screen.

### 3.1 Auth

| | Screen | Notes |
| --- | --- | --- |
| 🖼️ | **Sign-in** | Google sign-in button + email/password form. Branded splash with Bappy logo. |

### 3.2 Home

| | Screen | Notes |
| --- | --- | --- |
| 🖼️ | **Dashboard** | Graphic cards stacked vertically. Cards: Available to spend, Net position, Upcoming payments (next 7 days), Recent activity (last 5 transactions), Cash flow sparkline, Debt-free date countdown. |

### 3.3 Money tab

| | Screen | Notes |
| --- | --- | --- |
| 🖼️ | **Accounts** | Grouped by type (Cash / Savings / Credit cards / Loans). Aggregate net position at top (dark card). Amber banner if unlinked Transfer transactions exist. "＋ Account" outlined pill + "Ledger" link in section header. FAB ("＋ Add transaction") fixed bottom-right. |
| 🖼️ | **Account Detail** | Dark header: name, type tag, last 4, balance. Credit card: utilisation bar, APR, min repayment. Loan: APR, principal, per-payment, payments, start/end dates. Savings: AER. Actions: Simulate payoff (cards/loans), Transfer, Add transaction. Recent transactions below. |
| 🖼️ | **Ledger** | All transactions, reverse-chronological, grouped by date. Filter chips by account. Tap row → Edit Transaction sheet. |
| 📋 | **Add Transaction** | Direction segmented (Expense / Income / Transfer). Numpad amount entry. Fields: account, category, date, recurring toggle + frequency. Description with quick-suggestion chips. Soft amber warning if near-duplicate exists in last 3 days. Amber conflict warning if recurring template already exists (shows matching templates; "Create anyway" on second tap). |
| 📋 | **Edit Transaction** | Same form as Add, pre-filled. For linked transfers: simplified view (description + date only). For **unlinked Transfer-category** transactions: amber "Link as transfer" panel at top showing ranked candidates from other accounts — tap Link to pair them. "↻ Mark as recurring" expands inline with conflict check. |
| 📋 | **Add Account** | Type segmented (Current / Savings / Credit card / Loan). Type-specific fields. Loan fields: outstanding balance, original principal, interest rate %, monthly repayment, number of payments, start date, end date. |
| 📋 | **Edit Account** | Same as Add, pre-filled. Type badge shown (read-only). Delete account (with transaction count warning). |
| 📋 | **Transfer** | From / To account selectors, amount, date, note. Creates paired transfer transactions. |

### 3.4 Plan tab

| | Screen | Notes |
| --- | --- | --- |
| 🖼️ | **Plan home** | Summary tiles: active templates, budgets, subscriptions total, due this week. Detected patterns card if pending suggestions. |
| 🖼️ | **Budget List** | Progress bars per budget. |
| 🖼️ | **Budget Detail** | Spend vs limit, transactions counted toward it. |
| 📋 | **Add / Edit Budget** | Period + scope (overall vs category) + amount. |
| 🖼️ | **Recurring Templates** | Grouped by frequency (weekly / monthly / annually). Per row: payee, amount, next due, source badge (manual / detected), active toggle, Mark paid button. |
| 🖼️ | **Suggestions Inbox** | Pending detected patterns. Per card: confidence %, payee, amount, frequency. Accept → creates template. Dismiss → suppresses. |

### 3.5 Insights tab

| | Screen | Notes |
| --- | --- | --- |
| 🖼️ | **Insights home** | Spending donut (current month by category, top 5 legend). Navigation tiles. |
| 🖼️ | **Transaction Summaries** | 6-month bar chart (income vs expenses) + net line overlay. |
| 🖼️ | **Cash Flow Forecast** | Area chart — projected balance over horizon. Per-pay-cycle table. Floor line marker. |
| 🖼️ | **Per-Debt Simulation** | Balance curve, payoff date, total interest. What-if: extra £/month, lump sum. "Simulate payoff" deep-links here from Account Detail. |
| 🖼️ | **All-Debts Comparison** | Stacked balance curves for Avalanche / Snowball / Even-spread strategies. Debt-free date per strategy. |
| 🖼️ | **Net Worth** | Grouped bar chart (assets up, liabilities down) + net worth line overlay. 6-month view. |

### 3.6 More tab

| | Screen | Notes |
| --- | --- | --- |
| 🖼️ | **More home** | Grouped list: Profile, Notifications, Data, About. Sync status banner at top. |
| ⚙️ | **Profile** | Google account, sign-out. |
| ⚙️ | **General** | Pay frequency, anchor day, currency (display), forecast horizon, week start. |
| ⚙️ | **Preferences** | Detection confidence threshold, low-balance floor. |
| ⚙️ | **Categories** | List: default + custom. Add / rename / delete. |
| ⚙️ | **Nudge types** | Per-type enabled toggle + severity override. |
| ⚙️ | **Nudge rules** | Three sections: Routing / Throttling / Escalation. Per rule: name, priority, when/then JSON, active toggle. Add/edit/delete rules. |
| ⚙️ | **Email channel** | Email address, digest mode (immediate / daily morning / weekly). |
| ⚙️ | **Web Push devices** | Subscribed devices list, label, last used, revoke. Subscribe this device CTA. |
| ⚙️ | **Backup / Export** | Last synced timestamp. Export to XLSX. Push to cloud / Pull from cloud (manual sync). |
| 📋 | **Import wizard** | Step 0: file picker (.xlsx, .xls, .csv). Step 1: column mapping (date, description, amount, debit/credit, category) + account selector + default category + "Skip likely duplicates" toggle. Step 2: preview (first 6 rows, "from file" and "duplicate" badges). Step 3: done — shows transactions added, duplicates skipped, transfer pairs auto-linked, near-matches to review. |

### 3.7 Global sheets (accessible from multiple screens)

| | Sheet | Notes |
| --- | --- | --- |
| 📋 | **Nudge inbox** | Accessible from bell icon on any screen. Tabs: New / Seen / Dismissed. Per row: severity dot, type icon, title, body, timestamp, action button. |

---

## 4. Key behaviours by screen

### Accounts screen — transfer linking banner

When any transaction has `categoryId: 'cat-transfer'` and `transferToId: null`, an amber banner appears below the summary card:

> "N transfers not yet linked — Tap to link →"

Tapping any Transfer-category transaction in the Ledger opens the Edit sheet, which shows ranked link candidates.

### Edit Transaction — unlinked transfer linking

The link panel appears at the top of the edit form (above the direction segmented control) whenever `categoryId === 'cat-transfer'` and `transferToId` is null. It shows up to 5 candidates from other accounts, ranked by:

- Exact amount match (+3 pts)
- Same date (+2 pts), ±1 day (+1 pt), ±2 days (+0.5 pt)

Candidates with a perfect score show an "Exact match" badge. Tapping Link dispatches `LINK_TRANSFER` — no balance adjustment needed (import already applied correct deltas).

### Import — duplicate detection

The "Skip likely duplicates" toggle (default ON) filters rows where all of these match an existing transaction: account, date, direction, amount (±£0.01), description (case-insensitive). The Step 3 done screen reports how many were skipped.

### Recurring — conflict guard (two-tap confirm)

Before creating a new recurring template, the app checks for payee name overlap or same amount + account + direction in existing templates and pending suggestions. On the first tap of "Set as recurring", if a conflict is found, the button turns amber and changes label to "Create anyway". The second tap proceeds.

---

## 5. UI components

| Component | Where used |
| --- | --- |
| Card (light) | Dashboard tiles, form groups, transaction rows |
| Card (dark) | Account detail header, net position summary |
| Tag | Account type, transaction direction, source badge |
| ProgressBar | Budget utilisation, credit card utilisation |
| Donut | Spending by category, budget health |
| AreaChart | Cash flow forecast |
| BarChart | Transaction summaries |
| DebtCurve | Per-debt simulation |
| StackedDebtChart | All-debts comparison |
| Sparkline | Dashboard mini charts |
| Segmented | Direction picker, frequency picker, account type picker |
| Toggle | Recurring on/off, skip-duplicates, rule active |
| Sheet (bottom modal) | All add/edit actions |
| FAB (extended pill) | "＋ Add transaction" — Accounts screen only |
| EmptyState | No accounts, no transactions, no budgets, suggestions inbox zero |
| SyncBanner | Firestore sync status — shown at top of app when syncing / error |

---

## 6. Modal vs full-screen guidance

| Pattern | When to use | Examples |
| --- | --- | --- |
| **Full screen** | Distinct destination; user reasons about it on its own | Dashboard, lists, details, report screens |
| **Sheet (bottom modal)** | Quick action that returns to context | Add/edit transaction, add/edit account, import wizard, transfer |
| **Dialog (centred modal)** | Confirmation, single decision | Delete account, delete transaction, undo import |
| **Inline expand** | Trivial single-field change without losing context | Mark as recurring expander, recurring frequency selector |
