import React from 'react'
import { BAPPY_SEED, BappyUtil, useBappy, BappyContext, BappyAuthContext, BappyProvider, useBappyAuth, BappyAuthProvider } from './bappy-state.jsx'
import { Icon, BappyLogo, ICON_PATHS } from './bappy-icons.jsx'
import { IconContainer, Card, Tag, ProgressBar, Button, Sheet, SectionHeader, ListRow, SeverityDot, ChannelPill, EmptyState, Toggle, Segmented, Stepper, tintBg } from './bappy-primitives.jsx'
import { chartPalette, Sparkline, AreaChart, Donut, BarChart, StackedDebtChart, DebtCurve } from './bappy-charts.jsx'
import { BappyRouter, BappyRouteContext, useRoute, ScreenHeader, TabBar, FAB } from './bappy-nav.jsx'
import { TxnListRow } from './bappy-screens-home.jsx'
// Bappy — Plan tab: Budgets, Recurring templates, Suggestions inbox

// ─── Budget spending helpers ─────────────────────────────────
// Returns the ISO date string for the first day of the current month (YYYY-MM-01).
function currentMonthStart() {
  const t = BappyUtil.today()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`
}

// Dynamically compute how much has been spent toward a budget in the current month.
// This replaces the stale `budget.spent` value that was only set at budget creation.
function computeSpent(state, budget) {
  const monthStart = currentMonthStart()
  return state.transactions
    .filter(t =>
      t.categoryId === budget.categoryId &&
      t.direction === 'expense' &&
      t.date >= monthStart
    )
    .reduce((sum, t) => sum + t.amount, 0)
}

function PlanHomeScreen() {
  const { state } = useBappy();
  const route = useRoute();
  const pendingSuggestions = state.suggestions.filter(s => s.status === 'pending').length;
  const activeTemplates = state.recurring.filter(r => r.active).length;

  // Compute over/at-risk budgets using live transaction data (not stale budget.spent)
  const todayStr = BappyUtil.today().toISOString().slice(0, 10)
  const weekEndStr = new Date(BappyUtil.today().getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const dueThisWeek = state.recurring.filter(r => r.active && r.nextDue >= todayStr && r.nextDue <= weekEndStr).length

  const budgetsWithSpent = state.budgets.map(b => ({ ...b, spent: computeSpent(state, b) }))
  const overBudgets = budgetsWithSpent.filter(b => b.spent > b.amount).length;
  const atRiskBudgets = budgetsWithSpent.filter(b => b.spent >= b.amount * 0.8 && b.spent <= b.amount).length;

  // Subscription totals (recurring items in the Subscriptions category)
  const subscriptions = state.recurring.filter(r => r.active && r.categoryId === 'cat-subs')
  const subMonthlyTotal = subscriptions.reduce((s, r) => {
    if (r.frequency === 'monthly')  return s + r.amount
    if (r.frequency === 'weekly')   return s + (r.amount * 52) / 12
    if (r.frequency === 'annually') return s + r.amount / 12
    return s
  }, 0)

  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader title="Plan" subtitle="Budgets & recurring" />

      {/* Tile grid */}
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <PlanTile
          glyph="nav-plan" tint="#02A8B9"
          title="Budgets"
          metric={state.budgets.length + ' active'}
          sub={overBudgets ? `${overBudgets} over · ${atRiskBudgets} at risk` : `${atRiskBudgets} at risk`}
          onClick={() => route.push('budgets')}
        />
        <PlanTile
          glyph="refresh" tint="#03BCA5"
          title="Recurring"
          metric={activeTemplates + ' templates'}
          sub={dueThisWeek ? `${dueThisWeek} due this week` : 'None due this week'}
          onClick={() => route.push('recurring')}
        />
        <PlanTile
          glyph="spark2" tint="#F4A535"
          title="Suggestions"
          metric={pendingSuggestions ? pendingSuggestions + ' pending' : 'None pending'}
          sub="From recurring detection"
          onClick={() => route.push('suggestions')}
          badge={pendingSuggestions}
        />
        <PlanTile
          glyph="bolt" tint="#E8566A"
          title="Subscriptions"
          metric={subscriptions.length ? `${subscriptions.length} active` : 'None active'}
          sub={subMonthlyTotal > 0 ? `${BappyUtil.fmtGBP(subMonthlyTotal)} / month` : 'Add in Recurring'}
          onClick={() => route.push('recurring')}
        />
      </div>

      {/* Budgets quick view */}
      <SectionHeader right={<button onClick={() => route.push('budgets')} style={{ fontSize: 12, color: 'var(--c-ocean-teal)', fontWeight: 500 }}>All</button>}>
        Budgets this month
      </SectionHeader>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {state.budgets.slice(0, 4).map(b => <BudgetCard key={b.id} budget={b} />)}
      </div>

      {/* Suggestions teaser */}
      {pendingSuggestions > 0 && (
        <>
          <SectionHeader>Detected patterns</SectionHeader>
          <div style={{ padding: '0 16px' }}>
            <Card padding={14} onClick={() => route.push('suggestions')} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'linear-gradient(135deg, #E0F4F6 0%, #F5FBFC 100%)',
              border: '1px solid var(--c-haze-teal)',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(2,168,185,0.18)', color: 'var(--c-ocean-teal)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name="spark2" size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: 'var(--c-deep-ink)', fontWeight: 500 }}>
                  {pendingSuggestions} recurring patterns spotted
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 2 }}>
                  PureGym, Costa Coffee, TfL cap…
                </div>
              </div>
              <Icon name="chev-right" size={16} color="var(--c-ocean-teal)" />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function PlanTile({ glyph, tint, title, metric, sub, onClick, badge }) {
  return (
    <Card padding={14} onClick={onClick} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <IconContainer glyph={glyph} tint={tint} size={36} />
        {badge ? (
          <span style={{
            background: 'var(--c-coral)', color: '#fff', fontSize: 10, fontWeight: 600,
            padding: '2px 7px', borderRadius: 999,
          }}>{badge}</span>
        ) : <Icon name="chev-right" size={14} color="var(--c-slate-mute)" />}
      </div>
      <div style={{ fontSize: 14, color: 'var(--c-deep-ink)', fontWeight: 500, marginTop: 14 }}>{title}</div>
      <div className="tnum" style={{ fontSize: 13, color: 'var(--c-slate-mute)', marginTop: 1 }}>{metric}</div>
      <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 6, opacity: 0.75 }}>{sub}</div>
    </Card>
  );
}

// ─── Budget card ─────────────────────────────────────────────
function BudgetCard({ budget }) {
  const { state } = useBappy();
  const route = useRoute();
  const cat = state.categories.find(c => c.id === budget.categoryId);
  // Compute spent live from transactions so it always reflects the current state
  const spent = computeSpent(state, budget);
  const pct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
  const variant = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'default';
  return (
    <Card padding={14} onClick={() => route.push('budget-detail', { id: budget.id })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconContainer glyph={cat?.glyph || 'dot'} tint={cat?.tint} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 14, color: 'var(--c-deep-ink)', fontWeight: 500 }}>{cat?.name}</span>
            <span className="tnum" style={{ fontSize: 13, color: pct >= 100 ? 'var(--c-coral)' : 'var(--c-slate)' }}>
              {BappyUtil.fmtGBP(spent, { abs: true })} / {BappyUtil.fmtGBP(budget.amount, { abs: true })}
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            <ProgressBar value={Math.min(spent, budget.amount * 1.1)} max={budget.amount} variant={variant} height={5} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--c-slate-mute)' }}>{pct.toFixed(0)}% spent</span>
            <span style={{ fontSize: 11, color: pct >= 100 ? 'var(--c-coral)' : 'var(--c-slate-mute)' }}>
              {pct >= 100 ? `${BappyUtil.fmtGBP(spent - budget.amount, { abs: true })} over`
                : `${BappyUtil.fmtGBP(budget.amount - spent, { abs: true })} left`}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Add Budget Sheet ─────────────────────────────────────────
const SYSTEM_CATS = new Set(['cat-income', 'cat-transfer'])

function AddBudgetSheet({ onClose }) {
  const { state, dispatch } = useBappy()

  // Categories available to budget: exclude system cats and already-budgeted ones
  const budgetedCats = new Set(state.budgets.map(b => b.categoryId))
  const availableCats = state.categories.filter(
    c => !SYSTEM_CATS.has(c.id) && !budgetedCats.has(c.id)
  )

  const [categoryId, setCategoryId] = React.useState(availableCats[0]?.id || '')
  const [amountStr, setAmountStr]   = React.useState('')
  const [period, setPeriod]         = React.useState('monthly')

  const amount = parseFloat(amountStr)
  const valid  = categoryId && amount > 0

  function handleSave() {
    if (!valid) return
    dispatch({
      type: 'ADD_BUDGET',
      budget: { categoryId, amount, period, scope: 'category', spent: 0 },
    })
    onClose()
  }

  return (
    <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Category picker ── */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-slate-mute)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Category
        </div>
        {availableCats.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--c-slate-mute)', textAlign: 'center', padding: '16px 0' }}>
            All categories already have budgets.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {availableCats.map(cat => {
              const active = categoryId === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  style={{
                    padding: '10px 6px 8px', borderRadius: 14,
                    border: active ? `2px solid ${cat.tint}` : '2px solid transparent',
                    background: active ? cat.tint + '22' : 'var(--c-ice-wash)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <IconContainer glyph={cat.glyph} tint={cat.tint} size={32} />
                  <span style={{
                    fontSize: 10, color: 'var(--c-deep-ink)', fontWeight: active ? 600 : 400,
                    lineHeight: 1.2, textAlign: 'center',
                  }}>
                    {cat.name}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Period ── */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-slate-mute)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Period
        </div>
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'monthly',  label: 'Monthly'  },
            { value: 'weekly',   label: 'Weekly'   },
            { value: 'annually', label: 'Annually' },
          ]}
        />
      </div>

      {/* ── Amount ── */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-slate-mute)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Budget amount
        </div>
        <div style={{
          display: 'flex', alignItems: 'center',
          background: 'var(--c-ice-wash)', borderRadius: 14,
          border: '2px solid transparent',
          transition: 'border-color 0.15s',
        }}
          onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--c-ocean-teal)'}
          onBlurCapture={e  => e.currentTarget.style.borderColor = 'transparent'}
        >
          <span style={{ padding: '0 4px 0 16px', fontSize: 22, fontWeight: 300, color: 'var(--c-slate-mute)' }}>£</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            placeholder="0.00"
            value={amountStr}
            onChange={e => setAmountStr(e.target.value)}
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 24, fontWeight: 300, color: 'var(--c-deep-ink)',
              padding: '14px 16px 14px 4px', fontFamily: 'inherit', width: 0,
            }}
          />
        </div>
        {amount > 0 && (
          <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 6, paddingLeft: 4 }}>
            {period === 'weekly' ? `≈ £${(amount * 52 / 12).toFixed(0)}/mo` :
             period === 'annually' ? `≈ £${(amount / 12).toFixed(0)}/mo` : ''}
          </div>
        )}
      </div>

      {/* ── Save ── */}
      <Button
        variant="primary"
        full
        disabled={!valid}
        onClick={handleSave}
      >
        Add budget
      </Button>
    </div>
  )
}

// ─── Budget health donut ─────────────────────────────────────
// Segments the total monthly spend across all budgets by health status,
// so you can see at a glance how much of your budget envelope is safe,
// at-risk, or already blown.
function BudgetHealthCard({ budgets }) {
  const { state } = useBappy()

  // Classify each budget and accumulate spend totals per health tier
  const totals = { safe: 0, risk: 0, over: 0, limit: 0 }
  const counts = { safe: 0, risk: 0, over: 0 }

  budgets.forEach(b => {
    const spent = computeSpent(state, b)
    const pct   = b.amount > 0 ? spent / b.amount : 0
    totals.limit += b.amount
    if (pct >= 1) {
      totals.over += spent;  counts.over++
    } else if (pct >= 0.8) {
      totals.risk += spent;  counts.risk++
    } else {
      totals.safe += spent;  counts.safe++
    }
  })

  const totalSpent     = totals.safe + totals.risk + totals.over
  const totalRemaining = Math.max(0, totals.limit - totalSpent)
  const overallPct     = totals.limit > 0 ? (totalSpent / totals.limit) * 100 : 0

  // Donut segments — split the "spent" arc by health tier, then a grey remainder
  const segments = [
    ...(totals.safe > 0 ? [{ label: 'On track', value: totals.safe, color: '#03BCA5' }] : []),
    ...(totals.risk > 0 ? [{ label: 'At risk',  value: totals.risk, color: '#F4A535' }] : []),
    ...(totals.over > 0 ? [{ label: 'Over',     value: totals.over, color: '#E8566A' }] : []),
    ...(totalRemaining > 0 ? [{ label: 'Remaining', value: totalRemaining, color: '#E0F4F6' }] : []),
  ]

  // If nothing spent yet show a placeholder arc
  const displaySegments = segments.length > 0
    ? segments
    : [{ label: 'Empty', value: 1, color: '#E0F4F6' }]

  const overallColor = overallPct >= 100 ? '#E8566A' : overallPct >= 80 ? '#F4A535' : '#03BCA5'

  return (
    <Card padding={16}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Donut */}
        <div style={{ flexShrink: 0 }}>
          <Donut
            segments={displaySegments}
            size={120} thickness={16}
            centerLabel={BappyUtil.fmtGBPCompact(totalSpent)}
            centerSub="spent"
          />
        </div>

        {/* Stats */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Overall progress line */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: 'var(--c-slate-mute)' }}>
                {BappyUtil.fmtGBPCompact(totalSpent)} of {BappyUtil.fmtGBPCompact(totals.limit)}
              </span>
              <span className="tnum" style={{ fontSize: 12, fontWeight: 500, color: overallColor }}>
                {overallPct.toFixed(0)}%
              </span>
            </div>
            <ProgressBar
              value={Math.min(totalSpent, totals.limit * 1.05)}
              max={totals.limit}
              variant={overallPct >= 100 ? 'danger' : overallPct >= 80 ? 'warning' : 'default'}
              height={5}
            />
          </div>

          {/* Per-tier pill counts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              { key: 'safe', label: 'On track', color: '#03BCA5', bg: 'rgba(3,188,165,0.10)' },
              { key: 'risk', label: 'At risk',  color: '#F4A535', bg: 'rgba(244,165,53,0.12)' },
              { key: 'over', label: 'Over',     color: '#E8566A', bg: 'rgba(232,86,106,0.10)' },
            ].map(({ key, label, color, bg }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 999,
                  background: bg, color,
                  fontSize: 10, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {counts[key]}
                </span>
                <span style={{ fontSize: 12, color: 'var(--c-slate)' }}>{label}</span>
                {counts[key] > 0 && (
                  <span className="tnum" style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginLeft: 'auto' }}>
                    {BappyUtil.fmtGBPCompact(totals[key])}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Budgets list (full) ─────────────────────────────────────
function BudgetsScreen() {
  const { state } = useBappy()
  const [addOpen, setAddOpen] = React.useState(false)

  // Dynamic subtitle: current month + year
  const now = BappyUtil.today()
  const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader title="Budgets" leading="back" subtitle={`${monthLabel} · monthly`} />

      {/* Budget health overview — only shown when there are budgets */}
      {state.budgets.length > 0 && (
        <div style={{ padding: '0 16px 4px' }}>
          <BudgetHealthCard budgets={state.budgets} />
        </div>
      )}

      <SectionHeader right={
        <button
          onClick={() => setAddOpen(true)}
          style={{ fontSize: 12, color: 'var(--c-ocean-teal)', fontWeight: 500 }}
        >
          + New
        </button>
      }>
        All budgets
      </SectionHeader>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {state.budgets.length === 0 && (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 15, color: 'var(--c-deep-ink)', fontWeight: 500 }}>No budgets yet</div>
            <div style={{ fontSize: 13, color: 'var(--c-slate-mute)', marginTop: 4 }}>
              Add your first budget below to start tracking spend.
            </div>
          </div>
        )}
        {state.budgets.map(b => <BudgetCard key={b.id} budget={b} />)}
        <button
          onClick={() => setAddOpen(true)}
          style={{
            marginTop: 8, padding: '14px', borderRadius: 12,
            border: '1px dashed var(--c-haze-teal)', color: 'var(--c-ocean-teal)',
            background: 'transparent', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6, fontWeight: 500, fontSize: 14,
            cursor: 'pointer',
          }}
        >
          <Icon name="plus" size={16} /> New budget
        </button>
      </div>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="New budget" height="88%">
        <AddBudgetSheet onClose={() => setAddOpen(false)} />
      </Sheet>
    </div>
  )
}

// ─── Budget detail ───────────────────────────────────────────
function BudgetDetailScreen() {
  const { state } = useBappy();
  const route = useRoute();
  const budget = state.budgets.find(b => b.id === route.current.params?.id);
  if (!budget) return <div style={{ padding: 24 }}>Not found</div>;
  const cat = state.categories.find(c => c.id === budget.categoryId);

  // Compute spent live from transactions (not stale budget.spent)
  const monthStart = currentMonthStart()
  const spent = computeSpent(state, budget);
  const pct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
  const variant = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'default';

  // Transactions counted toward this budget (this month)
  const txns = state.transactions
    .filter(t => t.categoryId === budget.categoryId && t.direction === 'expense' && t.date >= monthStart)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Dynamic month label
  const today = BappyUtil.today();
  const monthLabel = today.toLocaleDateString('en-GB', { month: 'long' });

  // Daily spend bars
  const daySpend = {};
  txns.forEach(t => { daySpend[t.date] = (daySpend[t.date] || 0) + t.amount; });
  const bars = [];
  for (let d = 1; d <= today.getDate(); d++) {
    const ds = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    bars.push({ label: d % 5 === 0 ? String(d) : '', value: daySpend[ds] || 0 });
  }

  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader leading="back" />
      <div style={{ padding: '0 16px 8px' }}>
        <Card padding={18}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconContainer glyph={cat?.glyph || 'dot'} tint={cat?.tint} size={44} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>Budget</div>
              <div style={{ fontSize: 22, color: 'var(--c-deep-ink)', fontWeight: 500 }}>{cat?.name}</div>
            </div>
          </div>
          <div className="tnum" style={{ fontSize: 32, fontWeight: 300, color: 'var(--c-deep-ink)', marginTop: 16 }}>
            {BappyUtil.fmtGBP(spent, { abs: true })}
            <span style={{ color: 'var(--c-slate-mute)', fontSize: 18, fontWeight: 300 }}>
              {' '}/ {BappyUtil.fmtGBP(budget.amount, { abs: true })}
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <ProgressBar value={Math.min(spent, budget.amount * 1.1)} max={budget.amount} variant={variant} height={8} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--c-slate-mute)' }}>{pct.toFixed(0)}% spent</span>
            <span style={{ fontSize: 12, color: pct >= 100 ? 'var(--c-coral)' : 'var(--c-slate-mute)' }}>
              {pct >= 100 ? `${BappyUtil.fmtGBP(spent - budget.amount, { abs: true })} over`
                : `${BappyUtil.fmtGBP(budget.amount - spent, { abs: true })} left`}
            </span>
          </div>
        </Card>
      </div>

      <SectionHeader>Daily spend · {monthLabel}</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={14}>
          <BarChart bars={bars} width={306} height={120}
                    color={pct >= 100 ? '#E8566A' : pct >= 80 ? '#F4A535' : '#02A8B9'} />
        </Card>
      </div>

      <SectionHeader>Counted toward budget</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={0}>
          {txns.length === 0 ? <EmptyState glyph="dot" title="No spend yet" /> :
            txns.map((t, i) => <TxnListRow key={t.id} txn={t} last={i === txns.length - 1} />)}
        </Card>
      </div>
    </div>
  );
}

// ─── Recurring templates ─────────────────────────────────────
function RecurringScreen() {
  const { state, dispatch } = useBappy();
  const route = useRoute();
  const groups = { monthly: [], weekly: [], annually: [] };
  state.recurring.forEach(r => groups[r.frequency]?.push(r));
  // Sort each by nextDue
  Object.keys(groups).forEach(k => groups[k].sort((a, b) => a.nextDue.localeCompare(b.nextDue)));

  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader title="Recurring" leading="back" subtitle={`${state.recurring.filter(r => r.active).length} active templates`} />
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Object.entries(groups).map(([freq, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={freq}>
              <div style={{
                fontSize: 11, fontWeight: 500, color: 'var(--c-slate-mute)',
                textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4, paddingBottom: 6,
              }}>{freq}</div>
              <Card padding={0}>
                {items.map((r, i) => <RecurringRow key={r.id} rec={r} last={i === items.length - 1} />)}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecurringRow({ rec, last }) {
  const { state, dispatch } = useBappy();
  const cat = state.categories.find(c => c.id === rec.categoryId);
  const isDetected = rec.source === 'detected';
  const isDrift = rec.amount > rec.baseline * 1.1;
  const days = BappyUtil.daysUntil(rec.nextDue);
  const isIncome = rec.direction === 'income';
  // Show "Mark paid" when the item is active and due within the next 3 days (or overdue)
  const isDue = rec.active && days <= 3;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderBottom: last ? 'none' : '1px solid var(--c-border)',
      opacity: rec.active ? 1 : 0.45,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <IconContainer glyph={cat?.glyph || 'dot'} tint={isIncome ? '#03BCA5' : cat?.tint} variant={isIncome ? 'income' : 'default'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 14, color: 'var(--c-deep-ink)', fontWeight: 400 }}>{rec.payee}</span>
            {isDetected && <Tag variant="muted" size="sm">detected</Tag>}
            {isDrift && <Tag variant="warning" size="sm">drift</Tag>}
            {isDue && days < 0 && <Tag variant="expense" size="sm">overdue</Tag>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 2 }}>
            {rec.active ? `${BappyUtil.fmtRelativeDate(rec.nextDue)} · ${rec.frequency}` : 'paused'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="tnum" style={{ fontSize: 14, fontWeight: 500, color: isIncome ? 'var(--c-seafoam)' : 'var(--c-deep-ink)' }}>
            {isIncome ? '+' : '−'}{BappyUtil.fmtGBP(rec.amount, { abs: true })}
          </div>
          {isDrift && (
            <div className="tnum" style={{ fontSize: 11, color: 'var(--c-amber)', marginTop: 1 }}>
              from {BappyUtil.fmtGBPCompact(rec.baseline)}
            </div>
          )}
        </div>
        <Toggle value={rec.active} onChange={() => dispatch({ type: 'TOGGLE_RECURRING', id: rec.id })} />
      </div>
      {/* Mark as paid — visible when due within 3 days or overdue */}
      {isDue && (
        <div style={{ padding: '0 16px 12px', paddingLeft: 60 }}>
          <button
            onClick={() => dispatch({ type: 'MARK_RECURRING_PAID', id: rec.id })}
            style={{
              fontSize: 12, fontWeight: 500, padding: '5px 14px',
              borderRadius: 20, border: '1px solid var(--c-border)',
              background: 'var(--c-seafoam-tint)', color: '#0a7a6a',
              cursor: 'pointer', lineHeight: 1,
            }}
          >
            ✓ Mark as paid
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Suggestions inbox ───────────────────────────────────────
function SuggestionsScreen() {
  const { state, dispatch } = useBappy();
  const pending = state.suggestions.filter(s => s.status === 'pending');

  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader title="Detected" leading="back" subtitle="Recurring patterns" />

      <div style={{ padding: '0 16px 12px' }}>
        <Card padding={14} style={{
          background: 'linear-gradient(135deg, rgba(244,165,53,0.10) 0%, rgba(2,168,185,0.10) 100%)',
          border: '1px solid var(--c-haze-teal)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 999,
              background: 'rgba(244,165,53,0.18)', color: 'var(--c-amber)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="spark2" size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--c-deep-ink)', fontWeight: 500 }}>
                Bappy spotted {pending.length} repeating charges
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 2 }}>
                Accept turns them into auto-posting templates.
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pending.length === 0
          ? <EmptyState glyph="check" title="Inbox zero" body="All patterns reviewed." />
          : pending.map(s => <SuggestionCard key={s.id} sug={s} />)}
        {state.suggestions.filter(s => s.status === 'accepted').length > 0 && (
          <div style={{ paddingTop: 12 }}>
            <div style={{
              fontSize: 11, fontWeight: 500, color: 'var(--c-slate-mute)',
              textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4, paddingBottom: 6,
            }}>Recently accepted</div>
            <Card padding={0}>
              {state.suggestions.filter(s => s.status === 'accepted').map((s, i, arr) => (
                <ListRow key={s.id} last={i === arr.length - 1}
                  icon={<IconContainer glyph="check" tint="#03BCA5" variant="income" />}
                  title={s.payee}
                  subtitle={`${BappyUtil.fmtGBP(s.amount)} · ${s.frequency}`}
                  right={<Tag variant="income">added</Tag>}
                />
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionCard({ sug }) {
  const { state, dispatch } = useBappy();
  const cat = state.categories.find(c => c.id === sug.categoryId);
  const acc = state.accounts.find(a => a.id === sug.accountId);
  const confPct = Math.round(sug.confidence * 100);
  return (
    <Card padding={14}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <IconContainer glyph={cat?.glyph || 'dot'} tint={cat?.tint} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, color: 'var(--c-deep-ink)', fontWeight: 500 }}>{sug.payee}</span>
            <span className="tnum" style={{ fontSize: 15, color: 'var(--c-deep-ink)', fontWeight: 500 }}>
              {BappyUtil.fmtGBP(sug.amount)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 2 }}>
            {sug.frequency} · {typeof sug.anchorDay === 'number' ? `day ${sug.anchorDay}` : sug.anchorDay} · {acc?.name}
          </div>

          {/* Confidence bar */}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--c-ice-wash)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                width: confPct + '%', height: '100%',
                background: confPct >= 80 ? 'var(--c-seafoam)' : confPct >= 70 ? 'var(--c-ocean-teal)' : 'var(--c-amber)',
                borderRadius: 999,
              }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--c-slate-mute)', fontWeight: 500, minWidth: 76, textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {confPct}% · {sug.evidenceCount} matches
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'DISMISS_SUGGESTION', id: sug.id })}>
              Dismiss
            </Button>
            <Button size="sm" variant="secondary" style={{ marginLeft: 'auto' }}>Edit</Button>
            <Button size="sm" variant="success" onClick={() => dispatch({ type: 'ACCEPT_SUGGESTION', id: sug.id })}>
              Accept
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export { PlanHomeScreen, BudgetsScreen, BudgetDetailScreen, RecurringScreen, SuggestionsScreen };
