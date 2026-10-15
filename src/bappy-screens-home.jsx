import React from 'react'
import { BAPPY_SEED, BappyUtil, useBappy, BappyContext, BappyAuthContext, BappyProvider, useBappyAuth, BappyAuthProvider } from './bappy-state.jsx'
import { Icon, BappyLogo, ICON_PATHS } from './bappy-icons.jsx'
import { IconContainer, Card, Tag, ProgressBar, Button, Sheet, SectionHeader, ListRow, SeverityDot, ChannelPill, EmptyState, Toggle, Segmented, Stepper, tintBg } from './bappy-primitives.jsx'
import { chartPalette, Sparkline, AreaChart, Donut, BarChart, StackedDebtChart, DebtCurve, useContainerWidth } from './bappy-charts.jsx'
import { BappyRouter, BappyRouteContext, useRoute, ScreenHeader, TabBar, FAB } from './bappy-nav.jsx'
// Bappy — Home tab (Dashboard) + Nudge inbox + detail

// ─── Dashboard ───────────────────────────────────────────────
function HomeScreen() {
  const { state } = useBappy();
  const { user } = useBappyAuth();
  const route = useRoute();

  // Empty state — no accounts added yet
  if (state.accounts.length === 0) return <HomeEmpty />;

  const avail = BappyUtil.availableToSpend(state);
  const payDay = BappyUtil.nextPayday(state.settings);
  const daysToPay = BappyUtil.daysUntil(payDay.toISOString().slice(0, 10));

  const primaryAcct = BappyUtil.primaryAccount(state);
  const netPosition = state.accounts.reduce((s, a) => s + a.balance, 0);
  const totalDebt = Math.abs(state.accounts
    .filter(a => a.type === 'credit_card' || a.type === 'loan')
    .reduce((s, a) => s + a.balance, 0));

  const projected = BappyUtil.projectRecurring(state.recurring, 7);
  const upcoming = projected.slice(0, 4);

  const recentTxns = [...state.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  const recentNudges = state.nudges
    .filter(n => n.status === 'new' || n.status === 'seen')
    .slice(0, 3);

  const cashFlow = BappyUtil.projectCashFlow(state, 60);
  const cashFlowMin = cashFlow.length ? Math.min(...cashFlow.map(c => c.balance)) : 0;
  const cashFlowEnd = cashFlow.length ? cashFlow[cashFlow.length - 1].balance : 0;
  const [cashChartRef, cashChartW] = useContainerWidth(306);

  const debtAccts = state.accounts.filter(a => a.type === 'credit_card' || a.type === 'loan');
  const longestPayoff = debtAccts.length
    ? Math.max(0, ...debtAccts.map(a => {
        const r = BappyUtil.simulateDebt(Math.abs(a.balance), a.apr || 7.9, Math.max(a.monthly || 25, 25));
        return Number.isFinite(r.payoffMonths) ? r.payoffMonths : 0;
      }))
    : 0;
  const debtFreeDate = new Date(BappyUtil.today());
  debtFreeDate.setUTCMonth(debtFreeDate.getUTCMonth() + longestPayoff);

  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader
        title={(() => {
          const h = BappyUtil.today().getHours();
          const greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
          const firstName = user?.name?.split(' ')[0];
          return firstName ? `${greeting}, ${firstName}` : greeting;
        })()}
        subtitle={BappyUtil.fmtDateLong(BappyUtil.today())}
      />

      {/* Hero — Available to spend */}
      <div style={{ padding: '4px 16px 0' }}>
        <Card dark padding={20} style={{ position: 'relative', overflow: 'hidden' }}>
          {/* decorative glow */}
          <div style={{
            position: 'absolute', top: -40, right: -40, width: 200, height: 200,
            borderRadius: 999,
            background: 'radial-gradient(circle, rgba(3,188,165,0.30) 0%, rgba(2,168,185,0.0) 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{
              fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase',
              letterSpacing: 1.4, fontWeight: 500,
            }}>Available to spend</div>
            <div className="tnum" style={{
              fontSize: 40, fontWeight: 300, color: '#fff', lineHeight: 1.1,
              marginTop: 4, letterSpacing: -0.8,
            }}>{BappyUtil.fmtGBP(avail)}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
              <span style={{ color: 'var(--c-seafoam)' }}>●</span>{' '}
              until pay day · {BappyUtil.fmtDateShort(payDay)} <span style={{ color: 'rgba(255,255,255,0.5)' }}>({daysToPay}d)</span>
            </div>

            <div style={{
              marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.10)',
              display: 'flex', gap: 8, justifyContent: 'space-between',
            }}>
              <MiniStat label="Committed" value={BappyUtil.fmtGBPCompact((primaryAcct?.balance ?? 0) - avail)} tone="alert" dark />
              <MiniStat label="Daily safe" value={BappyUtil.fmtGBPCompact(daysToPay > 0 ? avail / daysToPay : avail)} dark />
              <MiniStat label="Floor" value={BappyUtil.fmtGBPCompact(state.settings.lowBalanceFloor)} dark />
            </div>
          </div>
        </Card>
      </div>

      {/* Net position + Debt clear */}
      <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Card padding={14} onClick={() => route.gotoTab('accounts')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--c-slate-mute)', fontWeight: 500 }}>Net position</div>
            <Icon name="chev-right" size={14} color="var(--c-slate-mute)" />
          </div>
          <div className="tnum" style={{ fontSize: 22, fontWeight: 500, color: 'var(--c-deep-ink)', marginTop: 6 }}>
            {BappyUtil.fmtGBPCompact(netPosition)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 2 }}>
            across {state.accounts.length} accounts
          </div>
        </Card>
        <Card padding={14} onClick={() => route.push('debt-all')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--c-slate-mute)', fontWeight: 500 }}>Debt-free by</div>
            <Icon name="chev-right" size={14} color="var(--c-slate-mute)" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--c-deep-ink)', marginTop: 6 }}>
            {debtFreeDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
          </div>
          <div className="tnum" style={{ fontSize: 11, color: 'var(--c-coral)', marginTop: 2 }}>
            {BappyUtil.fmtGBPCompact(totalDebt)} owed
          </div>
        </Card>
      </div>

      {/* Cash flow preview */}
      <SectionHeader right={<button onClick={() => route.push('forecast')} style={{ fontSize: 12, color: 'var(--c-ocean-teal)', fontWeight: 500 }}>Open</button>}>
        Cash flow · next 60 days
      </SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={14} onClick={() => route.push('forecast')}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
            <div className="tnum" style={{ fontSize: 17, fontWeight: 500, color: 'var(--c-deep-ink)' }}>
              {BappyUtil.fmtGBP(cashFlowEnd)}
            </div>
            <Tag variant={cashFlowMin < state.settings.lowBalanceFloor ? 'danger' : 'income'}>
              {cashFlowMin < state.settings.lowBalanceFloor ? '1 liquidity alert' : 'all clear'}
            </Tag>
          </div>
          <div ref={cashChartRef}>
            <AreaChart
              series={cashFlow}
              width={cashChartW}
              height={140}
              floor={state.settings.lowBalanceFloor}
              markers={[{ date: cashFlow.find(c => c.balance === cashFlowMin)?.date }]}
            />
          </div>
        </Card>
      </div>

      {/* Upcoming next 7 days */}
      <SectionHeader right={<button onClick={() => route.push('upcoming')} style={{ fontSize: 12, color: 'var(--c-ocean-teal)', fontWeight: 500 }}>All</button>}>
        Coming up · next 7 days
      </SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={0}>
          {upcoming.length === 0 ? (
            <EmptyState glyph="check" title="Nothing scheduled" body="Quiet week ahead." />
          ) : upcoming.map((u, i) => {
            const acc = state.accounts.find(a => a.id === u.accountId);
            const cat = state.categories.find(c => c.id === u.categoryId);
            return (
              <ListRow
                key={i}
                last={i === upcoming.length - 1}
                icon={<IconContainer glyph={cat?.glyph || 'dot'} tint={cat?.tint} />}
                title={u.payee}
                subtitle={`${BappyUtil.fmtRelativeDate(u.date)} · ${acc?.name}`}
                right={
                  <div className="tnum" style={{
                    fontSize: 15, fontWeight: 500,
                    color: u.direction === 'income' ? 'var(--c-seafoam)' : 'var(--c-deep-ink)',
                  }}>
                    {u.direction === 'income' ? '+' : '−'}{BappyUtil.fmtGBP(u.amount, { abs: true })}
                  </div>
                }
              />
            );
          })}
        </Card>
      </div>

      {/* Nudges */}
      <SectionHeader right={<button onClick={() => route.push('nudges')} style={{ fontSize: 12, color: 'var(--c-ocean-teal)', fontWeight: 500 }}>Inbox</button>}>
        Nudges
      </SectionHeader>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recentNudges.map(n => <NudgeRow key={n.id} nudge={n} />)}
      </div>

      {/* Goals teaser */}
      {(state.goals || []).filter(g => g.active).length > 0 && (
        <>
          <SectionHeader right={<button onClick={() => route.push('goals')} style={{ fontSize: 12, color: 'var(--c-ocean-teal)', fontWeight: 500 }}>All goals</button>}>
            Goals
          </SectionHeader>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(state.goals || []).filter(g => g.active).slice(0, 2).map(g => {
              const GOAL_GLYPHS = { savings: 'star', debt_payoff: 'shield', net_worth: 'spark', emergency_fund: 'acc-savings' };
              const GOAL_TINTS  = { savings: '#F4A535', debt_payoff: '#03BCA5', net_worth: '#9C6ADE', emergency_fund: '#02A8B9' };
              const prog = BappyUtil.goalProgress(g, state);
              const tint = GOAL_TINTS[g.type] || '#02A8B9';
              return (
                <Card key={g.id} padding={14} onClick={() => route.push('goals')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <IconContainer glyph={GOAL_GLYPHS[g.type] || 'star'} tint={tint} size={30} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-deep-ink)' }}>{g.title}</div>
                      <div className="tnum" style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 1 }}>
                        {BappyUtil.fmtGBPCompact(prog.current)} of {BappyUtil.fmtGBPCompact(prog.target)}
                      </div>
                    </div>
                    <div className="tnum" style={{ fontSize: 16, fontWeight: 600, color: tint }}>
                      {prog.pct.toFixed(0)}%
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'var(--c-haze-teal)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: prog.pct + '%', borderRadius: 999, background: tint, transition: 'width 0.6s' }} />
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Recent activity */}
      <SectionHeader right={<button onClick={() => route.push('ledger')} style={{ fontSize: 12, color: 'var(--c-ocean-teal)', fontWeight: 500 }}>Ledger</button>}>
        Recent activity
      </SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={0}>
          {recentTxns.map((t, i) => (
            <TxnListRow key={t.id} txn={t} last={i === recentTxns.length - 1}
              onClick={() => route.openSheet({ kind: 'edit-txn', txnId: t.id })} />
          ))}
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone, dark }) {
  const fg = dark ? '#fff' : 'var(--c-deep-ink)';
  const lc = dark ? 'rgba(255,255,255,0.55)' : 'var(--c-slate-mute)';
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: lc, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 500 }}>{label}</div>
      <div className="tnum" style={{ fontSize: 14, fontWeight: 500, color: fg, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ─── Nudge row ───────────────────────────────────────────────
function NudgeRow({ nudge, onClick }) {
  const route = useRoute();
  const handle = onClick || (() => route.push('nudge-detail', { id: nudge.id }));
  return (
    <Card padding={12} onClick={handle} style={{
      borderLeft: `3px solid ${nudge.severity === 'alert' ? 'var(--c-coral)' : nudge.severity === 'warning' ? 'var(--c-amber)' : 'var(--c-ocean-teal)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <SeverityDot severity={nudge.severity} size={6} />
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--c-slate-mute)', fontWeight: 500 }}>
              {nudge.type.replace(/_/g, ' ')}
            </span>
            {nudge.status === 'new' && (
              <span style={{
                width: 5, height: 5, borderRadius: 999, background: 'var(--c-coral)', marginLeft: 2,
              }} />
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-deep-ink)', lineHeight: 1.3 }}>
            {nudge.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 3, lineHeight: 1.45 }}>
            {nudge.body}
          </div>
        </div>
        <Icon name="chev-right" size={16} color="var(--c-slate-mute)" />
      </div>
    </Card>
  );
}

// ─── Transaction row (used in lists everywhere) ──────────────
function TxnListRow({ txn, last, onClick }) {
  const { state } = useBappy();
  const cat = state.categories.find(c => c.id === txn.categoryId);
  const acc = state.accounts.find(a => a.id === txn.accountId);
  const isIncome = txn.direction === 'income';
  const isTransferOut = txn.direction === 'transfer';
  const isTransferIn = txn.direction === 'transfer-in';
  const isTransfer = isTransferOut || isTransferIn;
  const otherAcc = isTransfer ? state.accounts.find(a => a.id === txn.transferToId) : null;
  return (
    <ListRow
      last={last}
      onClick={onClick}
      icon={
        isTransfer
          ? <IconContainer glyph="swap" tint="#7A8181" />
          : <IconContainer glyph={cat?.glyph || 'dot'} tint={isIncome ? '#03BCA5' : cat?.tint} variant={isIncome ? 'income' : 'default'} />
      }
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ opacity: txn.status === 'scheduled' ? 0.65 : 1 }}>{txn.description}</span>
          {txn.status === 'scheduled' && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 999, background: 'rgba(2,168,185,0.12)', color: 'var(--c-ocean-teal)', fontWeight: 600, letterSpacing: 0.3 }}>
              SCHEDULED
            </span>
          )}
        </span>
      }
      subtitle={
        isTransfer
          ? `${BappyUtil.fmtRelativeDate(txn.date)} · ${isTransferOut ? acc?.name + ' → ' + otherAcc?.name : otherAcc?.name + ' → ' + acc?.name}`
          : `${BappyUtil.fmtRelativeDate(txn.date)} · ${acc?.name}`
      }
      right={
        <div className="tnum" style={{
          fontSize: 15, fontWeight: 500,
          color: isIncome ? 'var(--c-seafoam)'
               : isTransferIn ? 'var(--c-slate)'
               : isTransferOut ? 'var(--c-slate-mute)'
               : 'var(--c-deep-ink)',
        }}>
          {isIncome ? '+' : isTransferIn ? '+' : isTransferOut ? '−' : '−'}{BappyUtil.fmtGBP(txn.amount, { abs: true })}
        </div>
      }
    />
  );
}

// ─── Client-side nudge generation ───────────────────────────
// Computes virtual nudge objects from current state without storing them.
// Supplements any server-generated nudges in state.nudges.
function computeNudges(state) {
  const nudges = [];
  const today = BappyUtil.today();
  const todayStr = today.toISOString().slice(0, 10);

  // bill_due — recurring items due within 7 days
  state.recurring.filter(r => r.active).forEach(r => {
    const days = BappyUtil.daysUntil(r.nextDue);
    if (days <= 7) {
      nudges.push({
        id: 'virtual-bill-' + r.id,
        type: 'bill_due',
        severity: days < 0 ? 'alert' : days <= 1 ? 'warning' : 'info',
        title: days < 0 ? `${r.payee} is overdue` : days === 0 ? `${r.payee} due today` : `${r.payee} due in ${days} day${days !== 1 ? 's' : ''}`,
        body: BappyUtil.fmtGBP(r.amount) + ' · ' + r.frequency,
        status: 'new',
        createdAt: todayStr,
        virtual: true,
      });
    }
  });

  // budget_threshold — budgets over 80%
  state.budgets.forEach(b => {
    const monthStart = new Date(today); monthStart.setUTCDate(1);
    const spent = state.transactions
      .filter(t => t.direction === 'expense' && new Date(t.date) >= monthStart && (!b.categoryId || t.categoryId === b.categoryId))
      .reduce((s, t) => s + t.amount, 0);
    const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
    const cat = state.categories.find(c => c.id === b.categoryId);
    const label = cat?.name || 'Overall';
    if (pct > 100) {
      nudges.push({
        id: 'virtual-budget-over-' + b.id,
        type: 'budget_threshold',
        severity: 'alert',
        title: `${label} budget exceeded`,
        body: `${BappyUtil.fmtGBP(spent)} spent of ${BappyUtil.fmtGBP(b.amount)} limit`,
        status: 'new', createdAt: todayStr, virtual: true,
      });
    } else if (pct >= 80) {
      nudges.push({
        id: 'virtual-budget-risk-' + b.id,
        type: 'budget_threshold',
        severity: 'warning',
        title: `${label} budget at ${pct.toFixed(0)}%`,
        body: `${BappyUtil.fmtGBP(b.amount - spent)} remaining`,
        status: 'new', createdAt: todayStr, virtual: true,
      });
    }
  });

  // low_balance — current account below floor
  const floor = state.settings?.lowBalanceFloor || 200;
  const primaryAcc = state.accounts.find(a => a.type === 'current');
  if (primaryAcc && primaryAcc.balance < floor) {
    nudges.push({
      id: 'virtual-low-balance-' + primaryAcc.id,
      type: 'low_balance',
      severity: primaryAcc.balance < 0 ? 'alert' : 'warning',
      title: `Low balance on ${primaryAcc.name}`,
      body: `${BappyUtil.fmtGBP(primaryAcc.balance)} · floor is ${BappyUtil.fmtGBP(floor)}`,
      status: 'new', createdAt: todayStr, virtual: true,
    });
  }

  return nudges;
}

// ─── Nudge inbox ─────────────────────────────────────────────
function NudgesScreen() {
  const { state, dispatch } = useBappy();
  const [tab, setTab] = React.useState('new');

  // Merge stored nudges with live computed nudges (virtual ones can't be dismissed/acted)
  const virtualNudges = computeNudges(state);
  const storedIds = new Set(state.nudges.map(n => n.id));
  const allNudges = [
    ...state.nudges,
    ...virtualNudges.filter(n => !storedIds.has(n.id)),
  ];

  const filtered = allNudges.filter(n => {
    if (tab === 'new') return n.status === 'new' || n.status === 'seen';
    if (tab === 'acted') return n.status === 'acted';
    if (tab === 'dismissed') return n.status === 'dismissed';
    return true;
  });
  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader title="Nudges" leading="back" />
      <div style={{ padding: '0 16px 12px' }}>
        <Segmented
          options={[
            { value: 'new', label: 'Active (' + allNudges.filter(n => n.status === 'new' || n.status === 'seen').length + ')' },
            { value: 'acted', label: 'Acted' },
            { value: 'dismissed', label: 'Dismissed' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0
          ? <EmptyState glyph="check" title="Inbox zero" body="Nothing pending here." />
          : filtered.map(n => <NudgeRow key={n.id} nudge={n} />)}
      </div>
    </div>
  );
}

// ─── Nudge detail ────────────────────────────────────────────
function NudgeDetailScreen() {
  const { state, dispatch } = useBappy();
  const route = useRoute();
  const id = route.current.params?.id;
  const allNudges = [...state.nudges, ...computeNudges(state).filter(n => !state.nudges.some(s => s.id === n.id))];
  const nudge = allNudges.find(n => n.id === id);
  if (!nudge) return <div style={{ padding: 24 }}>Not found</div>;

  const severityBg = nudge.severity === 'alert' ? 'var(--c-coral)'
                   : nudge.severity === 'warning' ? 'var(--c-amber)'
                   : 'var(--c-ocean-teal)';

  const handleAct = () => {
    if (!nudge.virtual) {
      dispatch({ type: 'UPDATE_NUDGE', id: nudge.id, patch: { status: 'acted', acted_at: BappyUtil.today().toISOString() } });
    }
    // deep-link via action field (stored nudges) or type fallback (virtual nudges)
    const a = nudge.action;
    if (a?.screen === 'forecast') route.replace('forecast');
    else if (a?.screen === 'suggestions') route.replace('suggestions');
    else if (a?.screen === 'budget') route.replace('budget-detail', { id: a.id });
    else if (a?.screen === 'debt') route.replace('debt-per', { id: a.id });
    else if (a?.screen === 'recurring') route.replace('recurring');
    else if (a?.screen === 'transfer') route.replace('ledger');
    else if (nudge.type === 'bill_due') route.replace('recurring');
    else if (nudge.type === 'budget_threshold') route.replace('budgets');
    else if (nudge.type === 'low_balance') route.replace('accounts');
    else route.pop();
  };

  const handleDismiss = () => {
    if (!nudge.virtual) {
      dispatch({ type: 'UPDATE_NUDGE', id: nudge.id, patch: { status: 'dismissed' } });
    }
    route.pop();
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      <ScreenHeader leading="back" />
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px 4px 8px', borderRadius: 999,
          background: severityBg, color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>
          <SeverityDot severity={nudge.severity} size={6} />
          {nudge.severity}
        </div>
        <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--c-deep-ink)', marginTop: 10, lineHeight: 1.25 }}>
          {nudge.title}
        </div>
        <div style={{ fontSize: 15, color: 'var(--c-slate)', marginTop: 6, lineHeight: 1.5 }}>
          {nudge.body}
        </div>
      </div>

      {/* Context */}
      {nudge.context && Object.keys(nudge.context).length > 0 && (
        <>
          <SectionHeader>Context</SectionHeader>
          <div style={{ padding: '0 16px' }}>
            <Card padding={14}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(nudge.context).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--c-slate-mute)' }}>{k.replace(/_/g, ' ')}</span>
                    <span className="tnum" style={{ color: 'var(--c-deep-ink)', fontWeight: 500 }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Channels */}
      {nudge.channels?.length > 0 && (
        <>
          <SectionHeader>Delivered via</SectionHeader>
          <div style={{ padding: '0 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {nudge.channels.map(c => <ChannelPill key={c} channel={c} />)}
          </div>
        </>
      )}

      {/* Type */}
      <SectionHeader>Type</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={12}>
          <div style={{ fontSize: 13, color: 'var(--c-deep-ink)' }}>{nudge.type.replace(/_/g, ' ')}</div>
          <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 2 }}>
            {nudge.id} · created {BappyUtil.fmtRelativeDate(nudge.createdAt)}
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div style={{ padding: '24px 16px 16px', display: 'flex', gap: 8 }}>
        <Button variant="outline" onClick={handleDismiss} style={{ flex: 1 }}>Dismiss</Button>
        <Button variant="primary" onClick={handleAct} style={{ flex: 2 }} icon="chev-right">
          {nudge.action?.screen === 'forecast' ? 'Open forecast'
            : nudge.action?.screen === 'suggestions' ? 'Review suggestions'
            : nudge.action?.screen === 'budget' ? 'Open budget'
            : nudge.action?.screen === 'debt' ? 'Open simulator'
            : nudge.action?.screen === 'recurring' ? 'Open recurring'
            : nudge.action?.screen === 'transfer' ? 'Allocate now'
            : 'Mark acted'}
        </Button>
      </div>
    </div>
  );
}

// ─── Empty / onboarding state ─────────────────────────────────
function HomeEmpty() {
  const route = useRoute();
  const { pullFromSheets, syncStatus } = useBappy();
  const { user } = useBappyAuth();
  const [pulling, setPulling] = React.useState(false);
  const [pullMsg, setPullMsg] = React.useState('');

  const handlePull = async () => {
    setPulling(true);
    setPullMsg('');
    try {
      await pullFromSheets();
      setPullMsg('Done — your data has been restored.');
    } catch (e) {
      setPullMsg('Could not reach cloud: ' + (e?.message || String(e)));
    } finally {
      setPulling(false);
    }
  };

  const steps = [
    { icon: 'acc-bank', label: 'Add your current account', desc: 'Your everyday bank account — the foundation of your budget.' },
    { icon: 'swap',     label: 'Log a transaction',        desc: 'Tap + to add income or spending. Bappy keeps the balance up to date.' },
    { icon: 'home',     label: 'Set a budget',             desc: 'Go to Plan → Budgets and set a monthly limit per category.' },
  ];

  return (
    <div style={{ padding: '0 16px 120px' }}>
      <ScreenHeader title="Welcome to Bappy" subtitle="Let's set up your budget" />

      {/* Signed-in account + restore — helps diagnose cross-device sync issues */}
      <Card padding={14} style={{ marginBottom: 16, background: 'var(--c-ice-wash)', border: '1px solid var(--c-haze-teal)' }}>
        <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginBottom: 6 }}>
          Signed in as <strong style={{ color: 'var(--c-deep-ink)' }}>{user?.email || 'unknown'}</strong>
        </div>
        <div style={{ fontSize: 13, color: 'var(--c-slate)', lineHeight: 1.5, marginBottom: 10 }}>
          Already have data on another device? Restore it from the cloud.
        </div>
        <Button variant="secondary" full icon="refresh" onClick={handlePull} disabled={pulling}>
          {pulling ? 'Restoring…' : 'Restore from cloud'}
        </Button>
        {pullMsg && (
          <div style={{ marginTop: 8, fontSize: 12, color: pullMsg.startsWith('Could') ? 'var(--c-coral)' : 'var(--c-seafoam)', fontWeight: 500 }}>
            {pullMsg}
          </div>
        )}
      </Card>

      <div style={{ padding: '4px 0 16px', fontSize: 14, color: 'var(--c-slate)', lineHeight: 1.6 }}>
        Or start fresh — your dashboard will appear once you've added at least one account.
      </div>

      {steps.map((s, i) => (
        <div key={i} style={{
          display: 'flex', gap: 14, alignItems: 'flex-start',
          padding: '14px 0', borderBottom: i < steps.length - 1 ? '1px solid var(--c-border)' : 'none',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'var(--c-haze-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={s.icon} size={18} color="var(--c-ocean-teal)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-deep-ink)' }}>{s.label}</div>
            <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 2, lineHeight: 1.5 }}>{s.desc}</div>
          </div>
        </div>
      ))}

      <Button variant="primary" full size="lg" style={{ marginTop: 24 }} onClick={() => route.gotoTab('accounts')}>
        Add your first account
      </Button>
    </div>
  );
}

export { HomeScreen, NudgesScreen, NudgeDetailScreen, NudgeRow, TxnListRow };
