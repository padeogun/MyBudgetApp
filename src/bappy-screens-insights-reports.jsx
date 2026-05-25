import React from 'react'
import { BAPPY_SEED, BappyUtil, useBappy, BappyContext, BappyAuthContext, BappyProvider, useBappyAuth, BappyAuthProvider } from './bappy-state.jsx'
import { Icon, BappyLogo, ICON_PATHS } from './bappy-icons.jsx'
import { IconContainer, Card, Tag, ProgressBar, Button, Sheet, SectionHeader, ListRow, SeverityDot, ChannelPill, EmptyState, Toggle, Segmented, Stepper, tintBg } from './bappy-primitives.jsx'
import { chartPalette, Sparkline, AreaChart, Donut, BarChart, StackedDebtChart, DebtCurve } from './bappy-charts.jsx'
import { BappyRouter, BappyRouteContext, useRoute, ScreenHeader, TabBar, FAB } from './bappy-nav.jsx'
// Bappy — Insights "Other reports": By category, Summaries

// ─── By Category ────────────────────────────────────────
function ByCategoryScreen() {
  const { state } = useBappy();
  const [period, setPeriod] = React.useState('thisMonth');
  const [sortBy, setSortBy] = React.useState('amount');
  const [mode, setMode]     = React.useState('expenses'); // 'expenses' | 'income'

  const range = computeRange(period);
  const direction = mode === 'income' ? 'income' : 'expense';

  const txns = state.transactions.filter(t =>
    t.direction === direction &&
    new Date(t.date) >= range.start && new Date(t.date) < range.end
  );

  // Previous period for compare
  const prevStart = new Date(range.start.getTime() - (range.end - range.start));
  const prevTxns = state.transactions.filter(t =>
    t.direction === direction &&
    new Date(t.date) >= prevStart && new Date(t.date) < range.start
  );

  // Build also the other direction total (for the summary bar)
  const incomeTxns  = state.transactions.filter(t => t.direction === 'income'  && new Date(t.date) >= range.start && new Date(t.date) < range.end);
  const expenseTxns = state.transactions.filter(t => t.direction === 'expense' && new Date(t.date) >= range.start && new Date(t.date) < range.end);
  const totalIncome   = incomeTxns.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenseTxns.reduce((s, t) => s + t.amount, 0);

  const excludedCats = mode === 'income' ? new Set(['cat-transfer']) : new Set(['cat-income', 'cat-transfer']);

  const buckets = state.categories
    .filter(c => !excludedCats.has(c.id))
    .map(c => {
      const rows = txns.filter(t => t.categoryId === c.id);
      const prevRows = prevTxns.filter(t => t.categoryId === c.id);
      const amount = rows.reduce((s, t) => s + t.amount, 0);
      const prev = prevRows.reduce((s, t) => s + t.amount, 0);
      return { cat: c, amount, prev, count: rows.length };
    })
    .filter(b => b.amount > 0 || b.count > 0);

  const sorted = [...buckets].sort((a, b) => {
    if (sortBy === 'amount') return b.amount - a.amount;
    if (sortBy === 'count') return b.count - a.count;
    if (sortBy === 'change') return (b.amount - b.prev) - (a.amount - a.prev);
    return 0;
  });

  const total = buckets.reduce((s, b) => s + b.amount, 0);
  const prevTotal = buckets.reduce((s, b) => s + b.prev, 0);
  const totalChange = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
  const maxAmount = Math.max(1, ...buckets.map(b => b.amount));
  const netSaving = totalIncome - totalExpenses;

  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="By category" leading="back" subtitle="Spend breakdown" />

      {/* Period picker */}
      <div style={{ padding: '0 16px 10px' }}>
        <Segmented
          options={[
            { value: 'thisMonth', label: 'This month' },
            { value: 'lastMonth', label: 'Last month' },
            { value: 'last3',     label: '3 months' },
            { value: 'ytd',       label: 'YTD' },
          ]}
          value={period} onChange={setPeriod}
        />
      </div>

      {/* Income / Expenses mode toggle */}
      <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6 }}>
        {[
          { v: 'expenses', label: 'Expenses', color: 'var(--c-coral)',   bg: 'var(--c-coral-tint)' },
          { v: 'income',   label: 'Income',   color: 'var(--c-seafoam)', bg: 'var(--c-seafoam-tint)' },
        ].map(({ v, label, color, bg }) => (
          <button key={v} onClick={() => setMode(v)} style={{
            flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: mode === v ? (v === 'expenses' ? 'var(--c-coral)' : 'var(--c-seafoam)') : bg,
            color: mode === v ? '#fff' : color,
            border: 'none', transition: 'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {/* Hero */}
      <div style={{ padding: '0 16px 8px' }}>
        <Card dark padding={18} style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: 999,
            background: mode === 'income'
              ? 'radial-gradient(circle, rgba(3,188,165,0.30) 0%, rgba(3,188,165,0) 70%)'
              : 'radial-gradient(circle, rgba(232,86,106,0.25) 0%, rgba(2,168,185,0) 70%)',
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 500 }}>
              {mode === 'income' ? 'Total income' : 'Total spend'}
            </div>
            <div className="tnum" style={{ fontSize: 32, color: mode === 'income' ? 'var(--c-seafoam)' : '#fff', fontWeight: 300, marginTop: 4, letterSpacing: -0.6 }}>
              {BappyUtil.fmtGBP(total)}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
              {txns.length} transactions · {buckets.filter(b => b.amount > 0).length} categories
            </div>
            {/* Net saving line */}
            {(totalIncome > 0 || totalExpenses > 0) && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                Net {netSaving >= 0 ? 'saved' : 'overspent'}:{' '}
                <span style={{ color: netSaving >= 0 ? 'var(--c-seafoam)' : '#FFC6CE', fontWeight: 500 }}>
                  {netSaving >= 0 ? '+' : '−'}{BappyUtil.fmtGBP(Math.abs(netSaving))}
                </span>
              </div>
            )}
            {prevTotal > 0 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginTop: 10, padding: '4px 10px',
                background: 'rgba(255,255,255,0.10)', borderRadius: 999,
                fontSize: 12,
                color: mode === 'income'
                  ? (totalChange >= 0 ? 'var(--c-seafoam)' : '#FFC6CE')
                  : (totalChange >= 0 ? '#FFC6CE' : 'var(--c-seafoam)'),
                fontWeight: 500,
              }}>
                <Icon name={totalChange >= 0 ? 'chev-up' : 'chev-down'} size={12} strokeWidth={2.4} />
                {Math.abs(totalChange).toFixed(0)}% vs previous
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Sort */}
      <div style={{
        padding: '12px 16px 8px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{
          fontSize: 13, fontWeight: 500, color: 'var(--c-slate-mute)',
          textTransform: 'uppercase', letterSpacing: 1,
        }}>Breakdown</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            ['amount', 'Amount'],
            ['count',  'Count'],
            ['change', 'Change'],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setSortBy(v)} style={{
              padding: '4px 10px', borderRadius: 999,
              background: sortBy === v ? 'var(--c-ocean-teal)' : 'var(--c-ice-wash)',
              color: sortBy === v ? '#fff' : 'var(--c-slate-mute)',
              fontSize: 11, fontWeight: 500, letterSpacing: 0.1,
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Bars list */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(b => {
          const pct = (b.amount / maxAmount) * 100;
          const totalPct = total > 0 ? (b.amount / total) * 100 : 0;
          const delta = b.amount - b.prev;
          const barColor = mode === 'income' ? 'var(--c-seafoam)' : b.cat.tint;
          return (
            <Card key={b.cat.id} padding={12}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <IconContainer glyph={b.cat.glyph} tint={b.cat.tint} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--c-deep-ink)', fontWeight: 500 }}>{b.cat.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 1 }}>
                    {b.count} {b.count === 1 ? 'transaction' : 'transactions'} · {totalPct.toFixed(0)}% of total
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="tnum" style={{ fontSize: 15, fontWeight: 500, color: 'var(--c-deep-ink)' }}>
                    {BappyUtil.fmtGBP(b.amount)}
                  </div>
                  {b.prev > 0 && (
                    <div className="tnum" style={{
                      fontSize: 11, marginTop: 1,
                      color: mode === 'income'
                        ? (delta >= 0 ? 'var(--c-seafoam)' : 'var(--c-coral)')
                        : (delta >= 0 ? 'var(--c-coral)' : 'var(--c-seafoam)'),
                    }}>
                      {delta >= 0 ? '+' : '−'}{BappyUtil.fmtGBPCompact(Math.abs(delta))}
                    </div>
                  )}
                </div>
              </div>
              {/* Bar */}
              <div style={{ height: 6, borderRadius: 999, background: 'var(--c-ice-wash)', overflow: 'hidden' }}>
                <div style={{
                  width: pct + '%', height: '100%',
                  background: barColor, borderRadius: 999,
                  transition: 'width 0.4s cubic-bezier(.4,1.4,.5,1)',
                }} />
              </div>
            </Card>
          );
        })}
        {sorted.length === 0 && (
          <Card padding={32} style={{ textAlign: 'center' }}>
            <Icon name="spark2" size={28} color="var(--c-slate-mute)" />
            <div style={{ fontSize: 14, color: 'var(--c-slate-mute)', marginTop: 8 }}>
              No {mode === 'income' ? 'income' : 'spend'} in this period.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Summaries ──────────────────────────────────────────
function SummariesScreen() {
  const { state } = useBappy();
  const months = computeMonthSummaries(state, 6);

  // Newest first
  const ordered = [...months].reverse();
  const current = ordered[0];

  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="Summaries" leading="back" subtitle="Month-by-month" />

      {/* Current month hero */}
      <div style={{ padding: '0 16px 8px' }}>
        <Card dark padding={18}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{current.label}</div>
            <Tag variant={current.net >= 0 ? 'income' : 'danger'}>
              {current.net >= 0 ? 'saved' : 'overspent'}
            </Tag>
          </div>
          <div className="tnum" style={{
            fontSize: 36, fontWeight: 300, color: '#fff', marginTop: 6, letterSpacing: -0.6,
          }}>
            {current.net >= 0 ? '+' : '−'}{BappyUtil.fmtGBP(Math.abs(current.net))}
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
            <SummaryStat dark label="Income" value={BappyUtil.fmtGBPCompact(current.income)} tone="income" />
            <SummaryStat dark label="Expenses" value={BappyUtil.fmtGBPCompact(current.expenses)} tone="expense" />
            <SummaryStat dark label="Saved %" value={current.income > 0 ? ((current.net / current.income) * 100).toFixed(0) + '%' : '—'} />
          </div>
        </Card>
      </div>

      {/* Trend chart */}
      <SectionHeader>6-month trend</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={16}>
          <SummaryTrendChart months={months} width={310} height={150} />
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--c-seafoam)' }} />
              <span style={{ color: 'var(--c-slate)' }}>Income</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--c-coral)' }} />
              <span style={{ color: 'var(--c-slate)' }}>Expenses</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 10, height: 2, borderRadius: 2,
                background: 'var(--c-ocean-teal)',
              }} />
              <span style={{ color: 'var(--c-slate)' }}>Net</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Month list */}
      <SectionHeader>All months</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={0}>
          {ordered.map((m, i) => (
            <div key={m.key} style={{
              padding: '14px 16px',
              borderBottom: i === ordered.length - 1 ? 'none' : '1px solid var(--c-border)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: 'var(--c-ice-wash)', color: 'var(--c-ocean-teal)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 500 }}>{m.monthShort}</span>
                <span style={{ fontSize: 10, color: 'var(--c-slate-mute)' }}>{m.year}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--c-deep-ink)', fontWeight: 500 }}>
                  {m.topCategory ? m.topCategory.name : 'No spend'}
                  {m.topCategory && (
                    <span style={{ color: 'var(--c-slate-mute)', fontWeight: 400, fontSize: 12 }}>
                      {' '}· top category
                    </span>
                  )}
                </div>
                <div className="tnum" style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 2 }}>
                  +{BappyUtil.fmtGBPCompact(m.income)} · −{BappyUtil.fmtGBPCompact(m.expenses)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="tnum" style={{
                  fontSize: 15, fontWeight: 500,
                  color: m.net >= 0 ? 'var(--c-seafoam)' : 'var(--c-coral)',
                }}>
                  {m.net >= 0 ? '+' : '−'}{BappyUtil.fmtGBPCompact(Math.abs(m.net))}
                </div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, dark, tone }) {
  const labelColor = dark ? 'rgba(255,255,255,0.6)' : 'var(--c-slate-mute)';
  const valColor = dark ? '#fff' : 'var(--c-deep-ink)';
  return (
    <div>
      <div style={{ fontSize: 10, color: labelColor, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>{label}</div>
      <div className="tnum" style={{ fontSize: 16, fontWeight: 500, color: valColor, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ─── Trend chart (income vs expenses bars + net line) ────────
function SummaryTrendChart({ months, width = 310, height = 150 }) {
  const padL = 28, padR = 8, padT = 12, padB = 22;
  const W = width - padL - padR, H = height - padT - padB;
  const maxVal = Math.max(1, ...months.map(m => Math.max(m.income, m.expenses)));
  const n = months.length;
  const groupW = W / n;
  const barW = (groupW - 4) / 2;
  // Net line
  const minNet = Math.min(0, ...months.map(m => m.net));
  const maxNet = Math.max(0, ...months.map(m => m.net));
  const netRange = (maxNet - minNet) || 1;
  const netPoints = months.map((m, i) => {
    const x = padL + groupW * i + groupW / 2;
    const y = padT + H - ((m.net - minNet) / netRange) * H;
    return { x, y };
  });
  const netPath = netPoints.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

  return (
    <svg width={width} height={height}>
      {/* baseline */}
      <line x1={padL} x2={padL + W} y1={padT + H} y2={padT + H} stroke="var(--c-border)" strokeWidth="1" />
      {months.map((m, i) => {
        const incH = (m.income / maxVal) * H;
        const expH = (m.expenses / maxVal) * H;
        const x = padL + groupW * i + 2;
        return (
          <g key={m.key}>
            <rect x={x} y={padT + H - incH} width={barW} height={incH} fill="#03BCA5" rx="2" />
            <rect x={x + barW + 2} y={padT + H - expH} width={barW} height={expH} fill="#E8566A" rx="2" />
            <text x={x + barW + 1} y={padT + H + 14}
              textAnchor="middle" fontSize="10" fill="var(--c-slate-mute)">
              {m.monthShort}
            </text>
          </g>
        );
      })}
      {/* Net line */}
      <path d={netPath} fill="none" stroke="var(--c-ocean-teal)" strokeWidth="2" strokeLinecap="round" />
      {netPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="var(--c-ocean-teal)" strokeWidth="1.6" />
      ))}
    </svg>
  );
}

// ─── Helpers ────────────────────────────────────────────
function computeRange(period) {
  const t = BappyUtil.today();
  const start = new Date(t), end = new Date(t);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);
  if (period === 'thisMonth') {
    start.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(1);
  } else if (period === 'lastMonth') {
    start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() - 1);
    end.setUTCDate(1);
  } else if (period === 'last3') {
    start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() - 2);
    end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(1);
  } else if (period === 'ytd') {
    start.setUTCMonth(0); start.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(1);
  }
  return { start, end };
}

function computeMonthSummaries(state, count) {
  const t = BappyUtil.today();
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(t); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i);
    const ns = new Date(d); ns.setUTCMonth(ns.getUTCMonth() + 1);
    const rows = state.transactions.filter(x =>
      new Date(x.date) >= d && new Date(x.date) < ns
    );
    const income = rows.filter(x => x.direction === 'income').reduce((s, x) => s + x.amount, 0);
    const expenses = rows.filter(x => x.direction === 'expense').reduce((s, x) => s + x.amount, 0);

    const byCat = {};
    rows.filter(x => x.direction === 'expense').forEach(x => {
      byCat[x.categoryId] = (byCat[x.categoryId] || 0) + x.amount;
    });
    const topCatId = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topCategory = topCatId ? state.categories.find(c => c.id === topCatId) : null;

    months.push({
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      monthShort: d.toLocaleDateString('en-GB', { month: 'short' }),
      year: d.getUTCFullYear(),
      income, expenses, net: income - expenses,
      topCategory,
      count: rows.length,
    });
  }
  return months;
}

// ─── Net Worth ───────────────────────────────────────────
// Reconstructs per-account monthly balance snapshots by reversing transactions
// that occurred after each month's end, working back from the live balance.
function computeNetWorthHistory(state, monthCount = 6) {
  const t = BappyUtil.today()
  const snapshots = []

  for (let i = monthCount - 1; i >= 0; i--) {
    const monthOf = new Date(t)
    monthOf.setUTCDate(1)
    monthOf.setUTCMonth(monthOf.getUTCMonth() - i)

    // cutoff = first day of the month that FOLLOWS the month of interest
    const nextMonth = new Date(monthOf)
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    const cutoff = nextMonth.toISOString().slice(0, 10)

    const accountBalances = state.accounts.map(a => {
      let bal = a.balance
      // For any past month, reverse all transactions that happened on or after cutoff
      if (i > 0) {
        state.transactions.forEach(txn => {
          if (txn.date < cutoff) return
          if (txn.accountId === a.id) {
            if      (txn.direction === 'income')   bal -= txn.amount
            else if (txn.direction === 'expense')  bal += txn.amount
            else if (txn.direction === 'transfer') bal += txn.amount
          }
          // Also reverse the receiving side of a transfer
          if (txn.transferToId === a.id) bal -= txn.amount
        })
      }
      return { ...a, balance: bal }
    })

    const assets      = accountBalances.reduce((s, a) => s + Math.max(0,  a.balance), 0)
    const liabilities = accountBalances.reduce((s, a) => s + Math.max(0, -a.balance), 0)

    snapshots.push({
      key: monthOf.toISOString().slice(0, 7),
      monthShort: monthOf.toLocaleDateString('en-GB', { month: 'short' }),
      year: monthOf.getUTCFullYear(),
      netWorth: assets - liabilities,
      assets,
      liabilities,
      accountBalances,
    })
  }
  return snapshots
}

// ─── Net Worth SVG chart ─────────────────────────────────
// Grouped bar chart (asset bars up, liability bars down) + net worth line overlay
function NetWorthChart({ history, width = 310, height = 180 }) {
  const padL = 40, padR = 8, padT = 16, padB = 24
  const W = width - padL - padR
  const H = height - padT - padB
  const n = history.length
  if (n === 0) return null

  const maxAssets      = Math.max(...history.map(m => m.assets), 1)
  const maxLiabilities = Math.max(...history.map(m => m.liabilities), 0)

  // Unified Y scale: minVal is negative (liabilities extend downward)
  const minVal = -maxLiabilities
  const maxVal = maxAssets
  const range  = maxVal - minVal || 1

  const scaleX = (i) => padL + (i + 0.5) * (W / n)
  const scaleY = (v) => padT + H - ((v - minVal) / range) * H
  const zeroY  = scaleY(0)

  const barW = Math.min((W / n) * 0.38, 16)

  // Net worth polyline
  const nwPts = history.map((m, i) => ({ x: scaleX(i), y: scaleY(m.netWorth) }))
  const nwPath = nwPts.map((p, i) => (i === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)).join(' ')

  const axisColor = '#7A8181'
  const gridColor = '#E0F4F6'

  return (
    <svg width={width} height={height}>
      {/* Horizontal grid lines at max, zero, and min */}
      <line x1={padL} x2={padL + W} y1={padT}  y2={padT}  stroke={gridColor} strokeDasharray="2,4" />
      <line x1={padL} x2={padL + W} y1={zeroY} y2={zeroY} stroke="#CBD5D5" strokeWidth="1" />
      {maxLiabilities > 0 && (
        <line x1={padL} x2={padL + W} y1={padT + H} y2={padT + H} stroke={gridColor} strokeDasharray="2,4" />
      )}

      {/* Y-axis labels */}
      <text x={padL - 4} y={padT + 8} textAnchor="end" fontSize="9.5" fill={axisColor} fontFamily="Roboto Mono">
        {BappyUtil.fmtGBPCompact(maxVal)}
      </text>
      <text x={padL - 4} y={zeroY + 4} textAnchor="end" fontSize="9.5" fill={axisColor} fontFamily="Roboto Mono">£0</text>
      {maxLiabilities > 0 && (
        <text x={padL - 4} y={padT + H} textAnchor="end" fontSize="9.5" fill={axisColor} fontFamily="Roboto Mono">
          {BappyUtil.fmtGBPCompact(minVal)}
        </text>
      )}

      {/* Bars */}
      {history.map((m, i) => {
        const cx    = scaleX(i)
        const aTopY = scaleY(m.assets)
        const aH    = Math.max(0, zeroY - aTopY)
        const lBotY = scaleY(-m.liabilities)
        const lH    = Math.max(0, lBotY - zeroY)
        return (
          <g key={m.key}>
            {m.assets > 0 && (
              <rect x={cx - barW / 2} y={aTopY} width={barW} height={aH}
                fill="#03BCA5" rx="2" opacity="0.85" />
            )}
            {m.liabilities > 0 && (
              <rect x={cx - barW / 2} y={zeroY} width={barW} height={lH}
                fill="#E8566A" rx="2" opacity="0.75" />
            )}
            <text x={cx} y={height - 6} textAnchor="middle" fontSize="10" fill={axisColor} fontFamily="Roboto">
              {m.monthShort}
            </text>
          </g>
        )
      })}

      {/* Net worth line */}
      <path d={nwPath} fill="none" stroke="#02A8B9" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      {nwPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5"
          fill="#fff" stroke="#02A8B9" strokeWidth="2" />
      ))}
    </svg>
  )
}

// ─── Account row for net worth breakdown ─────────────────
const ACCOUNT_TYPE_GLYPHS = {
  current:     'acc-bank',
  checking:    'acc-bank',
  savings:     'acc-savings',
  investment:  'acc-bank',
  pension:     'acc-bank',
  credit_card: 'acc-credit',
  loan:        'acc-loan',
}
const ACCOUNT_TYPE_TINTS = {
  current:     '#02A8B9',
  checking:    '#02A8B9',
  savings:     '#03BCA5',
  investment:  '#9C6ADE',
  pension:     '#F4A535',
  credit_card: '#E8566A',
  loan:        '#B33D4E',
}

function NetWorthScreen() {
  const { state } = useBappy()

  const history = computeNetWorthHistory(state, 6)
  const current = history[history.length - 1]
  const prev    = history[history.length - 2]
  const change  = prev ? current.netWorth - prev.netWorth : 0

  const assetAccounts     = state.accounts.filter(a => a.balance >= 0)
  const liabilityAccounts = state.accounts.filter(a => a.balance < 0)
  const totalAssets       = assetAccounts.reduce((s, a) => s + a.balance, 0)
  const totalLiabilities  = liabilityAccounts.reduce((s, a) => s + Math.abs(a.balance), 0)

  const tint = (type) => ACCOUNT_TYPE_TINTS[type] || '#7A8181'
  const glyph = (type) => ACCOUNT_TYPE_GLYPHS[type] || 'acc-bank'

  if (state.accounts.length === 0) {
    return (
      <div style={{ paddingBottom: 140 }}>
        <ScreenHeader title="Net worth" leading="back" subtitle="Assets & liabilities" />
        <EmptyState glyph="card" title="No accounts yet"
          body="Add accounts in the Money tab to start tracking your net worth." />
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="Net worth" leading="back" subtitle="Assets & liabilities" />

      {/* ── Hero card ─────────────────────────────── */}
      <div style={{ padding: '0 16px 8px' }}>
        <Card dark padding={18} style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: 999,
            background: current.netWorth >= 0
              ? 'radial-gradient(circle, rgba(3,188,165,0.25) 0%, rgba(2,168,185,0) 70%)'
              : 'radial-gradient(circle, rgba(232,86,106,0.25) 0%, rgba(2,168,185,0) 70%)',
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 500 }}>
              Net worth
            </div>
            <div className="tnum" style={{
              fontSize: 38, fontWeight: 300, letterSpacing: -1, marginTop: 4,
              color: current.netWorth >= 0 ? '#fff' : '#FFC6CE',
            }}>
              {BappyUtil.fmtGBP(current.netWorth)}
            </div>

            {/* Month-on-month change badge */}
            {prev && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginTop: 10, padding: '4px 10px',
                background: 'rgba(255,255,255,0.10)', borderRadius: 999,
                fontSize: 12, fontWeight: 500,
                color: change >= 0 ? 'var(--c-seafoam)' : '#FFC6CE',
              }}>
                <Icon name={change >= 0 ? 'chev-up' : 'chev-down'} size={12} strokeWidth={2.4} />
                {change >= 0 ? '+' : '−'}{BappyUtil.fmtGBPCompact(Math.abs(change))} vs last month
              </div>
            )}

            {/* Assets / Liabilities summary */}
            <div style={{ display: 'flex', gap: 28, marginTop: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>Assets</div>
                <div className="tnum" style={{ fontSize: 17, color: 'var(--c-seafoam)', fontWeight: 500, marginTop: 3 }}>
                  +{BappyUtil.fmtGBPCompact(totalAssets)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>Liabilities</div>
                <div className="tnum" style={{ fontSize: 17, color: '#FFC6CE', fontWeight: 500, marginTop: 3 }}>
                  −{BappyUtil.fmtGBPCompact(totalLiabilities)}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── 6-month chart ─────────────────────────── */}
      <SectionHeader>6-month history</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={16}>
          <NetWorthChart history={history} width={310} height={180} />
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11 }}>
            {[
              { color: '#03BCA5', label: 'Assets',      shape: 'square' },
              { color: '#E8566A', label: 'Liabilities', shape: 'square' },
              { color: '#02A8B9', label: 'Net worth',   shape: 'line' },
            ].map(({ color, label, shape }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {shape === 'square'
                  ? <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                  : <span style={{ width: 16, height: 2, borderRadius: 2, background: color }} />
                }
                <span style={{ color: 'var(--c-slate)' }}>{label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Assets breakdown ──────────────────────── */}
      {assetAccounts.length > 0 && (
        <>
          <SectionHeader>Assets · {BappyUtil.fmtGBPCompact(totalAssets)}</SectionHeader>
          <div style={{ padding: '0 16px' }}>
            <Card padding={0}>
              {assetAccounts.map((a, i) => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  borderBottom: i === assetAccounts.length - 1 ? 'none' : '1px solid var(--c-border)',
                }}>
                  <IconContainer glyph={glyph(a.type)} tint={tint(a.type)} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: 'var(--c-deep-ink)', fontWeight: 400 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 1, textTransform: 'capitalize' }}>
                      {(a.type || 'account').replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="tnum" style={{ fontSize: 15, fontWeight: 500, color: 'var(--c-seafoam)' }}>
                      +{BappyUtil.fmtGBP(a.balance)}
                    </div>
                    {totalAssets > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--c-slate-mute)', marginTop: 1 }}>
                        {((a.balance / totalAssets) * 100).toFixed(0)}% of assets
                      </div>
                    )}
                  </div>
                  {/* Share bar */}
                  <div style={{ width: 48, height: 5, borderRadius: 999, background: 'var(--c-ice-wash)', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{
                      width: totalAssets > 0 ? `${(a.balance / totalAssets) * 100}%` : '0%',
                      height: '100%', borderRadius: 999, background: tint(a.type),
                    }} />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}

      {/* ── Liabilities breakdown ─────────────────── */}
      {liabilityAccounts.length > 0 && (
        <>
          <SectionHeader>Liabilities · {BappyUtil.fmtGBPCompact(totalLiabilities)}</SectionHeader>
          <div style={{ padding: '0 16px' }}>
            <Card padding={0}>
              {liabilityAccounts.map((a, i) => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  borderBottom: i === liabilityAccounts.length - 1 ? 'none' : '1px solid var(--c-border)',
                }}>
                  <IconContainer glyph={glyph(a.type)} tint={tint(a.type)} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: 'var(--c-deep-ink)', fontWeight: 400 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 1, textTransform: 'capitalize' }}>
                      {(a.type || 'account').replace(/_/g, ' ')}{a.apr ? ` · ${a.apr}% APR` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="tnum" style={{ fontSize: 15, fontWeight: 500, color: 'var(--c-coral)' }}>
                      −{BappyUtil.fmtGBP(Math.abs(a.balance))}
                    </div>
                    {totalLiabilities > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--c-slate-mute)', marginTop: 1 }}>
                        {((Math.abs(a.balance) / totalLiabilities) * 100).toFixed(0)}% of liabilities
                      </div>
                    )}
                  </div>
                  {/* Share bar */}
                  <div style={{ width: 48, height: 5, borderRadius: 999, background: 'var(--c-ice-wash)', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{
                      width: totalLiabilities > 0 ? `${(Math.abs(a.balance) / totalLiabilities) * 100}%` : '0%',
                      height: '100%', borderRadius: 999, background: tint(a.type),
                    }} />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}

      {/* ── Ratio bar ─────────────────────────────── */}
      {(totalAssets > 0 || totalLiabilities > 0) && (
        <>
          <SectionHeader>Asset-to-debt ratio</SectionHeader>
          <div style={{ padding: '0 16px' }}>
            <Card padding={14}>
              <div style={{ display: 'flex', gap: 3, height: 14, borderRadius: 999, overflow: 'hidden' }}>
                {totalAssets > 0 && (
                  <div style={{
                    flex: totalAssets,
                    background: 'linear-gradient(90deg, #03BCA5, #02A8B9)',
                    borderRadius: totalLiabilities === 0 ? 999 : '999px 0 0 999px',
                  }} />
                )}
                {totalLiabilities > 0 && (
                  <div style={{
                    flex: totalLiabilities,
                    background: '#E8566A',
                    borderRadius: totalAssets === 0 ? 999 : '0 999px 999px 0',
                  }} />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--c-slate-mute)' }}>
                <span className="tnum" style={{ color: 'var(--c-seafoam)', fontWeight: 500 }}>
                  +{BappyUtil.fmtGBPCompact(totalAssets)} assets
                </span>
                {totalLiabilities > 0 && (
                  <span className="tnum" style={{ color: 'var(--c-coral)', fontWeight: 500 }}>
                    −{BappyUtil.fmtGBPCompact(totalLiabilities)} liabilities
                  </span>
                )}
              </div>
              {totalAssets > 0 && totalLiabilities > 0 && (
                <div style={{ fontSize: 12, color: 'var(--c-slate)', marginTop: 8, lineHeight: 1.5 }}>
                  Debt-to-asset ratio: <strong>{((totalLiabilities / totalAssets) * 100).toFixed(0)}%</strong>
                  {totalLiabilities / totalAssets < 0.3 && ' · Healthy'}
                  {totalLiabilities / totalAssets >= 0.3 && totalLiabilities / totalAssets < 0.6 && ' · Moderate'}
                  {totalLiabilities / totalAssets >= 0.6 && ' · High — focus on debt reduction'}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

export { ByCategoryScreen, SummariesScreen, NetWorthScreen };
