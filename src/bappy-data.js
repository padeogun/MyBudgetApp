// Bappy — structural defaults only. No personal or mock data.
// All personal data (accounts, transactions, etc.) starts empty.
// Users add their own data through the app.

// ─── Categories (taxonomy — not personal data) ────────────────
export const DEFAULT_CATEGORIES = [
  { id: 'cat-grocery',  name: 'Groceries',      glyph: 'cart',    tint: '#02A8B9' },
  { id: 'cat-transport',name: 'Transport',      glyph: 'tube',    tint: '#03BCA5' },
  { id: 'cat-utility',  name: 'Utilities',      glyph: 'bolt',    tint: '#F4A535' },
  { id: 'cat-rent',     name: 'Rent',           glyph: 'home',    tint: '#1F2C2C' },
  { id: 'cat-eatout',   name: 'Eating out',     glyph: 'fork',    tint: '#E8566A' },
  { id: 'cat-subs',     name: 'Subscriptions',  glyph: 'play',    tint: '#9C6ADE' },
  { id: 'cat-personal', name: 'Personal care',  glyph: 'spark',   tint: '#03BCA5' },
  { id: 'cat-clothing', name: 'Clothing',       glyph: 'shirt',   tint: '#E8566A' },
  { id: 'cat-house',    name: 'Household',      glyph: 'box',     tint: '#02A8B9' },
  { id: 'cat-fun',      name: 'Entertainment',  glyph: 'ticket',  tint: '#F4A535' },
  { id: 'cat-fees',     name: 'Fees & charges', glyph: 'card',    tint: '#7A8181' },
  { id: 'cat-income',   name: 'Income',         glyph: 'arrow-in',tint: '#03BCA5' },
  { id: 'cat-transfer', name: 'Transfer',            glyph: 'swap',    tint: '#7A8181' },
  { id: 'cat-other',    name: 'Other',              glyph: 'dot',     tint: '#7A8181' },
  // Extended categories
  { id: 'cat-phone',    name: 'Phone',              glyph: 'phone',   tint: '#02A8B9' },
  { id: 'cat-carloan',  name: 'Car Loan Repayment', glyph: 'acc-loan',tint: '#7A8181' },
  { id: 'cat-ccrepay',  name: 'Credit Card Repayment', glyph: 'card', tint: '#7A8181' },
  { id: 'cat-loan',     name: 'Loan',               glyph: 'acc-loan',tint: '#E8566A' },
  { id: 'cat-car',      name: 'Car',                glyph: 'car',     tint: '#F4A535' },
  { id: 'cat-children', name: 'Children',           glyph: 'child',   tint: '#9C6ADE' },
  { id: 'cat-shopping', name: 'Shopping',           glyph: 'bag',     tint: '#E8566A' },
];

// ─── Default nudge routing / throttling / escalation rules ────
export const DEFAULT_NUDGE_RULES = [
  { id: 'R1', axis: 'routing',    priority: 100, name: 'Base routing — all nudges get in-app',
    when: { nudge_type: '*' }, then: { add_channels: ['in_app'] }, active: true },
  { id: 'R2', axis: 'routing',    priority: 90,  name: 'Alerts go everywhere',
    when: { severity: 'alert' }, then: { add_channels: ['in_app','email','web_push'] }, active: true },
  { id: 'R3', axis: 'routing',    priority: 80,  name: 'Warnings get email',
    when: { severity: 'warning' }, then: { add_channels: ['email'] }, active: true },
  { id: 'R4', axis: 'routing',    priority: 70,  name: 'Bill due in ≤1 day — escalate channels',
    when: { nudge_type: 'bill_due', context_match: 'days_until_due <= 1' }, then: { add_channels: ['email','web_push'] }, active: true },
  { id: 'R5', axis: 'routing',    priority: 60,  name: 'Pay day — broadcast',
    when: { nudge_type: 'pay_day' }, then: { add_channels: ['email','web_push'] }, active: true },
  { id: 'R6', axis: 'routing',    priority: 50,  name: 'Detection available — in-app only',
    when: { nudge_type: 'detection_available' }, then: { set_channels: ['in_app'] }, active: true },
  { id: 'R7', axis: 'routing',    priority: 40,  name: 'Quiet hours suppress Web Push for non-alerts',
    when: { time_of_day: 'in quiet_hours', severity: '!=alert' }, then: { remove_channels: ['web_push'] }, active: true },
  { id: 'R8', axis: 'routing',    priority: 35,  name: 'Quiet hours defer email to digest',
    when: { time_of_day: 'in quiet_hours', severity: '!=alert', email_digest_mode: 'immediate' },
    then: { remove_channels: ['email'] }, active: false },
  { id: 'T1', axis: 'throttling', priority: 100, name: 'Web Push daily cap',
    when: { channel: 'web_push' }, then: { max_per_day: 4 }, active: true },
  { id: 'T2', axis: 'throttling', priority: 90,  name: 'Web Push per-type daily cap',
    when: { channel: 'web_push' }, then: { max_per_type_per_day: 1 }, active: true },
  { id: 'T3', axis: 'throttling', priority: 80,  name: 'Web Push minimum gap',
    when: { channel: 'web_push' }, then: { min_gap: '2h' }, active: true },
  { id: 'T4', axis: 'throttling', priority: 70,  name: 'Email immediate per-type daily cap',
    when: { channel: 'email', email_digest_mode: 'immediate' }, then: { max_per_type_per_day: 2 }, active: true },
  { id: 'E1', axis: 'escalation', priority: 100, name: 'Low balance not acted in 12h',
    when: { nudge_type: 'low_balance', not_acted_within: '12h' },
    then: { re_push: true, add_channels: ['email','web_push'], bump_severity: true }, active: true },
  { id: 'E2', axis: 'escalation', priority: 90,  name: 'Bill due ≤6h, not acted',
    when: { nudge_type: 'bill_due', context_match: 'days_until_due <= 0.25', not_acted_within: '2h' },
    then: { re_push: true, add_channels: ['email','web_push'], bump_severity: true }, active: true },
  { id: 'E3', axis: 'escalation', priority: 80,  name: 'Budget at 100%, not acted in 24h',
    when: { nudge_type: 'budget_threshold', context_match: 'percent_of_budget >= 100', not_acted_within: '24h' },
    then: { re_push: true, add_channels: ['email'] }, active: true },
];

// ─── Default app settings ─────────────────────────────────────
export const DEFAULT_SETTINGS = {
  payFrequency: 'monthly',
  payAnchorDay: 25,
  payAnchorWeekday: 5,       // Fri (Mon=1, Sun=0)
  forecastHorizonDays: 90,
  detectionConfidenceThreshold: 0.7,
  quietHours: { start: '22:00', end: '07:00' },
  emailDigestMode: 'immediate',
  lowBalanceFloor: 200,
  currency: 'GBP',
  weekStart: 'Mon',
};

// ─── Initial app state — all personal data starts empty ───────
// BAPPY_SEED is still exported for screen files that import it.
export const BAPPY_SEED = {
  categories:     DEFAULT_CATEGORIES,
  accounts:       [],
  transactions:   [],
  recurring:      [],
  budgets:        [],
  suggestions:    [],
  nudges:         [],
  nudgeRules:     DEFAULT_NUDGE_RULES,
  settings:       DEFAULT_SETTINGS,
  lastImport:     null,   // { ids, count, date, filename } — used for rollback
  lastModifiedAt: 0,      // epoch ms — bumped on every mutation; used for Sheets conflict resolution
};
