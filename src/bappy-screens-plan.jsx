import React from 'react'
import { BAPPY_SEED, BappyUtil, useBappy, BappyContext, BappyAuthContext, BappyProvider, useBappyAuth, BappyAuthProvider } from './bappy-state.jsx'
import { Icon, BappyLogo, ICON_PATHS } from './bappy-icons.jsx'
import { IconContainer, Card, Tag, ProgressBar, Button, Sheet, SectionHeader, ListRow, SeverityDot, ChannelPill, EmptyState, Toggle, Segmented, Stepper, tintBg } from './bappy-primitives.jsx'
import { chartPalette, Sparkline, AreaChart, Donut, BarChart, StackedDebtChart, DebtCurve, useContainerWidth } from './bappy-charts.jsx'
import { BappyRouter, BappyRouteContext, useRoute, ScreenHeader, TabBar, FAB } from './bappy-nav.jsx'
import { TxnListRow } from './bappy-screens-home.jsx'
// Bappy — Plan tab: Budgets, Recurring templates, Suggestions inbox

function FilterChip({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, padding: '6px 12px', borderRadius: 999,
      background: active ? 'var(--c-deep-ink)' : '#fff',
      border: '1px solid ' + (active ? 'var(--c-deep-ink)' : 'var(--c-border)'),
      color: active ? '#fff' : 'var(--c-slate)',
      fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
    }}>{children}</button>
  );
}

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
      <ScreenHeader title="Plan" subtitle="Budgets, goals & recurring" />

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
          onClick={() => route.push('recurring', { filter: 'subscriptions' })}
        />
        <PlanTile
          glyph="star" tint="#F4A535"
          title="Goals"
          metric={(() => {
            const g = state.goals || [];
            const active = g.filter(x => x.active);
            const achieved = g.filter(x => !x.active);
            if (active.length === 0) return 'No goals yet';
            return active.length + ' active' + (achieved.length ? ` · ${achieved.length} achieved` : '');
          })()}
          sub={(() => {
            const g = (state.goals || []).filter(x => x.active);
            if (!g.length) return 'Set a savings or payoff target';
            const prog = BappyUtil.goalProgress(g[0], state);
            return `${g[0].title} · ${prog.pct.toFixed(0)}%`;
          })()}
          onClick={() => route.push('goals')}
          badge={(() => {
            const newMilestones = (state.goals || []).filter(g => g.active).reduce((n, g) => {
              const prog = BappyUtil.goalProgress(g, state);
              return n + prog.uncelebrated.length;
            }, 0);
            return newMilestones || 0;
          })()}
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
  const variant = pct > 100 ? 'danger' : pct >= 80 ? 'warning' : 'default';
  return (
    <Card padding={14} onClick={() => route.push('budget-detail', { id: budget.id })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconContainer glyph={cat?.glyph || 'dot'} tint={cat?.tint} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 14, color: 'var(--c-deep-ink)', fontWeight: 500 }}>{cat?.name}</span>
            <span className="tnum" style={{ fontSize: 13, color: pct > 100 ? 'var(--c-coral)' : 'var(--c-slate)' }}>
              {BappyUtil.fmtGBP(spent, { abs: true })} / {BappyUtil.fmtGBP(budget.amount, { abs: true })}
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            <ProgressBar value={Math.min(spent, budget.amount * 1.1)} max={budget.amount} variant={variant} height={5} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--c-slate-mute)' }}>{pct.toFixed(0)}% spent</span>
            <span style={{ fontSize: 11, color: pct > 100 ? 'var(--c-coral)' : 'var(--c-slate-mute)' }}>
              {pct > 100 ? `${BappyUtil.fmtGBP(spent - budget.amount, { abs: true })} over`
                : `${BappyUtil.fmtGBP(budget.amount - spent, { abs: true })} left`}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Add Budget Sheet ─────────────────────────────────────────
const SYSTEM_CATS     = new Set(['cat-income', 'cat-transfer'])
const SKIP_SUGGEST    = new Set(['cat-income', 'cat-transfer', 'cat-other']) // too generic to budget

// ─── Budget suggestion engine ─────────────────────────────────
// Analyses 3 months of transaction history and returns up to 5 suggestions:
//   'missing'      – category has regular spend but no budget
//   'too_tight'    – budget exceeded in 2+ of the last 3 complete months
//   'too_generous' – budget < 40% used on average over last 3 complete months
function computeBudgetSuggestions(state) {
  const today = BappyUtil.today();
  const MIN_AVG_SPEND = 30;  // £30/month minimum to bother suggesting

  // Last 3 complete calendar months (exclude the current in-progress month)
  const months = [];
  for (let m = 1; m <= 3; m++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - m, 1));
    months.push(d.toISOString().slice(0, 7));
  }

  // Build { 'YYYY-MM': { catId: amount } } for expense transactions only
  const spendByMonth = {};
  state.transactions.forEach(t => {
    if (t.direction !== 'expense') return;
    const mk = t.date.slice(0, 7);
    if (!months.includes(mk)) return;
    if (!spendByMonth[mk]) spendByMonth[mk] = {};
    spendByMonth[mk][t.categoryId] = (spendByMonth[mk][t.categoryId] || 0) + t.amount;
  });

  const suggestions = [];
  const budgetedCatIds = new Set(state.budgets.map(b => b.categoryId));

  // ── Type 1: Missing budgets ───────────────────────────────────
  const totalByCat = {}, countByCat = {};
  Object.entries(spendByMonth).forEach(([, catSpend]) => {
    Object.entries(catSpend).forEach(([catId, amt]) => {
      totalByCat[catId] = (totalByCat[catId] || 0) + amt;
      countByCat[catId] = (countByCat[catId] || 0) + 1;
    });
  });

  Object.entries(totalByCat).forEach(([catId, total]) => {
    if (SKIP_SUGGEST.has(catId) || budgetedCatIds.has(catId)) return;
    const monthsWithData = countByCat[catId] || 1;
    const avg = total / monthsWithData;
    if (avg < MIN_AVG_SPEND) return;
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    suggestions.push({
      type: 'missing',
      categoryId: catId, categoryName: cat.name, categoryGlyph: cat.glyph, categoryTint: cat.tint,
      suggestedAmount: Math.ceil((avg * 1.1) / 10) * 10,
      avgMonthlySpend: Math.round(avg),
      monthsAnalysed: monthsWithData,
      _priority: avg,
    });
  });

  // ── Types 2 & 3: Existing budget adjustments ─────────────────
  state.budgets.forEach(budget => {
    const monthlySpends = months.map(m => spendByMonth[m]?.[budget.categoryId] || 0);
    const monthsWithData = monthlySpends.filter(s => s > 0).length;
    if (monthsWithData < 2) return; // need ≥2 months to advise
    const avgSpend = monthlySpends.reduce((a, b) => a + b, 0) / months.length;
    const monthsOver = monthlySpends.filter(s => s > budget.amount).length;
    const avgUsagePct = budget.amount > 0 ? (avgSpend / budget.amount) * 100 : 0;
    const cat = state.categories.find(c => c.id === budget.categoryId);
    if (!cat) return;

    if (monthsOver >= 2) {
      // Too tight: exceeded in 2+ of 3 months
      const suggested = Math.ceil((avgSpend * 1.05) / 10) * 10;
      suggestions.push({
        type: 'too_tight',
        categoryId: budget.categoryId, categoryName: cat.name, categoryGlyph: cat.glyph, categoryTint: cat.tint,
        budgetId: budget.id, currentAmount: budget.amount,
        suggestedAmount: suggested,
        avgMonthlySpend: Math.round(avgSpend), monthsOver,
        _priority: avgSpend,
      });
    } else if (avgUsagePct < 40 && monthsWithData >= 2) {
      // Too generous: under 40% on average — only suggest a reduction
      const suggested = Math.ceil((avgSpend * 1.25) / 10) * 10;
      if (suggested >= budget.amount) return;
      suggestions.push({
        type: 'too_generous',
        categoryId: budget.categoryId, categoryName: cat.name, categoryGlyph: cat.glyph, categoryTint: cat.tint,
        budgetId: budget.id, currentAmount: budget.amount,
        suggestedAmount: Math.max(10, suggested),
        avgMonthlySpend: Math.round(avgSpend), avgUsagePct: Math.round(avgUsagePct),
        _priority: budget.amount - suggested,
      });
    }
  });

  // Sort: too_tight (most urgent) → missing (by avg spend) → too_generous
  const order = { too_tight: 0, missing: 1, too_generous: 2 };
  suggestions.sort((a, b) =>
    order[a.type] !== order[b.type] ? order[a.type] - order[b.type] : b._priority - a._priority
  );

  // How many complete months of data do we have?
  const dataMonths = months.filter(m => !!spendByMonth[m]).length;

  return { suggestions: suggestions.slice(0, 5), dataMonths };
}

function AddBudgetSheet({ onClose, prefill }) {
  const { state, dispatch } = useBappy()

  // All categories available to budget except income/transfer (not meaningful as expense limits).
  // Already-budgeted categories remain selectable so additional period budgets can be created.
  const availableCats = state.categories.filter(c => !SYSTEM_CATS.has(c.id))

  const [categoryId, setCategoryId] = React.useState(prefill?.categoryId || availableCats[0]?.id || '')
  const [amountStr, setAmountStr]   = React.useState(prefill?.amount ? String(prefill.amount) : '')
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
        {availableCats.length === 0 ? null : (
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
              variant={overallPct > 100 ? 'danger' : overallPct >= 80 ? 'warning' : 'default'}
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
  const { state, dispatch } = useBappy()
  const [addOpen,    setAddOpen]    = React.useState(false)
  const [prefill,    setPrefill]    = React.useState(null)
  const [dismissed,  setDismissed]  = React.useState(new Set())
  const [query,      setQuery]      = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('all') // all | safe | risk | over

  // Dynamic subtitle: current month + year
  const now = BappyUtil.today()
  const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const norm = s => (s || '').toLowerCase()

  const { suggestions, dataMonths } = computeBudgetSuggestions(state)
  const visibleSuggestions = suggestions.filter(s => !dismissed.has(s.categoryId + s.type))

  const handleApply = (s) => {
    if (s.type === 'missing') {
      setPrefill({ categoryId: s.categoryId, amount: s.suggestedAmount });
      setAddOpen(true);
    } else {
      // too_tight or too_generous — update existing budget amount directly
      dispatch({ type: 'UPDATE_BUDGET', id: s.budgetId, patch: { amount: s.suggestedAmount } });
      setDismissed(prev => new Set([...prev, s.categoryId + s.type]));
    }
  };

  const handleDismiss = (s) => setDismissed(prev => new Set([...prev, s.categoryId + s.type]));

  // Filter budgets by search query and status
  const filteredBudgets = state.budgets.filter(b => {
    const cat = state.categories.find(c => c.id === b.categoryId)
    if (query && !norm(cat?.name).includes(norm(query))) return false
    if (statusFilter !== 'all') {
      const spent = computeSpent(state, b)
      const pct = b.amount > 0 ? spent / b.amount : 0
      if (statusFilter === 'over'  && pct <= 1)    return false
      if (statusFilter === 'risk'  && (pct < 0.8 || pct > 1)) return false
      if (statusFilter === 'safe'  && pct >= 0.8)  return false
    }
    return true
  })

  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader title="Budgets" leading="back" subtitle={`${monthLabel} · monthly`} />

      {/* Budget health overview — only shown when there are budgets */}
      {state.budgets.length > 0 && (
        <div style={{ padding: '0 16px 4px' }}>
          <BudgetHealthCard budgets={state.budgets} />
        </div>
      )}

      {/* Search + status filter */}
      {state.budgets.length > 0 && (
        <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--c-ice-wash)', border: '1px solid var(--c-border)' }}>
            <Icon name="search" size={16} color="var(--c-slate-mute)" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search budgets…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--c-deep-ink)' }} />
            {query && <button onClick={() => setQuery('')} style={{ color: 'var(--c-slate-mute)', border: 'none', background: 'none', padding: '0 2px', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>×</button>}
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }} className="bappy-scroll">
            <FilterChip active={statusFilter === 'all'}  onClick={() => setStatusFilter('all')}>All</FilterChip>
            <FilterChip active={statusFilter === 'safe'} onClick={() => setStatusFilter('safe')}>On track</FilterChip>
            <FilterChip active={statusFilter === 'risk'} onClick={() => setStatusFilter('risk')}>At risk</FilterChip>
            <FilterChip active={statusFilter === 'over'} onClick={() => setStatusFilter('over')}>Over</FilterChip>
          </div>
        </div>
      )}

      {/* Budget suggestions */}
      {dataMonths >= 1 && visibleSuggestions.length > 0 && (
        <>
          <SectionHeader right={
            <span style={{ fontSize: 11, color: 'var(--c-slate-mute)' }}>Based on {dataMonths} month{dataMonths !== 1 ? 's' : ''} of data</span>
          }>
            Suggested adjustments
          </SectionHeader>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
            {visibleSuggestions.map(s => {
              const config = {
                missing:      { icon: '＋', bg: 'rgba(2,168,185,0.06)',  border: 'rgba(2,168,185,0.25)',  label: 'No budget set',          action: 'Set budget' },
                too_tight:    { icon: '⚠', bg: 'rgba(244,165,53,0.08)', border: 'rgba(244,165,53,0.30)', label: `Over budget ${s.monthsOver}× recently`, action: 'Raise to' },
                too_generous: { icon: '↓', bg: 'rgba(3,188,165,0.06)',  border: 'rgba(3,188,165,0.25)', label: `Only ${s.avgUsagePct}% used on avg`,  action: 'Lower to' },
              }[s.type];
              return (
                <div key={s.categoryId + s.type} style={{
                  padding: '12px 14px', borderRadius: 12,
                  background: config.bg, border: `1px solid ${config.border}`,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <IconContainer glyph={s.categoryGlyph} tint={s.categoryTint} size={32} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-deep-ink)' }}>{s.categoryName}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 1 }}>
                      {config.label}
                      {s.type !== 'missing' && (
                        <span> · avg {BappyUtil.fmtGBP(s.avgMonthlySpend)}/mo · current budget {BappyUtil.fmtGBP(s.currentAmount)}</span>
                      )}
                      {s.type === 'missing' && (
                        <span> · avg {BappyUtil.fmtGBP(s.avgMonthlySpend)}/mo</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleApply(s)}
                      style={{
                        padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                        background: 'var(--c-ocean-teal)', color: '#fff', border: 'none', whiteSpace: 'nowrap',
                      }}>
                      {config.action} {BappyUtil.fmtGBP(s.suggestedAmount)}
                    </button>
                    <button
                      onClick={() => handleDismiss(s)}
                      style={{ fontSize: 11, color: 'var(--c-slate-mute)', border: 'none', background: 'none', padding: 0 }}>
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {dataMonths === 0 && state.budgets.length === 0 && (
        <div style={{ padding: '0 16px 8px' }}>
          <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--c-ice-wash)', fontSize: 13, color: 'var(--c-slate-mute)', lineHeight: 1.5 }}>
            Add at least 1 month of transactions to get personalised budget suggestions.
          </div>
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
        {filteredBudgets.length === 0 && state.budgets.length > 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--c-slate-mute)', fontSize: 13 }}>
            No budgets match your filter.
          </div>
        )}
        {filteredBudgets.map(b => <BudgetCard key={b.id} budget={b} />)}
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

      <Sheet open={addOpen} onClose={() => { setAddOpen(false); setPrefill(null); }} title="New budget" height="88%">
        <AddBudgetSheet onClose={() => { setAddOpen(false); setPrefill(null); }} prefill={prefill} />
      </Sheet>
    </div>
  )
}

// ─── Edit Budget Sheet ────────────────────────────────────────
function EditBudgetSheet({ budget, onClose }) {
  const { state, dispatch } = useBappy()
  const route = useRoute()
  const [amountStr, setAmountStr] = React.useState(String(budget.amount))
  const [period, setPeriod]       = React.useState(budget.period || 'monthly')
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  const amount = parseFloat(amountStr)
  const valid  = amount > 0

  function handleSave() {
    if (!valid) return
    dispatch({ type: 'UPDATE_BUDGET', id: budget.id, patch: { amount, period } })
    onClose()
  }

  function handleDelete() {
    dispatch({ type: 'DELETE_BUDGET', id: budget.id })
    onClose()
    route.pop()
  }

  const cat = state.categories.find(c => c.id === budget.categoryId)

  return (
    <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Category (read-only) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--c-ice-wash)' }}>
        <IconContainer glyph={cat?.glyph || 'dot'} tint={cat?.tint} size={36} />
        <div>
          <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 500 }}>Category</div>
          <div style={{ fontSize: 15, color: 'var(--c-deep-ink)', fontWeight: 500 }}>{cat?.name}</div>
        </div>
      </div>

      {/* Period */}
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

      {/* Amount */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-slate-mute)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Budget amount
        </div>
        <div style={{
          display: 'flex', alignItems: 'center',
          background: 'var(--c-ice-wash)', borderRadius: 14,
          border: '2px solid transparent', transition: 'border-color 0.15s',
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

      <Button variant="primary" full disabled={!valid} onClick={handleSave}>
        Save changes
      </Button>

      {/* Delete */}
      {confirmDelete ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 12, background: 'rgba(232,86,106,0.06)', border: '1px solid rgba(232,86,106,0.25)' }}>
          <div style={{ fontSize: 13, color: 'var(--c-coral)', fontWeight: 500, textAlign: 'center' }}>Delete this budget?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" full onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <button
              onClick={handleDelete}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid var(--c-coral)', background: 'rgba(232,86,106,0.08)', color: 'var(--c-coral)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >Delete</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          style={{ fontSize: 13, color: 'var(--c-coral)', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Delete budget
        </button>
      )}
    </div>
  )
}

// ─── Budget detail ───────────────────────────────────────────
function BudgetDetailScreen() {
  const { state } = useBappy();
  const route = useRoute();
  const [editOpen, setEditOpen] = React.useState(false);
  const [barChartRef, barChartW] = useContainerWidth(306);
  const budget = state.budgets.find(b => b.id === route.current.params?.id);
  if (!budget) return <div style={{ padding: 24 }}>Not found</div>;
  const cat = state.categories.find(c => c.id === budget.categoryId);

  // Compute spent live from transactions (not stale budget.spent)
  const monthStart = currentMonthStart()
  const spent = computeSpent(state, budget);
  const pct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
  const variant = pct > 100 ? 'danger' : pct >= 80 ? 'warning' : 'default';

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
      <ScreenHeader
        leading="back"
        trailing={
          <button
            onClick={() => setEditOpen(true)}
            style={{ fontSize: 13, color: 'var(--c-ocean-teal)', fontWeight: 500, border: 'none', background: 'none', padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Edit
          </button>
        }
      />
      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Edit budget" height="78%">
        <EditBudgetSheet budget={budget} onClose={() => setEditOpen(false)} />
      </Sheet>
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
            <span style={{ fontSize: 12, color: pct > 100 ? 'var(--c-coral)' : 'var(--c-slate-mute)' }}>
              {pct > 100 ? `${BappyUtil.fmtGBP(spent - budget.amount, { abs: true })} over`
                : `${BappyUtil.fmtGBP(budget.amount - spent, { abs: true })} left`}
            </span>
          </div>
        </Card>
      </div>

      <SectionHeader>Daily spend · {monthLabel}</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={14}>
          <div ref={barChartRef} style={{ width: '100%' }}>
            <BarChart bars={bars} width={barChartW} height={120}
                      color={pct > 100 ? '#E8566A' : pct >= 80 ? '#F4A535' : '#02A8B9'} />
          </div>
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
  const isSubscriptions = route.current.params?.filter === 'subscriptions';
  const [query,        setQuery]        = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('active'); // all | active | paused
  const [dirFilter,    setDirFilter]    = React.useState('all');    // all | expense | income

  const norm = s => (s || '').toLowerCase();

  const source = (isSubscriptions
    ? state.recurring.filter(r => r.categoryId === 'cat-subs')
    : state.recurring
  )
    .filter(r => !query || norm(r.payee).includes(norm(query)))
    .filter(r => statusFilter === 'all' || (statusFilter === 'active' ? r.active : !r.active))
    .filter(r => dirFilter === 'all' || r.direction === dirFilter);

  const groups = { monthly: [], weekly: [], annually: [] };
  source.forEach(r => groups[r.frequency]?.push(r));
  Object.keys(groups).forEach(k => groups[k].sort((a, b) => a.nextDue.localeCompare(b.nextDue)));

  const activeCount = source.filter(r => r.active).length;

  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader
        title={isSubscriptions ? 'Subscriptions' : 'Recurring'}
        leading="back"
        subtitle={`${activeCount} active`}
      />

      {/* Search + filters */}
      <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--c-ice-wash)', border: '1px solid var(--c-border)' }}>
          <Icon name="search" size={16} color="var(--c-slate-mute)" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder={isSubscriptions ? 'Search subscriptions…' : 'Search recurring…'}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--c-deep-ink)' }} />
          {query && <button onClick={() => setQuery('')} style={{ color: 'var(--c-slate-mute)', border: 'none', background: 'none', padding: '0 2px', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>×</button>}
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }} className="bappy-scroll">
          <FilterChip active={statusFilter === 'active'} onClick={() => setStatusFilter('active')}>Active</FilterChip>
          <FilterChip active={statusFilter === 'all'}    onClick={() => setStatusFilter('all')}>All</FilterChip>
          <FilterChip active={statusFilter === 'paused'} onClick={() => setStatusFilter('paused')}>Paused</FilterChip>
          {!isSubscriptions && (
            <>
              <div style={{ width: 1, background: 'var(--c-border)', margin: '0 2px', flexShrink: 0 }} />
              <FilterChip active={dirFilter === 'all'}     onClick={() => setDirFilter('all')}>All</FilterChip>
              <FilterChip active={dirFilter === 'expense'} onClick={() => setDirFilter('expense')}>Expenses</FilterChip>
              <FilterChip active={dirFilter === 'income'}  onClick={() => setDirFilter('income')}>Income</FilterChip>
            </>
          )}
        </div>
      </div>

      {source.length === 0
        ? <EmptyState glyph="bolt" title={query ? 'No matches' : isSubscriptions ? 'No subscriptions' : 'No results'} body={query ? 'Try a different search term.' : 'Add recurring items with the Subscriptions category.'} />
        : (
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
        )
      }
    </div>
  );
}

function RecurringRow({ rec, last }) {
  const { state, dispatch } = useBappy();
  const route = useRoute();
  const cat = state.categories.find(c => c.id === rec.categoryId);
  const isDetected = rec.source === 'detected';
  const isDrift = rec.amount > rec.baseline * 1.1;
  const days = BappyUtil.daysUntil(rec.nextDue);
  const isIncome = rec.direction === 'income';
  const isDue = rec.active && days <= 3;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderBottom: last ? 'none' : '1px solid var(--c-border)',
      opacity: rec.active ? 1 : 0.45,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <IconContainer glyph={cat?.glyph || 'dot'} tint={isIncome ? '#03BCA5' : cat?.tint} variant={isIncome ? 'income' : 'default'} />
        <div
          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          onClick={() => route.openSheet({ kind: 'edit-recurring', recurringId: rec.id })}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 14, color: 'var(--c-deep-ink)', fontWeight: 400 }}>{rec.payee}</span>
            {isDetected && <Tag variant="muted" size="sm">detected</Tag>}
            {isDrift && <Tag variant="warning" size="sm">drift</Tag>}
            {isDue && days < 0 && <Tag variant="expense" size="sm">overdue</Tag>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 2 }}>
            {rec.active ? `${BappyUtil.fmtRelativeDate(rec.nextDue)} · ${rec.frequency}` : 'paused'}
            {rec.endDate && <span style={{ marginLeft: 5 }}>· ends {BappyUtil.fmtDateShort(rec.endDate)}</span>}
            {rec.maxPayments && <span style={{ marginLeft: 5 }}>· {rec.paymentsMade || 0}/{rec.maxPayments} paid</span>}
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

// ─── Goals ───────────────────────────────────────────────────
const GOAL_TYPES = [
  { value: 'savings',        label: 'Savings',        glyph: 'star',       tint: '#F4A535', desc: 'Save toward a specific target in a savings account' },
  { value: 'debt_payoff',    label: 'Debt-free',      glyph: 'shield',     tint: '#03BCA5', desc: 'Track paying off a credit card or loan' },
  { value: 'net_worth',      label: 'Net worth',      glyph: 'spark',      tint: '#9C6ADE', desc: 'Grow your overall net position to a milestone' },
  { value: 'emergency_fund', label: 'Emergency fund', glyph: 'acc-savings',tint: '#02A8B9', desc: 'Build 3 months of expenses as a safety buffer' },
  { value: 'spending_habit', label: 'Surplus habit',  glyph: 'refresh',    tint: '#E8566A', desc: 'Spend less than you earn for N consecutive months' },
];

const MILESTONE_LABELS = { 25: 'Quarter way there!', 50: 'Halfway!', 75: 'Almost there!', 100: 'Goal achieved!' };
const MILESTONE_COLORS = { 25: '#F4A535', 50: '#03BCA5', 75: '#9C6ADE', 100: '#02A8B9' };

function GoalsScreen() {
  const { state, dispatch } = useBappy();
  const route = useRoute();
  const goals = state.goals || [];
  const [celebrating, setCelebrating] = React.useState(null); // { goalId, milestone }

  // Detect uncelebrated milestones on mount/update
  React.useEffect(() => {
    for (const g of goals) {
      if (!g.active) continue;
      const prog = BappyUtil.goalProgress(g, state);
      if (prog.uncelebrated.length > 0) {
        const highest = Math.max(...prog.uncelebrated);
        setCelebrating({ goalId: g.id, milestone: highest, title: g.title });
        break;
      }
    }
  }, []);

  const handleCelebrate = (goalId, milestone) => {
    dispatch({ type: 'CELEBRATE_MILESTONE', id: goalId, milestone });
    setCelebrating(null);
  };

  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader
        title="Goals"
        leading="back"
        subtitle={`${goals.filter(g => g.active).length} active`}
        right={
          <button onClick={() => route.openSheet({ kind: 'add-goal' })} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 11px 5px 8px', borderRadius: 999,
            border: '1.5px solid var(--c-ocean-teal)',
            background: '#fff', color: 'var(--c-ocean-teal)',
            fontSize: 12, fontWeight: 600,
          }}>
            <Icon name="plus" size={13} strokeWidth={2.5} /> Goal
          </button>
        }
      />

      {/* Milestone celebration */}
      {celebrating && (
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{
            padding: '16px', borderRadius: 14,
            background: `linear-gradient(135deg, ${MILESTONE_COLORS[celebrating.milestone]}22, ${MILESTONE_COLORS[celebrating.milestone]}11)`,
            border: `1.5px solid ${MILESTONE_COLORS[celebrating.milestone]}55`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>
              {celebrating.milestone === 100 ? '🏆' : celebrating.milestone === 75 ? '🎯' : celebrating.milestone === 50 ? '⭐' : '🌱'}
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--c-deep-ink)', marginBottom: 4 }}>
              {MILESTONE_LABELS[celebrating.milestone]}
            </div>
            <div style={{ fontSize: 13, color: 'var(--c-slate)', marginBottom: 14 }}>
              {celebrating.title} is at {celebrating.milestone}%
            </div>
            <button
              onClick={() => handleCelebrate(celebrating.goalId, celebrating.milestone)}
              style={{
                padding: '8px 24px', borderRadius: 999,
                background: MILESTONE_COLORS[celebrating.milestone],
                color: '#fff', fontSize: 13, fontWeight: 600,
              }}>
              {celebrating.milestone === 100 ? 'Celebrate!' : 'Keep going!'}
            </button>
          </div>
        </div>
      )}

      {/* Suggested goals (Phase 2) — shown when specific types not yet set */}
      {(() => {
        const hasType = (t) => goals.some(g => g.type === t && g.active);
        const suggestions = [];

        // Emergency fund suggestion
        if (!hasType('emergency_fund') && state.accounts.some(a => a.type === 'savings')) {
          const threeAgo = new Date(BappyUtil.today()); threeAgo.setUTCMonth(threeAgo.getUTCMonth() - 3);
          const spend3mo = state.transactions.filter(t => t.direction === 'expense' && new Date(t.date) >= threeAgo).reduce((s, t) => s + t.amount, 0);
          const suggestedTarget = Math.ceil((spend3mo / 3) * 3 / 100) * 100 || 3000;
          suggestions.push({
            type: 'emergency_fund', icon: '🛡️', tint: '#02A8B9', glyph: 'acc-savings',
            title: 'Build an emergency fund',
            body: `${BappyUtil.fmtGBP(suggestedTarget)} covers ~3 months of your expenses.`,
          });
        }

        // Surplus habit suggestion
        if (!hasType('spending_habit')) {
          const months = BappyUtil.surplusMonths(state, 3);
          const surplusCount = months.filter(m => m.surplus !== null && m.surplus > 0).length;
          suggestions.push({
            type: 'spending_habit', icon: '📈', tint: '#E8566A', glyph: 'refresh',
            title: 'Build a surplus habit',
            body: surplusCount === 3 ? 'You\'ve been in surplus 3 months running — lock it in!'
              : surplusCount > 0 ? `${surplusCount} of the last 3 months you spent less than you earned.`
              : 'Set a streak goal to spend less than you earn each month.',
          });
        }

        // Net worth milestone suggestion (if positive net worth with no goal)
        if (!hasType('net_worth')) {
          const nw = state.accounts.reduce((s, a) => s + a.balance, 0);
          if (nw > 0) {
            const suggestedTarget = Math.ceil(nw * 2 / 1000) * 1000;
            suggestions.push({
              type: 'net_worth', icon: '✨', tint: '#9C6ADE', glyph: 'spark',
              title: 'Grow your net worth',
              body: `You're at ${BappyUtil.fmtGBPCompact(nw)} — set a milestone to double it.`,
              prefill: { targetAmount: suggestedTarget },
            });
          }
        }

        if (suggestions.length === 0) return null;

        return (
          <>
            <div style={{ padding: '0 16px 4px', fontSize: 11, color: 'var(--c-slate-mute)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>
              Suggested for you
            </div>
            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              {suggestions.map(s => (
                <div key={s.type} style={{
                  padding: '14px', borderRadius: 14,
                  background: s.tint + '0D', border: `1.5px dashed ${s.tint}55`,
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{s.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-deep-ink)', marginBottom: 2 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', lineHeight: 1.4, marginBottom: 10 }}>{s.body}</div>
                    <button
                      onClick={() => route.openSheet({ kind: 'add-goal', prefill: { type: s.type, ...(s.prefill || {}) } })}
                      style={{
                        padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                        background: s.tint, color: '#fff', border: 'none',
                      }}>
                      Set up
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {goals.length === 0
        ? (
          <div style={{ padding: '24px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--c-deep-ink)', marginBottom: 8 }}>No goals yet</div>
            <div style={{ fontSize: 13, color: 'var(--c-slate-mute)', marginBottom: 24, lineHeight: 1.6 }}>
              Set a savings target, track debt payoff, or build your emergency fund.
            </div>
            <Button variant="primary" icon="plus" onClick={() => route.openSheet({ kind: 'add-goal' })}>
              Add your first goal
            </Button>
          </div>
        )
        : (
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {goals.filter(g => g.active).map(g => <GoalCard key={g.id} goal={g} />)}
            {goals.filter(g => !g.active).length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, paddingLeft: 4, marginTop: 4 }}>Achieved</div>
                {goals.filter(g => !g.active).map(g => <GoalCard key={g.id} goal={g} />)}
              </>
            )}
          </div>
        )
      }
    </div>
  );
}

function GoalCard({ goal }) {
  const { state, dispatch } = useBappy();
  const route = useRoute();
  const prog  = BappyUtil.goalProgress(goal, state);
  const type  = GOAL_TYPES.find(t => t.value === goal.type) || GOAL_TYPES[0];
  const daysLeft = goal.targetDate ? BappyUtil.daysUntil(goal.targetDate) : null;

  return (
    <Card padding={16} onClick={() => route.openSheet({ kind: 'edit-goal', goalId: goal.id })}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <IconContainer glyph={type.glyph} tint={type.tint} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--c-deep-ink)' }}>{goal.title}</div>
          <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 2 }}>
            {type.label}
            {daysLeft !== null && (
              <span style={{ marginLeft: 6 }}>
                · {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="tnum" style={{ fontSize: 16, fontWeight: 600, color: prog.isAchieved ? 'var(--c-seafoam)' : 'var(--c-deep-ink)' }}>
            {prog.pct.toFixed(0)}%
          </div>
          {prog.onTrack !== null && !prog.isAchieved && (
            <div style={{ fontSize: 10, marginTop: 2, color: prog.onTrack ? 'var(--c-seafoam)' : 'var(--c-coral)', fontWeight: 500 }}>
              {prog.onTrack ? '✓ On track' : '⚠ Behind'}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar with milestone markers */}
      <div style={{ position: 'relative', height: 8, borderRadius: 999, background: 'var(--c-haze-teal)', overflow: 'visible', marginBottom: 6 }}>
        <div style={{
          height: '100%', borderRadius: 999,
          width: prog.pct + '%',
          background: prog.isAchieved
            ? 'linear-gradient(90deg, #03BCA5, #02A8B9)'
            : `linear-gradient(90deg, ${type.tint}cc, ${type.tint})`,
          transition: 'width 0.6s ease',
        }} />
        {[25, 50, 75].map(m => {
          const done = (goal.milestonesDone || []).includes(m) || prog.pct >= m;
          return (
            <div key={m} style={{
              position: 'absolute', top: '50%', left: m + '%',
              transform: 'translate(-50%, -50%)',
              width: 10, height: 10, borderRadius: 999,
              background: done ? type.tint : '#fff',
              border: `2px solid ${done ? type.tint : 'var(--c-haze-teal)'}`,
              zIndex: 1,
            }} />
          );
        })}
      </div>

      {/* Amount / streak labels */}
      {goal.type === 'spending_habit' ? (
        <div>
          {/* Month dots */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
            {BappyUtil.surplusMonths(state, 6).map(m => (
              <div key={m.key} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  height: 6, borderRadius: 999,
                  background: m.surplus === null ? 'var(--c-border)'
                    : m.surplus > 0 ? '#03BCA5'
                    : '#E8566A',
                  opacity: m.isCurrentMonth ? 1 : 0.7,
                }} />
                <div style={{ fontSize: 9, color: 'var(--c-slate-mute)', marginTop: 3 }}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: prog.current > 0 ? '#03BCA5' : 'var(--c-slate-mute)', fontWeight: 500 }}>
              {prog.current === 0 ? 'No current streak' : `${prog.current} month${prog.current !== 1 ? 's' : ''} ✓`}
            </span>
            <span style={{ color: 'var(--c-slate-mute)' }}>target: {prog.target} months</span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span className="tnum" style={{ color: 'var(--c-ocean-teal)', fontWeight: 500 }}>
            {BappyUtil.fmtGBPCompact(prog.current)}
          </span>
          <span className="tnum" style={{ color: 'var(--c-slate-mute)' }}>
            of {BappyUtil.fmtGBPCompact(prog.target)}
          </span>
        </div>
      )}
    </Card>
  );
}

function AddGoalSheet() {
  const { state, dispatch } = useBappy();
  const route = useRoute();
  const prefill = route.sheet?.prefill || {};

  const [type,      setType]      = React.useState(prefill.type || 'savings');
  const [title,     setTitle]     = React.useState('');
  const [targetAmt, setTargetAmt] = React.useState(prefill.targetAmount ? String(prefill.targetAmount) : '');
  const [targetDate,setTargetDate]= React.useState('');
  const [accountId, setAccountId] = React.useState(
    state.accounts.find(a => a.type === 'savings')?.id || state.accounts[0]?.id || ''
  );

  const typeInfo = GOAL_TYPES.find(t => t.value === type);

  const savingsAccounts = state.accounts.filter(a => a.type === 'savings');
  const debtAccounts    = state.accounts.filter(a => a.type === 'credit_card' || a.type === 'loan');
  const linkedAccounts  = type === 'debt_payoff' ? debtAccounts
    : (type === 'savings' || type === 'emergency_fund') ? (savingsAccounts.length ? savingsAccounts : state.accounts)
    : [];

  const selectedAccount = state.accounts.find(a => a.id === accountId);
  const isHabit     = type === 'spending_habit';
  const needsAccount = type !== 'net_worth' && !isHabit;
  const needsTarget  = type !== 'emergency_fund' && !isHabit;

  const [targetMonths, setTargetMonths] = React.useState('3');

  const canSave = title.trim().length > 0 &&
    (!needsTarget || parseFloat(targetAmt) > 0) &&
    (!needsAccount || accountId) &&
    (!isHabit || parseInt(targetMonths, 10) > 0);

  const handleSave = () => {
    if (!canSave) return;
    const linkedAcc = state.accounts.find(a => a.id === accountId);
    const baselineAmount = type === 'debt_payoff'
      ? Math.abs(Math.min(0, linkedAcc?.balance || 0))
      : type === 'net_worth'
        ? Math.max(0, state.accounts.reduce((s, a) => s + a.balance, 0))
        : Math.max(0, linkedAcc?.balance || 0);

    dispatch({
      type: 'ADD_GOAL',
      goal: {
        type,
        title: title.trim(),
        targetAmount:  isHabit ? null : (parseFloat(targetAmt) || null),
        targetMonths:  isHabit ? (parseInt(targetMonths, 10) || 3) : null,
        targetDate: targetDate || null,
        linkedAccountId: needsAccount ? accountId : null,
        baselineAmount,
        milestonesDone: [],
        active: true,
        createdAt: BappyUtil.today().toISOString().slice(0, 10),
        achievedAt: null,
      },
    });
    route.closeSheet();
  };

  const fieldStyle = { border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--c-ocean-teal)', fontWeight: 500, textAlign: 'right', padding: 0, width: '100%' };
  const selectStyle = { border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--c-ocean-teal)', fontWeight: 500, textAlign: 'right', appearance: 'none', WebkitAppearance: 'none', padding: '0 4px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Type picker */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {GOAL_TYPES.map(gt => (
          <button
            key={gt.value}
            onClick={() => {
              setType(gt.value);
              const acc = gt.value === 'debt_payoff'
                ? state.accounts.find(a => a.type === 'credit_card' || a.type === 'loan')
                : state.accounts.find(a => a.type === 'savings');
              if (acc) setAccountId(acc.id);
            }}
            style={{
              padding: '12px 10px', borderRadius: 12, textAlign: 'left',
              border: `2px solid ${type === gt.value ? gt.tint : 'var(--c-border)'}`,
              background: type === gt.value ? gt.tint + '11' : '#fff',
            }}
          >
            <IconContainer glyph={gt.glyph} tint={gt.tint} size={28} style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-deep-ink)' }}>{gt.label}</div>
            <div style={{ fontSize: 10, color: 'var(--c-slate-mute)', marginTop: 2, lineHeight: 1.3 }}>{gt.desc}</div>
          </button>
        ))}
      </div>

      <Card padding={0}>
        {/* Title */}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
          <span style={{ fontSize: 14, color: 'var(--c-slate)', flexShrink: 0, marginRight: 12 }}>Name</span>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder={typeInfo?.label + ' goal'}
            style={fieldStyle} />
        </div>

        {/* Target amount */}
        {needsTarget && (
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
            <span style={{ fontSize: 14, color: 'var(--c-slate)', flexShrink: 0 }}>Target</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 14, color: 'var(--c-slate-mute)' }}>£</span>
              <input type="number" inputMode="decimal" value={targetAmt} onChange={e => setTargetAmt(e.target.value)}
                placeholder="0" style={{ ...fieldStyle, width: 110 }} />
            </div>
          </div>
        )}

        {/* Linked account */}
        {needsAccount && linkedAccounts.length > 0 && (
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
            <span style={{ fontSize: 14, color: 'var(--c-slate)', flexShrink: 0 }}>Account</span>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} style={selectStyle}>
              {linkedAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}

        {/* Target date */}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, color: 'var(--c-slate)', flexShrink: 0 }}>Target date <span style={{ color: 'var(--c-slate-mute)', fontWeight: 400 }}>(optional)</span></span>
          <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
            style={{ ...fieldStyle, width: 'auto' }} />
        </div>
      </Card>

      {type === 'emergency_fund' && (
        <Card padding={12} style={{ background: 'rgba(2,168,185,0.06)', border: '1px solid var(--c-haze-teal)' }}>
          <div style={{ fontSize: 13, color: 'var(--c-slate)', lineHeight: 1.5 }}>
            Target is auto-calculated as <strong>3× your average monthly expenses</strong> from the last 90 days. Updates live as your spending changes.
          </div>
        </Card>
      )}

      {isHabit && (
        <>
          <Card padding={0}>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
              <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Target months</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {[2, 3, 6, 12].map(n => (
                  <button key={n} onClick={() => setTargetMonths(String(n))} style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                    background: targetMonths === String(n) ? 'var(--c-ocean-teal)' : 'var(--c-ice-wash)',
                    color: targetMonths === String(n) ? '#fff' : 'var(--c-slate)',
                    border: 'none',
                  }}>{n}mo</button>
                ))}
              </div>
            </div>
            <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--c-slate-mute)', lineHeight: 1.5 }}>
              Track the current streak of consecutive months where your income exceeds your spending.
            </div>
          </Card>
        </>
      )}

      <Button variant="primary" full size="lg" onClick={handleSave} disabled={!canSave}>
        Add goal
      </Button>
    </div>
  );
}

function EditGoalSheet({ goalId }) {
  const { state, dispatch } = useBappy();
  const route = useRoute();
  const goal = (state.goals || []).find(g => g.id === goalId);
  if (!goal) return <div style={{ padding: 24, color: 'var(--c-slate-mute)' }}>Goal not found.</div>;

  const prog = BappyUtil.goalProgress(goal, state);
  const type = GOAL_TYPES.find(t => t.value === goal.type) || GOAL_TYPES[0];

  const [title,      setTitle]      = React.useState(goal.title);
  const [targetAmt,  setTargetAmt]  = React.useState(goal.targetAmount ? String(goal.targetAmount) : '');
  const [targetDate, setTargetDate] = React.useState(goal.targetDate || '');

  const handleSave = () => {
    dispatch({
      type: 'UPDATE_GOAL', id: goalId,
      patch: {
        title: title.trim() || goal.title,
        targetAmount: parseFloat(targetAmt) || goal.targetAmount,
        targetDate: targetDate || null,
        ...(prog.isAchieved && !goal.achievedAt ? { achievedAt: BappyUtil.today().toISOString().slice(0, 10), active: false } : {}),
      },
    });
    route.closeSheet();
  };

  const handleDelete = () => {
    if (confirm(`Delete "${goal.title}"?`)) {
      dispatch({ type: 'DELETE_GOAL', id: goalId });
      route.closeSheet();
    }
  };

  const fieldStyle = { border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--c-ocean-teal)', fontWeight: 500, textAlign: 'right', padding: 0, width: '100%' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Progress summary */}
      <Card dark padding={16} style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <IconContainer glyph={type.glyph} tint={type.tint} size={36} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{goal.title}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{type.label}</div>
          </div>
          <div className="tnum" style={{ marginLeft: 'auto', fontSize: 28, fontWeight: 300, color: prog.isAchieved ? '#03BCA5' : '#fff' }}>
            {prog.pct.toFixed(0)}%
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: prog.pct + '%', borderRadius: 999, background: type.tint, transition: 'width 0.6s' }} />
        </div>
        <div className="tnum" style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
          {BappyUtil.fmtGBP(prog.current)} of {BappyUtil.fmtGBP(prog.target)}
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
          <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Name</span>
          <input value={title} onChange={e => setTitle(e.target.value)} style={fieldStyle} />
        </div>
        {goal.type !== 'emergency_fund' && (
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
            <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Target</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <span style={{ fontSize: 14, color: 'var(--c-slate-mute)' }}>£</span>
              <input type="number" inputMode="decimal" value={targetAmt} onChange={e => setTargetAmt(e.target.value)} style={{ ...fieldStyle, width: 110 }} />
            </div>
          </div>
        )}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Target date</span>
          <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} style={{ ...fieldStyle, width: 'auto' }} />
        </div>
      </Card>

      <Button variant="primary" full size="lg" onClick={handleSave}>Save changes</Button>
      <button onClick={handleDelete} style={{ padding: '12px', color: 'var(--c-coral)', fontSize: 14, fontWeight: 500, textAlign: 'center', width: '100%' }}>
        Delete goal
      </button>
    </div>
  );
}

// ─── Edit Recurring sheet ────────────────────────────────────
function EditRecurringSheet({ recurringId }) {
  const { state, dispatch } = useBappy();
  const route = useRoute();
  const rec = state.recurring.find(r => r.id === recurringId);
  if (!rec) return <div style={{ padding: 24, color: 'var(--c-slate-mute)' }}>Template not found.</div>;

  const [payee,       setPayee]       = React.useState(rec.payee || '');
  const [amount,      setAmount]      = React.useState(String(rec.amount || ''));
  const [direction,   setDirection]   = React.useState(rec.direction || 'expense');
  const [frequency,   setFrequency]   = React.useState(rec.frequency || 'monthly');
  const [nextDue,     setNextDue]     = React.useState(rec.nextDue || '');
  const [categoryId,  setCategoryId]  = React.useState(rec.categoryId || 'cat-other');
  const [accountId,   setAccountId]   = React.useState(rec.accountId || state.accounts[0]?.id || '');
  const [endDate,     setEndDate]     = React.useState(rec.endDate || '');
  const [maxPayments, setMaxPayments] = React.useState(rec.maxPayments ? String(rec.maxPayments) : '');

  const fieldStyle = {
    width: '100%', border: 'none', outline: 'none', background: 'transparent',
    fontSize: 15, color: 'var(--c-ocean-teal)', fontWeight: 500, textAlign: 'right', padding: 0,
  };
  const selectStyle = {
    border: 'none', outline: 'none', background: 'transparent',
    fontSize: 15, color: 'var(--c-ocean-teal)', fontWeight: 500,
    textAlign: 'right', appearance: 'none', WebkitAppearance: 'none', padding: '0 4px',
  };

  const handleSave = () => {
    const amt = parseFloat(amount) || 0;
    if (!payee.trim() || amt <= 0) return;
    dispatch({
      type: 'UPDATE_RECURRING',
      id: recurringId,
      patch: {
        payee: payee.trim(),
        amount: amt,
        direction,
        frequency,
        nextDue,
        categoryId,
        accountId,
        baseline: rec.baseline || amt,
        ...(endDate     ? { endDate }                              : { endDate: null }),
        ...(maxPayments ? { maxPayments: parseInt(maxPayments, 10) } : { maxPayments: null }),
      },
    });
    route.closeSheet();
  };

  const handleDelete = () => {
    if (confirm(`Delete "${rec.payee}"? This cannot be undone.`)) {
      dispatch({ type: 'DELETE_RECURRING', id: recurringId });
      route.closeSheet();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Card padding={0}>
        {/* Payee */}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
          <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Description</span>
          <input value={payee} onChange={e => setPayee(e.target.value)} placeholder="e.g. Netflix" style={{ ...fieldStyle, width: 180 }} />
        </div>
        {/* Amount */}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
          <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Amount</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14, color: 'var(--c-slate-mute)' }}>£</span>
            <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ ...fieldStyle, width: 90 }} />
          </div>
        </div>
        {/* Direction */}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
          <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Direction</span>
          <select value={direction} onChange={e => setDirection(e.target.value)} style={selectStyle}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        {/* Frequency */}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
          <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Frequency</span>
          <select value={frequency} onChange={e => setFrequency(e.target.value)} style={selectStyle}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="annually">Annually</option>
          </select>
        </div>
        {/* Next due */}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
          <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Next due</span>
          <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} style={{ ...fieldStyle, width: 'auto' }} />
        </div>
        {/* Category */}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
          <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Category</span>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={selectStyle}>
            {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {/* Account */}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
          <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Account</span>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} style={selectStyle}>
            {state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {/* End date */}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
          <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>End date</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...fieldStyle, width: 'auto' }} />
        </div>
        {/* Max payments */}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Max payments</span>
          <input type="number" inputMode="numeric" value={maxPayments} onChange={e => setMaxPayments(e.target.value)}
            placeholder="none" style={{ ...fieldStyle, width: 70 }} />
        </div>
      </Card>

      <Button variant="primary" full size="lg" onClick={handleSave} disabled={!payee.trim() || !parseFloat(amount)}>
        Save changes
      </Button>
      <button onClick={handleDelete} style={{ padding: '12px', color: 'var(--c-coral)', fontSize: 14, fontWeight: 500, textAlign: 'center', width: '100%' }}>
        Delete template
      </button>
    </div>
  );
}

export { PlanHomeScreen, BudgetsScreen, BudgetDetailScreen, RecurringScreen, SuggestionsScreen, EditRecurringSheet, GoalsScreen, AddGoalSheet, EditGoalSheet };
