import React from 'react'
import { BAPPY_SEED, BappyUtil, useBappy, BappyContext, BappyAuthContext, BappyProvider, useBappyAuth, BappyAuthProvider } from './bappy-state.jsx'
import { Icon, BappyLogo, ICON_PATHS } from './bappy-icons.jsx'
import { IconContainer, Card, Tag, ProgressBar, Button, Sheet, SectionHeader, ListRow, SeverityDot, ChannelPill, EmptyState, Toggle, Segmented, Stepper, tintBg } from './bappy-primitives.jsx'
import { chartPalette, Sparkline, AreaChart, Donut, BarChart, StackedDebtChart, DebtCurve, useContainerWidth } from './bappy-charts.jsx'
import { BappyRouter, BappyRouteContext, useRoute, ScreenHeader, TabBar, FAB } from './bappy-nav.jsx'
// Bappy — Insights tab: index, cash flow forecast, debt simulators

function InsightsHomeScreen() {
  const { state } = useBappy();
  const route = useRoute();

  const cash = BappyUtil.projectCashFlow(state, 30);
  const cashMin = cash.length ? Math.min(...cash.map(c => c.balance)) : 0;
  const cashEnd = cash.length ? cash[cash.length - 1].balance : 0;

  // Donut: expenses by type (this month)
  const monthStart = new Date(BappyUtil.today());
  monthStart.setUTCDate(1);
  const byType = {};
  state.transactions.forEach(t => {
    if (t.direction !== 'expense' || new Date(t.date) < monthStart) return;
    byType[t.type] = (byType[t.type] || 0) + t.amount;
  });
  const typeColors = {
    direct_debit:  '#02A8B9', cc_repayment: '#F4A535', loan_repayment: '#9C6ADE',
    standing_order:'#1F2C2C', subscription: '#03BCA5', one_off: '#A8D2D6',
    salary: '#03BCA5',
  };
  const donutSegments = Object.entries(byType).map(([k, v]) => ({
    label: k.replace(/_/g, ' '), value: v, color: typeColors[k] || '#7A8181',
  })).sort((a, b) => b.value - a.value);
  const monthTotal = donutSegments.reduce((s, x) => s + x.value, 0);

  // Debt total
  const totalDebt = Math.abs(state.accounts.filter(a => a.type === 'credit_card' || a.type === 'loan').reduce((s, a) => s + a.balance, 0));

  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader title="Insights" subtitle="Reports & forecasts" />

      {/* Tiles */}
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <InsightTile
          title="Cash flow"
          subtitle="next 90 days"
          onClick={() => route.push('forecast')}
          right={<Tag variant={cashMin < state.settings.lowBalanceFloor ? 'danger' : 'income'} size="sm">
            {cashMin < state.settings.lowBalanceFloor ? '1 alert' : 'clear'}
          </Tag>}
          big={BappyUtil.fmtGBPCompact(cashEnd)}
          metric={
            <Sparkline values={cash.map(c => c.balance)} width={140} height={30} />
          }
        />
        <InsightTile
          title="Debt-free"
          subtitle="all strategies"
          onClick={() => route.push('debt-all')}
          big={BappyUtil.fmtGBPCompact(totalDebt)}
          right={<Tag variant="warning" size="sm">3 debts</Tag>}
          metric={<div style={{ fontSize: 12, color: 'var(--c-slate-mute)' }}>Avalanche fastest</div>}
        />
        <InsightTile
          title="Available"
          subtitle="until pay day"
          onClick={() => route.push('available')}
          big={BappyUtil.fmtGBPCompact(BappyUtil.availableToSpend(state))}
          metric={<div style={{ fontSize: 11, color: 'var(--c-slate-mute)' }}>{BappyUtil.daysUntil(BappyUtil.nextPayday(state.settings).toISOString().slice(0, 10))} days left</div>}
        />
        <InsightTile
          title="Upcoming"
          subtitle="next 7 days"
          onClick={() => route.push('upcoming')}
          big={BappyUtil.fmtGBPCompact(BappyUtil.projectRecurring(state.recurring, 7).filter(p => p.direction === 'expense').reduce((s, p) => s + p.amount, 0))}
          metric={<div style={{ fontSize: 11, color: 'var(--c-slate-mute)' }}>{BappyUtil.projectRecurring(state.recurring, 7).length} payments</div>}
        />
      </div>

      <SectionHeader>This month · by type</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Donut
              segments={donutSegments}
              size={140} thickness={20}
              centerLabel={BappyUtil.fmtGBPCompact(monthTotal)}
              centerSub="spent"
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {donutSegments.slice(0, 5).map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--c-deep-ink)', flex: 1, textTransform: 'capitalize' }}>{s.label}</span>
                  <span className="tnum" style={{ fontSize: 12, color: 'var(--c-slate-mute)', fontWeight: 500 }}>
                    {BappyUtil.fmtGBPCompact(s.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <SectionHeader>Other reports</SectionHeader>
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <CompactTile glyph="cart"     title="By category" onClick={() => route.push('by-category')} />
        <CompactTile glyph="card"     title="Summaries"   onClick={() => route.push('summaries')} />
        <CompactTile glyph="acc-bank" title="Net worth"   onClick={() => route.push('net-worth')} />
      </div>
    </div>
  );
}

function InsightTile({ title, subtitle, big, metric, onClick, right }) {
  return (
    <Card padding={14} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.1, color: 'var(--c-slate-mute)', fontWeight: 500 }}>{title}</div>
          <div style={{ fontSize: 10, color: 'var(--c-slate-mute)', marginTop: 1, opacity: 0.7 }}>{subtitle}</div>
        </div>
        {right}
      </div>
      <div className="tnum" style={{ fontSize: 22, fontWeight: 500, color: 'var(--c-deep-ink)', marginTop: 12, letterSpacing: -0.3 }}>{big}</div>
      <div style={{ marginTop: 6 }}>{metric}</div>
    </Card>
  );
}

function CompactTile({ glyph, title, onClick }) {
  return (
    <Card padding={14} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <IconContainer glyph={glyph} tint="#02A8B9" size={32} />
      <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--c-deep-ink)' }}>{title}</div>
      <Icon name="chev-right" size={14} color="var(--c-slate-mute)" />
    </Card>
  );
}

// ─── Cash flow forecast ──────────────────────────────────────
function ForecastScreen() {
  const { state } = useBappy();
  const [horizon, setHorizon] = React.useState(90);
  const [whatIf, setWhatIf] = React.useState(0);

  const baseCash = BappyUtil.projectCashFlow(state, horizon);
  // Apply what-if: extra income at day 7
  const cash = whatIf === 0 ? baseCash : baseCash.map((p, i) => ({ ...p, balance: p.balance + (i >= 7 ? whatIf : 0) }));
  const [cashChartRef, cashChartW] = useContainerWidth(306);
  const minPoint = cash.length ? cash.reduce((a, b) => (b.balance < a.balance ? b : a), cash[0]) : { balance: 0, date: new Date().toISOString().slice(0, 10) };
  const endPoint = cash.length ? cash[cash.length - 1] : { balance: 0, date: new Date().toISOString().slice(0, 10) };

  // Pay cycle table — find paydays in horizon
  const cycles = [];
  let payday = BappyUtil.nextPayday(state.settings);
  while (payday <= new Date(BappyUtil.today().getTime() + horizon * 86400000)) {
    const ps = payday.toISOString().slice(0, 10);
    const nextPay = new Date(payday); nextPay.setUTCMonth(nextPay.getUTCMonth() + 1);
    const cycleEnd = nextPay <= new Date(BappyUtil.today().getTime() + horizon * 86400000) ? nextPay : null;
    const opening = cash.find(c => c.date === ps)?.balance || 0;
    const closing = cycleEnd ? (cash.find(c => c.date === cycleEnd.toISOString().slice(0, 10))?.balance || 0) : endPoint.balance;
    cycles.push({ start: ps, end: cycleEnd?.toISOString().slice(0, 10) || endPoint.date, opening, closing });
    payday = nextPay;
    if (cycles.length > 4) break;
  }

  const liquidityAlerts = [];
  for (let i = 0; i < cash.length; i++) {
    if (cash[i].balance < state.settings.lowBalanceFloor) {
      liquidityAlerts.push(cash[i].date);
      // skip ahead until back above floor
      while (i < cash.length && cash[i].balance < state.settings.lowBalanceFloor) i++;
    }
  }

  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="Cash flow" leading="back" subtitle={`next ${horizon} days · current account`} />

      <div style={{ padding: '0 16px 8px' }}>
        <Card dark padding={18} style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: -40, right: -40, width: 180, height: 180,
            borderRadius: 999, background: 'radial-gradient(circle, rgba(3,188,165,0.22) 0%, rgba(2,168,185,0) 70%)',
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 500 }}>Projected · {horizon}d</div>
                <div className="tnum" style={{ fontSize: 30, color: '#fff', fontWeight: 300, marginTop: 4 }}>
                  {BappyUtil.fmtGBP(endPoint.balance)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 500 }}>Lowest</div>
                <div className="tnum" style={{ fontSize: 18, color: minPoint.balance < state.settings.lowBalanceFloor ? '#FFC6CE' : '#fff', fontWeight: 500, marginTop: 6 }}>
                  {BappyUtil.fmtGBP(minPoint.balance)}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>
                  {BappyUtil.fmtDateShort(minPoint.date)}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16 }} ref={cashChartRef}>
              <AreaChart
                series={cash}
                width={cashChartW} height={140}
                floor={state.settings.lowBalanceFloor}
                color="#03BCA5"
                dark
                markers={liquidityAlerts.map(d => ({ date: d }))}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Horizon */}
      <div style={{ padding: '12px 16px 0' }}>
        <Segmented
          options={[{ value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' }, { value: 180, label: '180d' }]}
          value={horizon}
          onChange={setHorizon}
        />
      </div>

      {/* What-if */}
      <SectionHeader>What-if · extra income</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={14}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, color: 'var(--c-slate)' }}>One-off in 7 days</span>
            <span className="tnum" style={{ fontSize: 18, fontWeight: 500, color: 'var(--c-ocean-teal)' }}>
              {BappyUtil.fmtGBP(whatIf)}
            </span>
          </div>
          <input
            type="range" min={0} max={1500} step={50}
            value={whatIf}
            onChange={e => setWhatIf(+e.target.value)}
            style={sliderStyle}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--c-slate-mute)', marginTop: 2 }}>
            <span>£0</span><span>£1,500</span>
          </div>
        </Card>
      </div>

      {/* Liquidity alerts */}
      {liquidityAlerts.length > 0 && (
        <>
          <SectionHeader>Liquidity alerts</SectionHeader>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {liquidityAlerts.map((d, i) => (
              <Card key={i} padding={12} style={{ borderLeft: '3px solid var(--c-coral)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="warn" size={20} color="var(--c-coral)" />
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--c-deep-ink)', fontWeight: 500 }}>
                      Balance dips below £{state.settings.lowBalanceFloor}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 1 }}>
                      {BappyUtil.fmtDateLong(d)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Pay cycles */}
      <SectionHeader>Pay cycles</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={0}>
          {cycles.map((c, i) => {
            const change = c.closing - c.opening;
            return (
              <div key={i} style={{
                padding: '14px 16px',
                borderBottom: i === cycles.length - 1 ? 'none' : '1px solid var(--c-border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, color: 'var(--c-deep-ink)', fontWeight: 500 }}>
                    {BappyUtil.fmtDateShort(c.start)} → {BappyUtil.fmtDateShort(c.end)}
                  </span>
                  <span className="tnum" style={{ fontSize: 13, color: change >= 0 ? 'var(--c-seafoam)' : 'var(--c-coral)', fontWeight: 500 }}>
                    {change >= 0 ? '+' : ''}{BappyUtil.fmtGBP(change)}
                  </span>
                </div>
                <div className="tnum" style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 4 }}>
                  open {BappyUtil.fmtGBPCompact(c.opening)} → close {BappyUtil.fmtGBPCompact(c.closing)}
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

const sliderStyle = {
  width: '100%', marginTop: 10, accentColor: 'var(--c-ocean-teal)',
};

// ─── Per-debt simulation ─────────────────────────────────────
function DebtPerScreen() {
  const { state } = useBappy();
  const route = useRoute();
  const debts = state.accounts.filter(a => a.type === 'credit_card' || a.type === 'loan');
  const firstDebtId = debts[0]?.id || '';
  const [accountId, setAccountId] = React.useState(route.current.params?.id || firstDebtId);
  const account = state.accounts.find(a => a.id === accountId) || debts[0];

  // No debt accounts — show empty state
  if (!account) {
    return (
      <div style={{ paddingBottom: 140 }}>
        <ScreenHeader title="Payoff sim" leading="back" subtitle="No debts" />
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-slate-mute)', fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div style={{ fontWeight: 500, color: 'var(--c-deep-ink)', marginBottom: 6 }}>No debts yet</div>
          <div>Add a credit card or loan account to see payoff simulations.</div>
        </div>
      </div>
    );
  }

  // Find scheduled repayment from recurring
  const repayRec = state.recurring.find(r => r.accountId === accountId);
  const scheduled = repayRec?.amount || 100;

  const [extra, setExtra] = React.useState(0);
  const [lump, setLump] = React.useState(0);

  const baseline = BappyUtil.simulateDebt(Math.abs(account.balance), account.apr || 7.9, scheduled);
  const withExtra = BappyUtil.simulateDebt(
    Math.max(0, Math.abs(account.balance) - lump), account.apr || 7.9, scheduled + extra
  );
  const [debtChartRef, debtChartW] = useContainerWidth(306);

  const monthsSaved = baseline.payoffMonths - withExtra.payoffMonths;
  const interestSaved = baseline.interestPaid - withExtra.interestPaid;

  const baseDate = new Date(BappyUtil.today());
  baseDate.setUTCMonth(baseDate.getUTCMonth() + baseline.payoffMonths);
  const newDate = new Date(BappyUtil.today());
  newDate.setUTCMonth(newDate.getUTCMonth() + withExtra.payoffMonths);

  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="Payoff sim" leading="back"
        subtitle={account.name} />

      {/* Debt switcher */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6, overflowX: 'auto' }} className="bappy-scroll">
        {debts.map(d => (
          <FilterChip key={d.id} active={d.id === accountId} onClick={() => setAccountId(d.id)}>
            {d.name.split(' ').slice(0, 2).join(' ')}
          </FilterChip>
        ))}
      </div>

      <div style={{ padding: '0 16px 8px' }}>
        <Card dark padding={18} style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', bottom: -40, right: -40, width: 180, height: 180,
            borderRadius: 999, background: 'radial-gradient(circle, rgba(3,188,165,0.22) 0%, rgba(2,168,185,0) 70%)',
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 500 }}>Clear by</div>
                <div className="tnum" style={{ fontSize: 26, color: '#fff', fontWeight: 400, marginTop: 4 }}>
                  {newDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                </div>
                {monthsSaved > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--c-seafoam)', marginTop: 2 }}>
                    {monthsSaved} months sooner
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 500 }}>Interest</div>
                <div className="tnum" style={{ fontSize: 22, color: '#fff', fontWeight: 400, marginTop: 4 }}>
                  {BappyUtil.fmtGBP(withExtra.interestPaid)}
                </div>
                {interestSaved > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--c-seafoam)', marginTop: 2 }}>
                    save {BappyUtil.fmtGBPCompact(interestSaved)}
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 16 }} ref={debtChartRef}>
              <DebtCurve baseline={baseline.curve} withExtra={withExtra.curve} width={debtChartW} height={140} />
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 16, height: 2, background: 'rgba(255,255,255,0.55)', borderRadius: 2,
                  backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.55) 50%, transparent 50%)',
                  backgroundSize: '6px 2px' }} />
                <span style={{ color: 'rgba(255,255,255,0.65)' }}>baseline</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 16, height: 2, background: 'var(--c-seafoam)', borderRadius: 2 }} />
                <span style={{ color: 'rgba(255,255,255,0.85)' }}>with extra</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Inputs */}
      <SectionHeader>What-if controls</SectionHeader>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Card padding={14}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, color: 'var(--c-slate)' }}>Extra per month</span>
            <span className="tnum" style={{ fontSize: 17, fontWeight: 500, color: 'var(--c-ocean-teal)' }}>
              +{BappyUtil.fmtGBP(extra)}
            </span>
          </div>
          <input type="range" min={0} max={400} step={10} value={extra} onChange={e => setExtra(+e.target.value)} style={sliderStyle} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--c-slate-mute)', marginTop: 2 }}>
            <span>£0</span><span>£400</span>
          </div>
        </Card>
        <Card padding={14}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, color: 'var(--c-slate)' }}>One-off lump sum today</span>
            <span className="tnum" style={{ fontSize: 17, fontWeight: 500, color: 'var(--c-ocean-teal)' }}>
              {BappyUtil.fmtGBP(lump)}
            </span>
          </div>
          <input type="range" min={0} max={Math.abs(account.balance)} step={50} value={lump} onChange={e => setLump(+e.target.value)} style={sliderStyle} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--c-slate-mute)', marginTop: 2 }}>
            <span>£0</span><span>{BappyUtil.fmtGBP(Math.abs(account.balance))}</span>
          </div>
        </Card>
      </div>

      {/* Summary */}
      <SectionHeader>Plan summary</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={14}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--c-slate-mute)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>Baseline</div>
              <div className="tnum" style={{ fontSize: 16, fontWeight: 500, color: 'var(--c-slate)', marginTop: 2 }}>{baseline.payoffMonths}mo</div>
              <div className="tnum" style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 1 }}>
                {BappyUtil.fmtGBP(baseline.interestPaid)} interest
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--c-seafoam)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>With extra</div>
              <div className="tnum" style={{ fontSize: 16, fontWeight: 500, color: 'var(--c-deep-ink)', marginTop: 2 }}>{withExtra.payoffMonths}mo</div>
              <div className="tnum" style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 1 }}>
                {BappyUtil.fmtGBP(withExtra.interestPaid)} interest
              </div>
            </div>
          </div>
        </Card>

        <Button variant="secondary" full icon="check" style={{ marginTop: 10 }} onClick={() => route.push('debt-all')}>
          Compare with other debts
        </Button>
      </div>
    </div>
  );
}

// ─── All-debts comparison ────────────────────────────────────
function DebtAllScreen() {
  const { state } = useBappy();
  const route = useRoute();
  const [strategy, setStrategy] = React.useState('avalanche');
  const [extra, setExtra] = React.useState(100);

  const debts = state.accounts.filter(a => a.type === 'credit_card' || a.type === 'loan').map(a => {
    const r = a.id === 'acc-barclaycard' ? 85 : a.id === 'acc-amex' ? 150 : 210;
    return { ...a, scheduled: r };
  });

  // Apply strategy
  const simulate = (strategyName, extra) => {
    // Snowball: smallest balance first; Avalanche: highest APR first; Even: split
    let order = [...debts];
    if (strategyName === 'avalanche') order.sort((a, b) => (b.apr || 0) - (a.apr || 0));
    else if (strategyName === 'snowball') order.sort((a, b) => Math.abs(a.balance) - Math.abs(b.balance));
    else if (strategyName === 'even') order = debts;
    // Custom: keep state-defined order

    // Simulate month-by-month: extra goes to first non-cleared debt in order (or split)
    const balances = order.map(d => Math.abs(d.balance));
    const aprs = order.map(d => (d.apr || 7.9) / 100 / 12);
    const scheduled = order.map(d => d.scheduled);
    const curves = order.map(() => [{ month: 0, balance: 0 }]);
    order.forEach((d, i) => { curves[i][0] = { month: 0, balance: Math.abs(d.balance) }; });

    let m = 0;
    while (balances.some(b => b > 0.01) && m < 240) {
      m++;
      // Apply extra
      let extraRemaining = extra;
      if (strategyName === 'even') {
        const activeIdxs = balances.map((b, i) => b > 0.01 ? i : -1).filter(i => i >= 0);
        const each = extraRemaining / Math.max(1, activeIdxs.length);
        activeIdxs.forEach(i => { balances[i] = Math.max(0, balances[i] - each); });
      } else {
        for (let i = 0; i < balances.length; i++) {
          if (balances[i] <= 0.01) continue;
          balances[i] = Math.max(0, balances[i] - extraRemaining);
          break;
        }
      }
      // Scheduled + interest
      for (let i = 0; i < balances.length; i++) {
        if (balances[i] <= 0.01) { curves[i].push({ month: m, balance: 0 }); continue; }
        const interest = balances[i] * aprs[i];
        balances[i] = Math.max(0, balances[i] + interest - scheduled[i]);
        curves[i].push({ month: m, balance: balances[i] });
      }
    }
    const totalInterest = order.reduce((s, d, i) => {
      const init = Math.abs(d.balance);
      const totalPaid = (scheduled[i] * m) + (strategyName === 'even' ? extra * m / order.length : 0); // approximation
      return s + Math.max(0, totalPaid - init);
    }, 0);
    return { months: m, curves: curves.map((c, i) => ({ name: order[i].name, color: ['#02A8B9', '#F4A535', '#9C6ADE'][i % 3], curve: c })), totalInterest };
  };

  const result = simulate(strategy, extra);
  const [stackChartRef, stackChartW] = useContainerWidth(306);

  const debtFreeDate = new Date(BappyUtil.today());
  debtFreeDate.setUTCMonth(debtFreeDate.getUTCMonth() + result.months);

  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="All debts" leading="back" subtitle="Strategy comparison" />

      <div style={{ padding: '0 16px 8px' }}>
        <Card dark padding={18} style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: -30, right: -30, width: 180, height: 180,
            borderRadius: 999, background: 'radial-gradient(circle, rgba(3,188,165,0.22) 0%, rgba(2,168,185,0) 70%)',
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 500 }}>
              Debt-free with {strategy}
            </div>
            <div className="tnum" style={{ fontSize: 30, color: '#fff', fontWeight: 300, marginTop: 4 }}>
              {debtFreeDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
              {result.months} months · with +£{extra}/mo extra
            </div>
            <div style={{ marginTop: 16 }} ref={stackChartRef}>
              <StackedDebtChart debts={result.curves} width={stackChartW} height={150} monthsCap={result.months + 4} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, flexWrap: 'wrap' }}>
              {result.curves.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>{c.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Strategy */}
      <SectionHeader>Strategy</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Segmented
          options={[
            { value: 'avalanche', label: 'Avalanche' },
            { value: 'snowball', label: 'Snowball' },
            { value: 'even', label: 'Even-split' },
            { value: 'custom', label: 'Custom' },
          ]}
          value={strategy}
          onChange={setStrategy}
        />
        <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 8, lineHeight: 1.5 }}>
          {strategy === 'avalanche' && 'Pay extra on the highest-APR debt first. Cheapest in interest.'}
          {strategy === 'snowball' && 'Pay extra on the smallest balance first. Easiest momentum.'}
          {strategy === 'even' && 'Split extra equally across all debts.'}
          {strategy === 'custom' && 'Drag debts into your preferred priority order.'}
        </div>
      </div>

      {/* Extra slider */}
      <SectionHeader>Extra per month</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={14}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, color: 'var(--c-slate)' }}>Across all debts</span>
            <span className="tnum" style={{ fontSize: 17, fontWeight: 500, color: 'var(--c-ocean-teal)' }}>
              +{BappyUtil.fmtGBP(extra)}
            </span>
          </div>
          <input type="range" min={0} max={500} step={10} value={extra} onChange={e => setExtra(+e.target.value)} style={sliderStyle} />
        </Card>
      </div>

      {/* Strategy comparison */}
      <SectionHeader>Side-by-side</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={0}>
          {['avalanche', 'snowball', 'even'].map((s, i, arr) => {
            const r = simulate(s, extra);
            const isCurrent = s === strategy;
            return (
              <div key={s} onClick={() => setStrategy(s)} style={{
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                background: isCurrent ? 'var(--c-ice-wash)' : 'transparent',
                borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--c-border)',
                cursor: 'pointer',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--c-deep-ink)', fontWeight: 500, textTransform: 'capitalize' }}>
                    {s === 'even' ? 'Even-split' : s}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 1 }}>
                    {r.months} months
                  </div>
                </div>
                <div className="tnum" style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-deep-ink)' }}>
                  {(() => {
                    const d = new Date(BappyUtil.today());
                    d.setUTCMonth(d.getUTCMonth() + r.months);
                    return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                  })()}
                </div>
                {isCurrent && <Icon name="check" size={18} color="var(--c-ocean-teal)" strokeWidth={2.2} />}
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ─── Available to spend ──────────────────────────────────────
function AvailableScreen() {
  const { state } = useBappy();
  const avail = BappyUtil.availableToSpend(state);
  const payday = BappyUtil.nextPayday(state.settings);
  const daysToPay = BappyUtil.daysUntil(payday.toISOString().slice(0, 10));
  const primaryAcct = BappyUtil.primaryAccount(state);
  const current = primaryAcct || state.accounts[0];
  const projected = BappyUtil.projectRecurring(state.recurring, daysToPay)
    .filter(p => current && p.accountId === current.id);

  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader title="Available" leading="back" subtitle="Until next pay day" />
      <div style={{ padding: '0 16px 8px' }}>
        <Card dark padding={20} style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: 999, background: 'radial-gradient(circle, rgba(3,188,165,0.30) 0%, rgba(2,168,185,0) 70%)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 1.2 }}>Available to spend</div>
            <div className="tnum" style={{ fontSize: 44, color: '#fff', fontWeight: 300, marginTop: 4, letterSpacing: -1 }}>
              {BappyUtil.fmtGBP(avail)}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
              {daysToPay} days · pay day {BappyUtil.fmtDateShort(payday)}
            </div>
            <div className="tnum" style={{ fontSize: 13, color: daysToPay > 0 ? 'var(--c-seafoam)' : 'rgba(255,255,255,0.7)', marginTop: 10 }}>
              ≈ {BappyUtil.fmtGBP(daysToPay > 0 ? avail / daysToPay : avail)} per day
            </div>
          </div>
        </Card>
      </div>
      <SectionHeader>How it adds up</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={0}>
          <ListRow last={false} icon={<IconContainer glyph="acc-bank" tint="#02A8B9" />}
            title="Current balance" subtitle={current?.name || 'Primary account'}
            right={<span className="tnum" style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-deep-ink)' }}>{BappyUtil.fmtGBP(current?.balance ?? 0)}</span>}
          />
          {projected.map((p, i) => {
            const cat = state.categories.find(c => c.id === p.categoryId);
            return (
              <ListRow key={i} last={i === projected.length - 1}
                icon={<IconContainer glyph={cat?.glyph || 'dot'} tint={cat?.tint} />}
                title={p.payee} subtitle={BappyUtil.fmtRelativeDate(p.date)}
                right={<span className="tnum" style={{ fontSize: 14, color: 'var(--c-coral)' }}>−{BappyUtil.fmtGBP(p.amount, { abs: true })}</span>}
              />
            );
          })}
        </Card>
        <div style={{ padding: '14px 16px', marginTop: 10, background: 'var(--c-deep-ink)', borderRadius: 12, color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Available</span>
          <span className="tnum" style={{ fontSize: 16, fontWeight: 500, color: 'var(--c-seafoam)' }}>{BappyUtil.fmtGBP(avail)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Upcoming ────────────────────────────────────────────────
function UpcomingScreen() {
  const { state } = useBappy();
  const proj = BappyUtil.projectRecurring(state.recurring, 90);
  const groups = { week: [], month: [], later: [] };
  proj.forEach(p => {
    const d = BappyUtil.daysUntil(p.date);
    if (d <= 7) groups.week.push(p);
    else if (d <= 31) groups.month.push(p);
    else groups.later.push(p);
  });
  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader title="Upcoming" leading="back" subtitle="Scheduled payments" />
      {[
        ['This week', groups.week],
        ['This month', groups.month],
        ['Later', groups.later],
      ].map(([label, items]) => items.length > 0 && (
        <React.Fragment key={label}>
          <SectionHeader>{label}</SectionHeader>
          <div style={{ padding: '0 16px' }}>
            <Card padding={0}>
              {items.map((p, i) => {
                const cat = state.categories.find(c => c.id === p.categoryId);
                const acc = state.accounts.find(a => a.id === p.accountId);
                return (
                  <ListRow key={i} last={i === items.length - 1}
                    icon={<IconContainer glyph={cat?.glyph || 'dot'} tint={p.direction === 'income' ? '#03BCA5' : cat?.tint}
                      variant={p.direction === 'income' ? 'income' : 'default'} />}
                    title={p.payee}
                    subtitle={`${BappyUtil.fmtRelativeDate(p.date)} · ${acc?.name}`}
                    right={<span className="tnum" style={{ fontSize: 14, fontWeight: 500,
                      color: p.direction === 'income' ? 'var(--c-seafoam)' : 'var(--c-deep-ink)' }}>
                      {p.direction === 'income' ? '+' : '−'}{BappyUtil.fmtGBP(p.amount, { abs: true })}
                    </span>}
                  />
                );
              })}
            </Card>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

export { InsightsHomeScreen, ForecastScreen, DebtPerScreen, DebtAllScreen, AvailableScreen, UpcomingScreen };
