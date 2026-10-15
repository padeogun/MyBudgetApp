import React from 'react'
import { BAPPY_SEED, BappyUtil, useBappy, BappyContext, BappyAuthContext, BappyProvider, useBappyAuth, BappyAuthProvider } from './bappy-state.jsx'
import { Icon, BappyLogo, ICON_PATHS } from './bappy-icons.jsx'
import { IconContainer, Card, Tag, ProgressBar, Button, Sheet, SectionHeader, ListRow, SeverityDot, ChannelPill, EmptyState, Toggle, Segmented, Stepper, tintBg } from './bappy-primitives.jsx'
import { chartPalette, Sparkline, AreaChart, Donut, BarChart, StackedDebtChart, DebtCurve } from './bappy-charts.jsx'
import { BappyRouter, BappyRouteContext, useRoute, ScreenHeader, TabBar, FAB } from './bappy-nav.jsx'
import { TxnListRow } from './bappy-screens-home.jsx'
// Bappy — Money tab: Accounts list/detail, Ledger, Add Transaction sheet

function AccountsScreen() {
  const { state } = useBappy();
  const route = useRoute();
  const groups = {
    current: { label: 'Cash', accounts: [] },
    savings: { label: 'Savings', accounts: [] },
    credit_card: { label: 'Credit cards', accounts: [] },
    loan: { label: 'Loans', accounts: [] },
  };
  state.accounts.forEach(a => groups[a.type]?.accounts.push(a));
  const cash = state.accounts.filter(a => a.type === 'current' || a.type === 'savings').reduce((s, a) => s + a.balance, 0);
  const debt = Math.abs(state.accounts.filter(a => a.type === 'credit_card' || a.type === 'loan').reduce((s, a) => s + a.balance, 0));
  const net = cash - debt;

  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader title="Money" subtitle="Accounts" />

      {/* Summary card */}
      <div style={{ padding: '0 16px 4px' }}>
        <Card dark padding={18} style={{ overflow: 'hidden', position: 'relative' }}>
          <div style={{
            position: 'absolute', bottom: -50, left: -50, width: 200, height: 200,
            borderRadius: 999,
            background: 'radial-gradient(circle, rgba(2,168,185,0.30) 0%, rgba(2,168,185,0) 70%)',
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 500 }}>Net position</div>
            <div className="tnum" style={{ fontSize: 32, fontWeight: 300, color: '#fff', marginTop: 4, letterSpacing: -0.5 }}>
              {BappyUtil.fmtGBP(net)}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Cash</div>
                <div className="tnum" style={{ fontSize: 15, color: 'var(--c-seafoam)', fontWeight: 500 }}>{BappyUtil.fmtGBPCompact(cash)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Owed</div>
                <div className="tnum" style={{ fontSize: 15, color: 'var(--c-coral)', fontWeight: 500 }}>{BappyUtil.fmtGBPCompact(debt)}</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Unlinked transfers banner ── */}
      {(() => {
        const pending = state.transactions.filter(t =>
          t.categoryId === 'cat-transfer' && !t.transferToId &&
          (t.direction === 'expense' || t.direction === 'income')
        );
        if (pending.length === 0) return null;
        return (
          <div style={{ padding: '8px 16px 0' }}>
            <div style={{
              padding: '10px 14px', borderRadius: 12,
              background: 'rgba(244,165,53,0.10)', border: '1px solid rgba(244,165,53,0.30)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Icon name="swap" size={16} color="var(--c-amber)" style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--c-slate)', fontWeight: 500 }}>
                {pending.length} transfer{pending.length !== 1 ? 's' : ''} not yet linked
              </span>
              <button
                onClick={() => route.openSheet({ kind: 'link-transfers' })}
                style={{ fontSize: 12, color: 'var(--c-ocean-teal)', fontWeight: 500, whiteSpace: 'nowrap', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                Tap to link →
              </button>
            </div>
          </div>
        );
      })()}

      <SectionHeader right={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => route.openSheet({ kind: 'add-account' })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 11px 5px 8px', borderRadius: 999,
              border: '1.5px solid var(--c-ocean-teal)',
              background: '#fff', color: 'var(--c-ocean-teal)',
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >
            <Icon name="plus" size={13} strokeWidth={2.5} />
            Account
          </button>
          <button onClick={() => route.push('ledger')} style={{ fontSize: 12, color: 'var(--c-ocean-teal)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Ledger <Icon name="chev-right" size={12} />
          </button>
        </div>
      }>Accounts</SectionHeader>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.entries(groups).map(([type, g]) => {
          if (g.accounts.length === 0) return null;
          return (
            <div key={type}>
              <div style={{
                fontSize: 11, fontWeight: 500, color: 'var(--c-slate-mute)',
                textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4, paddingBottom: 6,
              }}>{g.label}</div>
              <Card padding={0}>
                {g.accounts.map((a, i) => (
                  <AccountRow key={a.id} account={a} last={i === g.accounts.length - 1} />
                ))}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccountRow({ account, last }) {
  const route = useRoute();
  const isCard = account.type === 'credit_card';
  const isLoan = account.type === 'loan';
  const available = isCard ? account.limit + account.balance : null; // balance is negative
  const utilization = isCard ? Math.min(100, (Math.abs(account.balance) / account.limit) * 100) : null;
  const glyph = account.type === 'current' ? 'acc-bank'
              : account.type === 'savings' ? 'acc-savings'
              : isCard ? 'acc-credit' : 'acc-loan';
  const isNeg = account.balance < 0;
  return (
    <ListRow
      last={last}
      onClick={() => route.push('account-detail', { id: account.id })}
      icon={<IconContainer glyph={glyph} tint={isNeg ? '#E8566A' : '#02A8B9'} />}
      title={account.name}
      subtitle={
        isCard ? `${utilization.toFixed(0)}% used · ${BappyUtil.fmtGBPCompact(available)} left` :
        isLoan ? [
          account.apr ? `${account.apr}% APR` : null,
          account.repaymentAmount ? `${BappyUtil.fmtGBPCompact(account.repaymentAmount)}/mo` : null,
          account.endDate ? `ends ${BappyUtil.fmtDateShort(account.endDate)}` : (account.principal ? `${BappyUtil.fmtGBPCompact(account.principal)} principal` : null),
        ].filter(Boolean).join(' · ') :
        `••••${account.last4}`
      }
      right={
        <div className="tnum" style={{ fontSize: 16, fontWeight: 500, color: isNeg ? 'var(--c-coral)' : 'var(--c-deep-ink)' }}>
          {BappyUtil.fmtGBP(account.balance, { sign: false })}
        </div>
      }
      trailing={<Icon name="chev-right" size={14} color="var(--c-slate-mute)" style={{ marginLeft: 4 }} />}
    />
  );
}

// ─── Account detail ──────────────────────────────────────────
function AccountDetailScreen() {
  const { state } = useBappy();
  const route = useRoute();
  const account = state.accounts.find(a => a.id === route.current.params?.id);
  if (!account) return <div style={{ padding: 24 }}>Not found</div>;
  const txns = state.transactions
    .filter(t => t.accountId === account.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 25);
  const isCard = account.type === 'credit_card';
  const isLoan = account.type === 'loan';
  const isNeg = account.balance < 0;

  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader leading="back"
        trailing={
          <button onClick={() => route.openSheet({ kind: 'edit-account', accountId: account.id })}
            style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--c-ice-wash)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-slate)' }}>
            <Icon name="edit" size={17} />
          </button>
        }
      />

      <div style={{ padding: '0 16px 8px' }}>
        <Card dark padding={20} style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: -30, right: -30, width: 160, height: 160,
            borderRadius: 999,
            background: `radial-gradient(circle, ${isCard ? 'rgba(232,86,106,0.30)' : 'rgba(3,188,165,0.25)'} 0%, rgba(2,168,185,0) 70%)`,
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Tag variant="dark">{account.type.replace('_', ' ')}</Tag>
              <span className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>
                ••••{account.last4}
              </span>
            </div>
            <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.85)', marginTop: 14 }}>{account.name}</div>
            <div className="tnum" style={{
              fontSize: 36, fontWeight: 300, color: isNeg ? '#FFC6CE' : '#fff', marginTop: 6, letterSpacing: -0.5,
            }}>
              {BappyUtil.fmtGBP(account.balance)}
            </div>
            {isCard && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {Math.min(100, (Math.abs(account.balance) / account.limit) * 100).toFixed(0)}% used
                  </span>
                  <span className="tnum" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    {BappyUtil.fmtGBPCompact(account.limit + account.balance)} avail of {BappyUtil.fmtGBPCompact(account.limit)}
                  </span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.12)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: Math.min(100, (Math.abs(account.balance) / account.limit) * 100) + '%',
                    background: 'var(--c-amber)', borderRadius: 999,
                  }} />
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 14 }}>
                  <KV label="APR" value={account.apr + '%'} dark />
                  <KV label="Min repayment" value={account.minRepayRule} dark />
                </div>
              </div>
            )}
            {isLoan && (
              <>
                <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                  <KV label="APR"       value={account.apr + '%'} dark />
                  <KV label="Principal" value={BappyUtil.fmtGBPCompact(account.principal)} dark />
                  {!!account.repaymentAmount && <KV label="Per payment"  value={BappyUtil.fmtGBP(account.repaymentAmount)} dark />}
                  {!!account.numPayments     && <KV label="Payments"     value={String(account.numPayments)} dark />}
                  {!!account.startDate       && <KV label="Start"        value={BappyUtil.fmtDateShort(account.startDate)} dark />}
                  {!!account.endDate         && <KV label="End"          value={BappyUtil.fmtDateShort(account.endDate)} dark />}
                </div>
                {/* Loan progress bar — shown when start + end date are defined */}
                {account.startDate && account.endDate && (() => {
                  const start   = new Date(account.startDate).getTime();
                  const end     = new Date(account.endDate).getTime();
                  const now     = BappyUtil.today().getTime();
                  const pct     = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
                  const daysLeft = Math.max(0, Math.round((end - now) / 86400000));
                  const paymentsLeft = account.numPayments
                    ? Math.max(0, account.numPayments - Math.round(((now - start) / 86400000) / (30.44)))
                    : null;
                  return (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 5, letterSpacing: 0.6 }}>
                        <span>NOW</span>
                        <span>TARGET · {BappyUtil.fmtDateShort(account.endDate)}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', borderRadius: 999, background: 'linear-gradient(90deg, #03BCA5, #02A8B9)', transition: 'width 0.4s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11 }}>
                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{pct.toFixed(0)}% of term complete</span>
                        <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                          {paymentsLeft !== null ? `~${paymentsLeft} payments left` : `${daysLeft} days left`}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            {account.type === 'savings' && (
              <div style={{ marginTop: 10 }}>
                <KV label="AER" value={account.rate + '%'} dark />
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8 }}>
        {(isCard || isLoan) && (
          <Button variant="secondary" full icon="nav-insights" onClick={() => route.push('debt-per', { id: account.id })}>
            Simulate payoff
          </Button>
        )}
        {!isCard && !isLoan && (
          <>
            <Button variant="secondary" full icon="swap" onClick={() => route.openSheet({ kind: 'transfer', accountId: account.id })}>Transfer</Button>
            <Button variant="primary" full icon="plus" onClick={() => route.openSheet({ kind: 'add', accountId: account.id })}>Add transaction</Button>
          </>
        )}
      </div>

      <SectionHeader>Recent activity</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={0}>
          {txns.length === 0
            ? <EmptyState glyph="dot" title="No transactions yet" />
            : txns.map((t, i) => (
                <TxnListRow key={t.id} txn={t} last={i === txns.length - 1}
                  onClick={() => route.openSheet({ kind: 'edit-txn', txnId: t.id })} />
              ))}
        </Card>
      </div>
    </div>
  );
}

function KV({ label, value, dark }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8,
        color: dark ? 'rgba(255,255,255,0.55)' : 'var(--c-slate-mute)', fontWeight: 500 }}>{label}</div>
      <div className="tnum" style={{ fontSize: 14, fontWeight: 500,
        color: dark ? '#fff' : 'var(--c-deep-ink)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ─── Ledger (full transactions list) ─────────────────────────
function LedgerScreen() {
  const { state } = useBappy();
  const route = useRoute();
  const [accountFilter, setAccountFilter] = React.useState('all');
  const [query,         setQuery]         = React.useState('');
  const [dirFilter,     setDirFilter]     = React.useState('all');
  const [timeFilter,    setTimeFilter]    = React.useState('all');
  const todayStr = BappyUtil.today().toISOString().slice(0, 10);

  const norm = s => (s || '').toLowerCase();

  // Time cutoff
  const timeCutoff = (() => {
    if (timeFilter === 'month')   { const d = new Date(BappyUtil.today()); d.setUTCDate(1); return d.toISOString().slice(0, 10); }
    if (timeFilter === '3months') { const d = new Date(BappyUtil.today()); d.setUTCMonth(d.getUTCMonth() - 3); return d.toISOString().slice(0, 10); }
    return null;
  })();

  const allFiltered = state.transactions
    .filter(t => accountFilter === 'all' || t.accountId === accountFilter)
    .filter(t => !query || norm(t.description).includes(norm(query)))
    .filter(t => dirFilter === 'all' || t.direction === dirFilter ||
      (dirFilter === 'expense' && (t.direction === 'expense' || t.direction === 'transfer')) ||
      (dirFilter === 'income'  && (t.direction === 'income'  || t.direction === 'transfer-in')))
    .filter(t => !timeCutoff || t.date >= timeCutoff)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Split into upcoming (scheduled future) and posted (past/today)
  const upcoming  = allFiltered.filter(t => t.status === 'scheduled');
  const posted    = allFiltered.filter(t => t.status !== 'scheduled');

  // Group posted by date
  const groups = {};
  posted.forEach(t => { groups[t.date] = groups[t.date] || []; groups[t.date].push(t); });

  const hasActiveFilter = query || dirFilter !== 'all' || timeFilter !== 'all' || accountFilter !== 'all';

  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="Ledger" leading="back" subtitle={hasActiveFilter ? `${posted.length} result${posted.length !== 1 ? 's' : ''}` : undefined} />

      {/* Search bar */}
      <div style={{ padding: '0 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--c-ice-wash)', border: '1px solid var(--c-border)' }}>
          <Icon name="search" size={16} color="var(--c-slate-mute)" />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search transactions…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--c-deep-ink)' }}
          />
          {query && <button onClick={() => setQuery('')} style={{ color: 'var(--c-slate-mute)', border: 'none', background: 'none', padding: '0 2px', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>×</button>}
        </div>
      </div>

      {/* Account filter */}
      <div style={{ padding: '0 16px 6px', display: 'flex', gap: 6, overflowX: 'auto' }} className="bappy-scroll">
        <FilterChip active={accountFilter === 'all'} onClick={() => setAccountFilter('all')}>All accounts</FilterChip>
        {state.accounts.map(a => (
          <FilterChip key={a.id} active={accountFilter === a.id} onClick={() => setAccountFilter(a.id)}>{a.name}</FilterChip>
        ))}
      </div>

      {/* Direction + time filters */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6, overflowX: 'auto' }} className="bappy-scroll">
        <FilterChip active={dirFilter === 'all'}     onClick={() => setDirFilter('all')}>All</FilterChip>
        <FilterChip active={dirFilter === 'expense'} onClick={() => setDirFilter('expense')}>Expenses</FilterChip>
        <FilterChip active={dirFilter === 'income'}  onClick={() => setDirFilter('income')}>Income</FilterChip>
        <div style={{ width: 1, background: 'var(--c-border)', margin: '0 2px', flexShrink: 0 }} />
        <FilterChip active={timeFilter === 'all'}     onClick={() => setTimeFilter('all')}>All time</FilterChip>
        <FilterChip active={timeFilter === 'month'}   onClick={() => setTimeFilter('month')}>This month</FilterChip>
        <FilterChip active={timeFilter === '3months'} onClick={() => setTimeFilter('3months')}>Last 3 months</FilterChip>
      </div>

      {/* Upcoming / scheduled section */}
      {upcoming.length > 0 && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--c-ocean-teal)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, padding: '0 4px 6px' }}>
            Upcoming · not yet posted
          </div>
          <Card padding={0} style={{ border: '1px solid var(--c-haze-teal)', background: 'var(--c-ice-wash)' }}>
            {upcoming.map((t, i) => (
              <TxnListRow key={t.id} txn={t} last={i === upcoming.length - 1}
                onClick={() => route.openSheet({ kind: 'edit-txn', txnId: t.id })} />
            ))}
          </Card>
        </div>
      )}

      {/* Posted transactions grouped by date */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(date => {
          const total = groups[date].reduce((s, t) => s + (t.direction === 'income' ? t.amount : -t.amount), 0);
          return (
            <div key={date}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px 6px' }}>
                <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {BappyUtil.fmtRelativeDate(date)}
                </div>
                <div className="tnum" style={{ fontSize: 12, color: 'var(--c-slate-mute)' }}>
                  {total >= 0 ? '+' : ''}{BappyUtil.fmtGBP(total)}
                </div>
              </div>
              <Card padding={0}>
                {groups[date].map((t, i) => (
                  <TxnListRow key={t.id} txn={t} last={i === groups[date].length - 1}
                    onClick={() => route.openSheet({ kind: 'edit-txn', txnId: t.id })} />
                ))}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

// ─── Add Transaction sheet ───────────────────────────────────
function AddTransactionSheet({ initial = {} }) {
  const { state, dispatch } = useBappy();
  const route = useRoute();
  const [direction, setDirection] = React.useState(initial.direction || 'expense');
  const [amount, setAmount] = React.useState('');
  const [accountId, setAccountId] = React.useState(initial.accountId || state.accounts[0]?.id);
  const [transferToId, setTransferToId] = React.useState(() => {
    const first = state.accounts.find(a => a.id !== (initial.accountId || state.accounts[0]?.id));
    return first?.id || state.accounts[1]?.id;
  });
  const [categoryId, setCategoryId] = React.useState('cat-grocery');
  const [description, setDescription] = React.useState('');
  const [date, setDate] = React.useState(BappyUtil.today().toISOString().slice(0, 10));
  const [isRecurring,   setIsRecurring]   = React.useState(false);
  const [recurFreq,     setRecurFreq]     = React.useState('monthly');
  const [recurEndDate,  setRecurEndDate]  = React.useState('');
  const [recurMaxPay,   setRecurMaxPay]   = React.useState('');

  // Make sure transferToId always differs from accountId
  React.useEffect(() => {
    if (direction === 'transfer' && transferToId === accountId) {
      const other = state.accounts.find(a => a.id !== accountId);
      setTransferToId(other?.id);
    }
  }, [accountId, direction]);

  if (state.accounts.length === 0) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-slate-mute)' }}>No accounts yet — add one first.</div>
  }

  const amt = parseFloat(amount) || 0;
  const acc = state.accounts.find(a => a.id === accountId);
  const toAcc = state.accounts.find(a => a.id === transferToId);

  // Soft warning: same-amount transaction on same account within last 3 days
  const recentDup = findRecentDuplicate(state.transactions, { accountId, direction, amount: amt, date });

  // Recurring conflict: template or suggestion already covers this payee/amount
  const recurConflicts = (isRecurring && amt > 0 && direction !== 'transfer')
    ? findRecurringConflicts(state, { description, amount: amt, accountId, direction, frequency: recurFreq })
    : null;

  // Quick description suggestions based on category
  const SUGG_BY_CAT = {
    'cat-grocery': ['Tesco', 'Sainsbury\u2019s', 'M&S Foodhall', 'Waitrose'],
    'cat-eatout': ['Pret', 'Costa', 'Wagamama', 'Dishoom'],
    'cat-transport': ['TfL', 'Uber', 'Trainline'],
    'cat-personal': ['Boots', 'Superdrug'],
    'cat-clothing': ['Uniqlo', 'M&S', 'JD Sports'],
    'cat-fun': ['Cinema', 'Gig', 'Spotify'],
  };
  const suggs = direction === 'transfer' ? [] : (SUGG_BY_CAT[categoryId] || []);

  const handleSave = () => {
    if (amt <= 0) return;
    if (direction === 'transfer' && (!transferToId || transferToId === accountId)) return;
    const txnDescription = description || (direction === 'transfer' ? `Transfer to ${toAcc?.name}` : 'Transaction');
    const txnType = direction === 'transfer' ? 'transfer' : (isRecurring ? 'recurring' : 'one_off');
    dispatch({
      type: 'ADD_TRANSACTION',
      txn: {
        date, amount: amt, direction, accountId,
        transferToId: direction === 'transfer' ? transferToId : null,
        categoryId: direction === 'transfer' ? 'cat-transfer' : categoryId,
        type: txnType,
        description: txnDescription,
        status: 'posted', recurrenceTemplateId: null,
      },
    });
    // Also create recurring template when marked recurring
    if (isRecurring && direction !== 'transfer') {
      dispatch({
        type: 'ADD_RECURRING',
        rec: {
          payee:       txnDescription,
          accountId, amount: amt, direction,
          frequency:   recurFreq,
          anchorDay:   new Date(date).getUTCDate(),
          categoryId, active: true, source: 'manual',
          nextDue:     date, baseline: amt,
          ...(recurEndDate  && { endDate:     recurEndDate }),
          ...(recurMaxPay   && { maxPayments: parseInt(recurMaxPay, 10) || undefined }),
        },
      });
    }
    route.closeSheet();
  };

  return (
    <div>
      {/* Direction */}
      <Segmented
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
          { value: 'transfer', label: 'Transfer' },
        ]}
        value={direction}
        onChange={setDirection}
      />

      {/* Amount */}
      <div style={{
        marginTop: 24, padding: '24px 16px',
        background: 'var(--c-snow-mist)', borderRadius: 14,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
          Amount
        </div>
        <div className="tnum" style={{
          fontSize: 48, fontWeight: 300, color: 'var(--c-deep-ink)', marginTop: 6,
          letterSpacing: -1, lineHeight: 1,
        }}>
          <span style={{ color: 'var(--c-haze-teal)' }}>£</span>{amount || '0.00'}
        </div>
      </div>

      {/* Number pad */}
      <div style={{
        marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
      }}>
        {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
          <button key={k} onClick={() => {
            if (k === '⌫') setAmount(s => s.slice(0, -1));
            else if (k === '.' && amount.includes('.')) return;
            else setAmount(s => (s + k).slice(0, 10));
          }} style={{
            height: 48, background: '#fff', border: '1px solid var(--c-border)',
            borderRadius: 12, fontSize: 22, fontWeight: 400,
            color: 'var(--c-deep-ink)', fontFamily: 'Roboto Mono',
          }}>{k}</button>
        ))}
      </div>

      {/* Fields */}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Card padding={0}>
          {direction === 'transfer' ? (
            <>
              <SheetField label="From" value={acc?.name}>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} style={selectStyle}>
                  {state.accounts.filter(a => a.id !== transferToId).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </SheetField>
              <SheetField label="To" value={toAcc?.name}>
                <select value={transferToId} onChange={e => setTransferToId(e.target.value)} style={selectStyle}>
                  {state.accounts.filter(a => a.id !== accountId).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </SheetField>
              <SheetField label="Date" value={BappyUtil.fmtDateShort(date)} last>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={selectStyle} />
              </SheetField>
            </>
          ) : (
            <>
              <SheetField label="Account" value={acc?.name}>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} style={selectStyle}>
                  {state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </SheetField>
              <SheetField label="Category" value={state.categories.find(c => c.id === categoryId)?.name}>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={selectStyle}>
                  {state.categories.filter(c => c.id !== 'cat-transfer').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </SheetField>
              <SheetField label="Date" value={BappyUtil.fmtDateShort(date)}>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={selectStyle} />
              </SheetField>
              {/* Recurring toggle */}
              <div style={{
                padding: '12px 14px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid var(--c-border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Recurring</span>
                  {isRecurring && (
                    <span style={{
                      fontSize: 11, padding: '2px 7px', borderRadius: 999,
                      background: 'rgba(2,168,185,0.12)', color: 'var(--c-ocean-teal)', fontWeight: 500,
                    }}>↻ {recurFreq}</span>
                  )}
                </div>
                <Toggle value={isRecurring} onChange={v => setIsRecurring(v)} />
              </div>
              {isRecurring && (
                <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Segmented
                    options={[
                      { value: 'weekly',   label: 'Weekly' },
                      { value: 'monthly',  label: 'Monthly' },
                      { value: 'annually', label: 'Annually' },
                    ]}
                    value={recurFreq} onChange={setRecurFreq}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginBottom: 4 }}>End date (optional)</div>
                      <input type="date" value={recurEndDate} onChange={e => setRecurEndDate(e.target.value)}
                        style={{ width: '100%', fontSize: 13, border: '1px solid var(--c-border)', borderRadius: 8, padding: '5px 8px', background: 'var(--c-snow-mist)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginBottom: 4 }}>Max payments (optional)</div>
                      <input type="number" inputMode="numeric" value={recurMaxPay} onChange={e => setRecurMaxPay(e.target.value)}
                        placeholder="e.g. 12" style={{ width: '100%', fontSize: 13, border: '1px solid var(--c-border)', borderRadius: 8, padding: '5px 8px', background: 'var(--c-snow-mist)' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {direction === 'transfer' && (
          <Card padding={12} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--c-ice-wash)', border: '1px solid var(--c-haze-teal)',
          }}>
            <Icon name="swap" size={18} color="var(--c-ocean-teal)" />
            <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--c-slate)', lineHeight: 1.4 }}>
              Creates a paired transaction · debit on <strong style={{ color: 'var(--c-deep-ink)' }}>{acc?.name}</strong>, credit on <strong style={{ color: 'var(--c-deep-ink)' }}>{toAcc?.name}</strong>.
            </div>
          </Card>
        )}

        <Card padding={12}>
          <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 6 }}>
            {direction === 'transfer' ? 'Note' : 'Description'}
          </div>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={direction === 'transfer' ? 'e.g. Move spare cash to savings' : 'e.g. Tesco'}
            style={{
              width: '100%', border: 'none', outline: 'none',
              fontSize: 16, color: 'var(--c-deep-ink)', background: 'transparent', padding: 0,
            }}
          />
          {suggs.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {suggs.map(s => (
                <button key={s} onClick={() => setDescription(s)} style={{
                  padding: '4px 10px', borderRadius: 999,
                  background: 'var(--c-ice-wash)', color: 'var(--c-ocean-teal)',
                  fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                }}>{s}</button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Recurring conflict warning ── */}
      {recurConflicts && (recurConflicts.templates.length > 0 || recurConflicts.suggestions.length > 0) && (
        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 12, background: 'rgba(244,165,53,0.10)', border: '1px solid rgba(244,165,53,0.30)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Icon name="warn" size={15} color="var(--c-amber)" style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: 'var(--c-slate)', lineHeight: 1.5 }}>
              <strong>Similar recurring template already exists:</strong>
              {recurConflicts.templates.map(r => (
                <div key={r.id} style={{ marginTop: 3 }}>↻ {r.payee} · {BappyUtil.fmtGBP(r.amount)} · {r.frequency}</div>
              ))}
              {recurConflicts.suggestions.map(s => (
                <div key={s.id} style={{ marginTop: 3 }}>⚑ Detected: {s.payee} · {BappyUtil.fmtGBP(s.amount)}</div>
              ))}
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--c-slate-mute)' }}>Creating a new template may cause duplicates in your plan.</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Button variant="primary" full size="lg" onClick={handleSave}
          disabled={amt <= 0 || (direction === 'transfer' && (!transferToId || transferToId === accountId))}>
          {direction === 'expense' ? 'Add expense'
            : direction === 'income' ? 'Add income'
            : `Transfer ${amt > 0 ? BappyUtil.fmtGBP(amt) + ' ' : ''}to ${toAcc?.name.split(' ')[0] || 'account'}`}
        </Button>

        {/* ── Recent duplicate soft warning ── */}
        {recentDup && (
          <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 12, background: 'rgba(244,165,53,0.10)', border: '1px solid rgba(244,165,53,0.30)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Icon name="warn" size={15} color="var(--c-amber)" style={{ marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--c-slate)', lineHeight: 1.5 }}>
              A similar <strong>{BappyUtil.fmtGBP(recentDup.amount)}</strong> {recentDup.direction} was posted on <strong>{BappyUtil.fmtDateShort(recentDup.date)}</strong> — possible duplicate.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Duplicate / conflict helpers ────────────────────────────
// Check state.recurring + state.suggestions for templates that already
// cover the same payee/amount/account/frequency combination.
function findRecurringConflicts(state, { description, amount, accountId, direction, frequency }) {
  const norm = s => (s || '').trim().toLowerCase();
  const desc = norm(description);
  const nameMatch = payee => {
    const p = norm(payee);
    return p.length > 0 && desc.length > 0 && (p.includes(desc) || desc.includes(p));
  };
  const amtMatch = a => Math.abs(a - amount) < 0.01;

  const templates = state.recurring.filter(r => {
    const freqOk = !frequency || r.frequency === frequency;
    return freqOk && (nameMatch(r.payee) || (amtMatch(r.amount) && r.accountId === accountId && r.direction === direction));
  });

  const suggestions = state.suggestions.filter(s =>
    (s.status === 'pending' || s.status === 'accepted') &&
    (nameMatch(s.payee) || amtMatch(s.amount))
  );

  return { templates, suggestions };
}

// Check if a manual transaction is a near-duplicate of one already in the ledger
// (same account, direction, amount within £0.01, within 3 days).
function findRecentDuplicate(transactions, { accountId, direction, amount, date }) {
  if (!amount || amount <= 0 || direction === 'transfer') return null;
  const d = new Date(date);
  d.setDate(d.getDate() - 3);
  const cutoff = d.toISOString().slice(0, 10);
  return transactions.find(t =>
    t.accountId === accountId &&
    t.direction === direction &&
    Math.abs(t.amount - amount) < 0.01 &&
    t.date >= cutoff &&
    t.date <= date
  ) || null;
}

// ─── Transfer linking helpers ─────────────────────────────────
// Score how well 'candidate' matches 'txn' as the other side of a transfer.
// Returns -1 if invalid (same account), otherwise 0–5.
function scoreTransferMatch(txn, candidate) {
  if (candidate.accountId === txn.accountId) return -1;
  let score = 0;
  if (candidate.amount === txn.amount) score += 3;
  const dayDiff = Math.abs((new Date(candidate.date) - new Date(txn.date)) / 86400000);
  if (dayDiff === 0) score += 2;
  else if (dayDiff <= 1) score += 1;
  else if (dayDiff <= 2) score += 0.5;
  return score;
}

// Return the top-5 link candidates for a given unlinked transfer transaction.
function findTransferCandidates(transactions, txn) {
  const oppositeDir = txn.direction === 'expense' ? 'income' : 'expense';
  return transactions
    .filter(t =>
      t.id !== txn.id &&
      t.categoryId === 'cat-transfer' &&
      !t.transferToId &&
      t.direction === oppositeDir &&
      t.accountId !== txn.accountId
    )
    .map(t => ({ ...t, _score: scoreTransferMatch(txn, t) }))
    .filter(t => t._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);
}

const selectStyle = {
  border: 'none', outline: 'none', background: 'transparent',
  fontSize: 15, color: 'var(--c-ocean-teal)', fontWeight: 500,
  textAlign: 'right', appearance: 'none', WebkitAppearance: 'none',
  padding: '0 4px',
};

function SheetField({ label, value, children, last }) {
  return (
    <div style={{
      padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: last ? 'none' : '1px solid var(--c-border)',
    }}>
      <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--c-ocean-teal)', fontSize: 15, fontWeight: 500 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Add Account sheet ───────────────────────────────────────
function AddAccountSheet() {
  const { dispatch } = useBappy();
  const route = useRoute();

  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('current');
  const [balance, setBalance] = React.useState('');
  const [last4, setLast4] = React.useState('');
  const [limit, setLimit] = React.useState('');
  const [apr, setApr] = React.useState('');
  const [principal, setPrincipal] = React.useState('');
  const [repaymentAmount, setRepaymentAmount] = React.useState('');
  const [numPayments, setNumPayments] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  const isCard = type === 'credit_card';
  const isLoan = type === 'loan';
  const isCash = type === 'current' || type === 'savings';

  const canSave = name.trim().length > 0 && balance !== '';

  const handleSave = () => {
    if (!canSave) return;
    const bal = parseFloat(balance) || 0;
    dispatch({
      type: 'ADD_ACCOUNT',
      account: {
        name: name.trim(),
        type,
        balance: isCard || isLoan ? -Math.abs(bal) : bal,
        ...(isCash  && { last4: last4.trim() || '0000' }),
        ...(isCard  && { limit: parseFloat(limit) || 0, apr: parseFloat(apr) || 0 }),
        ...(isLoan  && {
          principal: parseFloat(principal) || Math.abs(bal),
          apr: parseFloat(apr) || 0,
          repaymentAmount: parseFloat(repaymentAmount) || 0,
          numPayments: parseInt(numPayments, 10) || 0,
          startDate: startDate || null,
          endDate: endDate || null,
        }),
      },
    });
    route.closeSheet();
  };

  const fieldStyle = {
    width: '100%', border: 'none', outline: 'none', background: 'transparent',
    fontSize: 15, color: 'var(--c-ocean-teal)', fontWeight: 500,
    textAlign: 'right', padding: 0,
  };

  const TYPE_LABELS = { current: 'Current account', savings: 'Savings', credit_card: 'Credit card', loan: 'Loan / mortgage' };

  return (
    <div>
      <Segmented
        options={[
          { value: 'current',     label: 'Current' },
          { value: 'savings',     label: 'Savings' },
          { value: 'credit_card', label: 'Credit card' },
          { value: 'loan',        label: 'Loan' },
        ]}
        value={type}
        onChange={setType}
      />

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Card padding={0}>
          <SheetField label="Account name">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={TYPE_LABELS[type]}
              style={fieldStyle}
            />
          </SheetField>
          <SheetField label={isCard ? 'Current balance owed' : isLoan ? 'Outstanding balance' : 'Current balance'}>
            <span style={{ color: 'var(--c-slate-mute)', fontSize: 14, marginRight: 2 }}>£</span>
            <input
              type="number"
              inputMode="decimal"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              placeholder="0.00"
              style={{ ...fieldStyle, width: 90 }}
            />
          </SheetField>
          {isCash && (
            <SheetField label="Last 4 digits" last>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={last4}
                onChange={e => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                style={{ ...fieldStyle, width: 60 }}
              />
            </SheetField>
          )}
          {isCard && (
            <>
              <SheetField label="Credit limit">
                <span style={{ color: 'var(--c-slate-mute)', fontSize: 14, marginRight: 2 }}>£</span>
                <input type="number" inputMode="decimal" value={limit} onChange={e => setLimit(e.target.value)} placeholder="0" style={{ ...fieldStyle, width: 90 }} />
              </SheetField>
              <SheetField label="APR %" last>
                <input type="number" inputMode="decimal" value={apr} onChange={e => setApr(e.target.value)} placeholder="0.0" style={{ ...fieldStyle, width: 60 }} />
                <span style={{ color: 'var(--c-slate-mute)', fontSize: 14 }}>%</span>
              </SheetField>
            </>
          )}
          {isLoan && (
            <>
              <SheetField label="Original principal">
                <span style={{ color: 'var(--c-slate-mute)', fontSize: 14, marginRight: 2 }}>£</span>
                <input type="number" inputMode="decimal" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="0" style={{ ...fieldStyle, width: 90 }} />
              </SheetField>
              <SheetField label="Interest rate %">
                <input type="number" inputMode="decimal" value={apr} onChange={e => setApr(e.target.value)} placeholder="0.0" style={{ ...fieldStyle, width: 60 }} />
                <span style={{ color: 'var(--c-slate-mute)', fontSize: 14 }}>%</span>
              </SheetField>
              <SheetField label="Monthly repayment">
                <span style={{ color: 'var(--c-slate-mute)', fontSize: 14, marginRight: 2 }}>£</span>
                <input type="number" inputMode="decimal" value={repaymentAmount} onChange={e => setRepaymentAmount(e.target.value)} placeholder="0.00" style={{ ...fieldStyle, width: 90 }} />
              </SheetField>
              <SheetField label="Number of payments">
                <input type="number" inputMode="numeric" value={numPayments} onChange={e => setNumPayments(e.target.value)} placeholder="0" style={{ ...fieldStyle, width: 60 }} />
              </SheetField>
              <SheetField label="Start date">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...fieldStyle, width: 'auto' }} />
              </SheetField>
              <SheetField label="End date" last>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...fieldStyle, width: 'auto' }} />
              </SheetField>
            </>
          )}
        </Card>

        <Button variant="primary" full size="lg" onClick={handleSave} disabled={!canSave}>
          Add {TYPE_LABELS[type]}
        </Button>
      </div>
    </div>
  );
}

// ─── Edit Transaction sheet ──────────────────────────────────
function EditTransactionSheet({ txnId }) {
  const { state, dispatch } = useBappy();
  const route = useRoute();
  const txn = state.transactions.find(t => t.id === txnId);
  if (!txn) return <div style={{ padding: 24, color: 'var(--c-slate-mute)' }}>Transaction not found.</div>;

  const isTransfer = txn.direction === 'transfer' || txn.direction === 'transfer-in';
  // Unlinked: categorised as Transfer but not yet paired with another account's transaction
  const isUnlinkedTransfer = txn.categoryId === 'cat-transfer' && !txn.transferToId &&
    (txn.direction === 'expense' || txn.direction === 'income');

  const [direction, setDirection] = React.useState(isTransfer ? txn.direction : txn.direction);
  const [amount, setAmount]       = React.useState(txn.amount.toFixed(2));
  const [accountId, setAccountId] = React.useState(txn.accountId);
  const [categoryId, setCategoryId] = React.useState(txn.categoryId || 'cat-other');
  const [description, setDescription] = React.useState(txn.description || '');
  const [date, setDate]           = React.useState(txn.date);
  const [showRecur, setShowRecur]         = React.useState(false);
  const [recurFreq, setRecurFreq]         = React.useState('monthly');
  const [recurConflict, setRecurConflict] = React.useState(null);  // { templates, suggestions } | null

  const amt = parseFloat(amount) || 0;
  const acc = state.accounts.find(a => a.id === accountId);

  const handleSave = () => {
    if (amt <= 0) return;
    dispatch({
      type: 'UPDATE_TRANSACTION',
      id: txnId,
      patch: { amount: amt, direction, accountId, categoryId, description: description || 'Transaction', date },
    });
    route.closeSheet();
  };

  const handleDelete = () => {
    if (confirm('Delete this transaction?')) {
      dispatch({ type: 'DELETE_TRANSACTION', id: txnId });
      route.closeSheet();
    }
  };

  // Transfers: simplified — only allow editing description & date
  if (isTransfer) {
    const otherAcc = state.accounts.find(a => a.id === txn.transferToId);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card padding={12} style={{ background: 'var(--c-ice-wash)', border: '1px solid var(--c-haze-teal)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="swap" size={18} color="var(--c-ocean-teal)" style={{ marginTop: 1 }} />
            <div style={{ fontSize: 13, color: 'var(--c-slate)', lineHeight: 1.5 }}>
              Transfer {txn.direction === 'transfer' ? `from ${acc?.name} → ${otherAcc?.name}` : `into ${acc?.name}`}
              <span className="tnum" style={{ display: 'block', fontWeight: 500, color: 'var(--c-deep-ink)' }}>{BappyUtil.fmtGBP(txn.amount)}</span>
            </div>
          </div>
        </Card>
        <Card padding={0}>
          <SheetField label="Date" value={BappyUtil.fmtDateShort(date)} last>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={selectStyle} />
          </SheetField>
        </Card>
        <Card padding={12}>
          <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 6 }}>Note</div>
          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Move spare cash to savings"
            style={{ width: '100%', border: 'none', outline: 'none', fontSize: 16, color: 'var(--c-deep-ink)', background: 'transparent', padding: 0 }} />
        </Card>
        <Button variant="primary" full size="lg" onClick={handleSave}>Save changes</Button>
        <button onClick={handleDelete} style={{ padding: '12px', color: 'var(--c-coral)', fontSize: 14, fontWeight: 500, textAlign: 'center', width: '100%' }}>
          Delete transaction
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Unlinked transfer: link panel ── */}
      {isUnlinkedTransfer && (() => {
        const candidates = findTransferCandidates(state.transactions, txn);
        return (
          <div style={{ marginBottom: 16 }}>
            <Card padding={12} style={{ background: 'rgba(244,165,53,0.08)', border: '1px solid rgba(244,165,53,0.30)', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Icon name="swap" size={16} color="var(--c-amber)" style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--c-slate)', lineHeight: 1.5 }}>
                  This transaction is categorised as <strong>Transfer</strong>. Link it to the matching entry in another account to avoid double-counting.
                </span>
              </div>
            </Card>
            {candidates.length === 0 ? (
              <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--c-slate-mute)', textAlign: 'center' }}>
                No matching transfer transactions found in other accounts yet.
              </div>
            ) : (
              <Card padding={0}>
                {candidates.map((c, i) => {
                  const cAcc = state.accounts.find(a => a.id === c.accountId);
                  return (
                    <div key={c.id} style={{
                      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
                      borderBottom: i < candidates.length - 1 ? '1px solid var(--c-border)' : 'none',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-deep-ink)' }}>
                          {cAcc?.name || 'Unknown account'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 2 }}>
                          {BappyUtil.fmtDateShort(c.date)} · {c.description}
                          {c._score >= 5 && <span style={{ marginLeft: 5, fontSize: 10, padding: '1px 5px', borderRadius: 999, background: 'rgba(3,188,165,0.12)', color: 'var(--c-seafoam)', fontWeight: 600 }}>Exact match</span>}
                        </div>
                      </div>
                      <span className="tnum" style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-deep-ink)', flexShrink: 0 }}>
                        {BappyUtil.fmtGBP(c.amount)}
                      </span>
                      <button
                        onClick={() => {
                          // outId = expense (the sender), inId = income (the receiver)
                          const outId = txn.direction === 'expense' ? txn.id : c.id;
                          const inId  = txn.direction === 'income'  ? txn.id : c.id;
                          dispatch({ type: 'LINK_TRANSFER', outId, inId });
                          route.closeSheet();
                        }}
                        style={{
                          padding: '6px 12px', borderRadius: 999, flexShrink: 0,
                          background: 'var(--c-ocean-teal)', color: '#fff',
                          fontSize: 13, fontWeight: 600,
                        }}
                      >
                        Link
                      </button>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        );
      })()}

      {/* Direction */}
      <Segmented
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income',  label: 'Income' },
        ]}
        value={direction}
        onChange={setDirection}
      />

      {/* Amount display */}
      <div style={{ marginTop: 24, padding: '20px 16px', background: 'var(--c-snow-mist)', borderRadius: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', textTransform: 'uppercase', letterSpacing: 1.2 }}>Amount</div>
        <div className="tnum" style={{ fontSize: 48, fontWeight: 300, color: 'var(--c-deep-ink)', marginTop: 6, letterSpacing: -1, lineHeight: 1 }}>
          <span style={{ color: 'var(--c-haze-teal)' }}>£</span>{amount || '0.00'}
        </div>
      </div>

      {/* Number pad */}
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
          <button key={k} onClick={() => {
            if (k === '⌫') setAmount(s => s.slice(0, -1));
            else if (k === '.' && amount.includes('.')) return;
            else setAmount(s => (s + k).slice(0, 10));
          }} style={{
            height: 48, background: '#fff', border: '1px solid var(--c-border)',
            borderRadius: 12, fontSize: 22, fontWeight: 400,
            color: 'var(--c-deep-ink)', fontFamily: 'Roboto Mono',
          }}>{k}</button>
        ))}
      </div>

      {/* Fields */}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Card padding={0}>
          <SheetField label="Account" value={acc?.name}>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} style={selectStyle}>
              {state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </SheetField>
          <SheetField label="Category" value={state.categories.find(c => c.id === categoryId)?.name}>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={selectStyle}>
              {state.categories.filter(c => c.id !== 'cat-transfer').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </SheetField>
          <SheetField label="Date" value={BappyUtil.fmtDateShort(date)} last>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={selectStyle} />
          </SheetField>
        </Card>

        <Card padding={12}>
          <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 6 }}>Description</div>
          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Tesco"
            style={{ width: '100%', border: 'none', outline: 'none', fontSize: 16, color: 'var(--c-deep-ink)', background: 'transparent', padding: 0 }} />
        </Card>

        <Button variant="primary" full size="lg" onClick={handleSave} disabled={amt <= 0}>
          Save changes
        </Button>

        {/* Mark as recurring */}
        {showRecur ? (
          <Card padding={14} style={{ border: '1px solid var(--c-haze-teal)', background: 'rgba(2,168,185,0.04)' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-deep-ink)', marginBottom: 10 }}>
              Create recurring template
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginBottom: 8 }}>
              This will save the transaction and create a recurring schedule for it.
            </div>
            <Segmented
              options={[
                { value: 'weekly',   label: 'Weekly' },
                { value: 'monthly',  label: 'Monthly' },
                { value: 'annually', label: 'Annually' },
              ]}
              value={recurFreq} onChange={setRecurFreq}
            />
            {/* Conflict warning — shown after first "Set as recurring" attempt */}
            {recurConflict && (recurConflict.templates.length > 0 || recurConflict.suggestions.length > 0) && (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(244,165,53,0.10)', border: '1px solid rgba(244,165,53,0.30)' }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                  <Icon name="warn" size={14} color="var(--c-amber)" style={{ marginTop: 1, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: 'var(--c-slate)', lineHeight: 1.5 }}>
                    <strong>Similar template already exists:</strong>
                    {recurConflict.templates.map(r => (
                      <div key={r.id}>↻ {r.payee} · {BappyUtil.fmtGBP(r.amount)} · {r.frequency}</div>
                    ))}
                    {recurConflict.suggestions.map(s => (
                      <div key={s.id}>⚑ Detected: {s.payee} · {BappyUtil.fmtGBP(s.amount)}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => { setShowRecur(false); setRecurConflict(null); }} style={{
                flex: 1, padding: '10px', borderRadius: 10,
                background: 'var(--c-ice-wash)', color: 'var(--c-slate)',
                fontSize: 13, fontWeight: 500,
              }}>Cancel</button>
              <button onClick={() => {
                if (amt <= 0) return;
                // Check for conflicts on first attempt; allow override on second
                if (!recurConflict) {
                  const conflicts = findRecurringConflicts(state, {
                    description: description || 'Transaction',
                    amount: amt, accountId, direction, frequency: recurFreq,
                  });
                  if (conflicts.templates.length > 0 || conflicts.suggestions.length > 0) {
                    setRecurConflict(conflicts);
                    return; // show warning — user must tap again to confirm
                  }
                }
                // No conflict, or user confirmed — proceed
                dispatch({
                  type: 'UPDATE_TRANSACTION', id: txnId,
                  patch: { amount: amt, direction, accountId, categoryId, description: description || 'Transaction', date, type: 'recurring' },
                });
                dispatch({
                  type: 'ADD_RECURRING',
                  rec: {
                    payee:     description || 'Transaction',
                    accountId, amount: amt, direction,
                    frequency: recurFreq,
                    anchorDay: new Date(date).getUTCDate(),
                    categoryId, active: true, source: 'manual',
                    nextDue:  date, baseline: amt,
                  },
                });
                route.closeSheet();
              }} style={{
                flex: 2, padding: '10px', borderRadius: 10,
                background: recurConflict ? 'var(--c-amber)' : 'var(--c-ocean-teal)',
                color: '#fff', fontSize: 13, fontWeight: 500,
              }}>{recurConflict ? 'Create anyway' : 'Set as recurring'}</button>
            </div>
          </Card>
        ) : (
          <button onClick={() => setShowRecur(true)} style={{
            padding: '12px', color: 'var(--c-ocean-teal)', fontSize: 14,
            fontWeight: 500, textAlign: 'center', width: '100%',
          }}>↻ Mark as recurring</button>
        )}

        <button onClick={handleDelete} style={{ padding: '12px', color: 'var(--c-coral)', fontSize: 14, fontWeight: 500, textAlign: 'center', width: '100%' }}>
          Delete transaction
        </button>
      </div>
    </div>
  );
}

// ─── Edit Account sheet ───────────────────────────────────────
function EditAccountSheet({ accountId }) {
  const { state, dispatch } = useBappy();
  const route = useRoute();
  const account = state.accounts.find(a => a.id === accountId);
  if (!account) return <div style={{ padding: 24, color: 'var(--c-slate-mute)' }}>Account not found.</div>;

  const type = account.type;
  const isCard = type === 'credit_card';
  const isLoan = type === 'loan';
  const isCash = type === 'current' || type === 'savings';
  const TYPE_LABELS = { current: 'Current account', savings: 'Savings', credit_card: 'Credit card', loan: 'Loan / mortgage' };

  const [name, setName]                       = React.useState(account.name);
  const [balance, setBalance]                 = React.useState(String(Math.abs(account.balance)));
  const [last4, setLast4]                     = React.useState(account.last4 || '');
  const [limit, setLimit]                     = React.useState(String(account.limit || ''));
  const [apr, setApr]                         = React.useState(String(account.apr || ''));
  const [principal, setPrincipal]             = React.useState(String(account.principal || ''));
  const [repaymentAmount, setRepaymentAmount] = React.useState(String(account.repaymentAmount || ''));
  const [numPayments, setNumPayments]         = React.useState(String(account.numPayments || ''));
  const [startDate, setStartDate]             = React.useState(account.startDate || '');
  const [endDate, setEndDate]                 = React.useState(account.endDate || '');

  const fieldStyle = {
    width: '100%', border: 'none', outline: 'none', background: 'transparent',
    fontSize: 15, color: 'var(--c-ocean-teal)', fontWeight: 500,
    textAlign: 'right', padding: 0,
  };

  const canSave = name.trim().length > 0 && balance !== '';

  const handleSave = () => {
    if (!canSave) return;
    const bal = parseFloat(balance) || 0;
    dispatch({
      type: 'UPDATE_ACCOUNT',
      id: accountId,
      patch: {
        name: name.trim(),
        balance: isCard || isLoan ? -Math.abs(bal) : bal,
        ...(isCash && { last4: last4.trim() || '0000' }),
        ...(isCard && { limit: parseFloat(limit) || 0, apr: parseFloat(apr) || 0 }),
        ...(isLoan && {
          principal: parseFloat(principal) || Math.abs(bal),
          apr: parseFloat(apr) || 0,
          repaymentAmount: parseFloat(repaymentAmount) || 0,
          numPayments: parseInt(numPayments, 10) || 0,
          startDate: startDate || null,
          endDate: endDate || null,
        }),
      },
    });
    route.closeSheet();
  };

  const txnCount = state.transactions.filter(t => t.accountId === accountId).length;

  const handleDelete = () => {
    if (confirm(`Delete "${account.name}"? This will also remove ${txnCount} transaction${txnCount !== 1 ? 's' : ''}. This cannot be undone.`)) {
      dispatch({ type: 'DELETE_ACCOUNT', id: accountId });
      route.closeSheet();
      route.pop();
    }
  };

  return (
    <div>
      {/* Type badge (read-only) */}
      <div style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: 'var(--c-ice-wash)', fontSize: 12, color: 'var(--c-slate-mute)', fontWeight: 500, marginBottom: 16 }}>
        {TYPE_LABELS[type]}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Card padding={0}>
          <SheetField label="Account name">
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder={TYPE_LABELS[type]} style={fieldStyle} />
          </SheetField>
          <SheetField label={isCard ? 'Balance owed' : isLoan ? 'Outstanding balance' : 'Current balance'}>
            <span style={{ color: 'var(--c-slate-mute)', fontSize: 14, marginRight: 2 }}>£</span>
            <input type="number" inputMode="decimal" value={balance}
              onChange={e => setBalance(e.target.value)} placeholder="0.00"
              style={{ ...fieldStyle, width: 100 }} />
          </SheetField>
          {isCash && (
            <SheetField label="Last 4 digits" last>
              <input type="text" inputMode="numeric" maxLength={4} value={last4}
                onChange={e => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234" style={{ ...fieldStyle, width: 60 }} />
            </SheetField>
          )}
          {isCard && (<>
            <SheetField label="Credit limit">
              <span style={{ color: 'var(--c-slate-mute)', fontSize: 14, marginRight: 2 }}>£</span>
              <input type="number" inputMode="decimal" value={limit}
                onChange={e => setLimit(e.target.value)} placeholder="0"
                style={{ ...fieldStyle, width: 90 }} />
            </SheetField>
            <SheetField label="APR %" last>
              <input type="number" inputMode="decimal" value={apr}
                onChange={e => setApr(e.target.value)} placeholder="0.0"
                style={{ ...fieldStyle, width: 60 }} />
              <span style={{ color: 'var(--c-slate-mute)', fontSize: 14 }}>%</span>
            </SheetField>
          </>)}
          {isLoan && (<>
            <SheetField label="Original principal">
              <span style={{ color: 'var(--c-slate-mute)', fontSize: 14, marginRight: 2 }}>£</span>
              <input type="number" inputMode="decimal" value={principal}
                onChange={e => setPrincipal(e.target.value)} placeholder="0"
                style={{ ...fieldStyle, width: 90 }} />
            </SheetField>
            <SheetField label="Interest rate %">
              <input type="number" inputMode="decimal" value={apr}
                onChange={e => setApr(e.target.value)} placeholder="0.0"
                style={{ ...fieldStyle, width: 60 }} />
              <span style={{ color: 'var(--c-slate-mute)', fontSize: 14 }}>%</span>
            </SheetField>
            <SheetField label="Monthly repayment">
              <span style={{ color: 'var(--c-slate-mute)', fontSize: 14, marginRight: 2 }}>£</span>
              <input type="number" inputMode="decimal" value={repaymentAmount}
                onChange={e => setRepaymentAmount(e.target.value)} placeholder="0.00"
                style={{ ...fieldStyle, width: 90 }} />
            </SheetField>
            <SheetField label="Number of payments">
              <input type="number" inputMode="numeric" value={numPayments}
                onChange={e => setNumPayments(e.target.value)} placeholder="0"
                style={{ ...fieldStyle, width: 60 }} />
            </SheetField>
            <SheetField label="Start date">
              <input type="date" value={startDate}
                onChange={e => setStartDate(e.target.value)} style={{ ...fieldStyle, width: 'auto' }} />
            </SheetField>
            <SheetField label="End date" last>
              <input type="date" value={endDate}
                onChange={e => setEndDate(e.target.value)} style={{ ...fieldStyle, width: 'auto' }} />
            </SheetField>
          </>)}
        </Card>

        {(isCard || isLoan) && (
          <Card padding={10} style={{ background: 'var(--c-amber-tint)', border: '1px solid #f0d58a' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Icon name="info" size={14} color="var(--c-amber)" style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--c-slate)', lineHeight: 1.5 }}>
                Enter the current outstanding balance as a positive number — Bappy stores it as negative internally.
              </span>
            </div>
          </Card>
        )}

        <Button variant="primary" full size="lg" onClick={handleSave} disabled={!canSave}>
          Save changes
        </Button>
        <button onClick={handleDelete} style={{ padding: '12px', color: 'var(--c-coral)', fontSize: 14, fontWeight: 500, textAlign: 'center', width: '100%' }}>
          Delete account{txnCount > 0 ? ` & ${txnCount} transaction${txnCount !== 1 ? 's' : ''}` : ''}
        </button>
      </div>
    </div>
  );
}

// ─── Link Transfers sheet ────────────────────────────────────
function LinkTransfersSheet() {
  const { state, dispatch } = useBappy();
  const route = useRoute();

  const unlinked = state.transactions.filter(t =>
    t.categoryId === 'cat-transfer' && !t.transferToId &&
    (t.direction === 'expense' || t.direction === 'income')
  );

  // Build rows: each unlinked txn paired with its best candidate (if any)
  const rows = unlinked.map(txn => {
    const candidates = findTransferCandidates(state.transactions, txn);
    return { txn, best: candidates[0] || null };
  });

  // Exact matches: score >= 5 (exact amount + same date)
  const exactPairs = rows
    .filter(r => r.best && r.best._score >= 5)
    .reduce((acc, r) => {
      // Deduplicate — each pair appears once (expense side owns it)
      if (r.txn.direction === 'expense') acc.push(r);
      return acc;
    }, []);

  const handleLink = (outId, inId) => {
    dispatch({ type: 'LINK_TRANSFER', outId, inId });
  };

  const handleLinkAll = () => {
    exactPairs.forEach(({ txn, best }) => {
      const outId = txn.direction === 'expense' ? txn.id : best.id;
      const inId  = txn.direction === 'income'  ? txn.id : best.id;
      dispatch({ type: 'LINK_TRANSFER', outId, inId });
    });
  };

  if (unlinked.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-slate-mute)' }}>
        <Icon name="check" size={32} color="var(--c-seafoam)" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--c-deep-ink)' }}>All transfers linked</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Bulk action */}
      {exactPairs.length > 0 && (
        <Card padding={12} style={{ background: 'rgba(3,188,165,0.08)', border: '1px solid var(--c-haze-teal)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--c-slate)', lineHeight: 1.4 }}>
              <strong style={{ color: 'var(--c-deep-ink)' }}>{exactPairs.length} exact match{exactPairs.length !== 1 ? 'es' : ''}</strong>
              {' '}found — same date &amp; amount.
            </div>
            <button
              onClick={handleLinkAll}
              style={{
                padding: '8px 14px', borderRadius: 999, flexShrink: 0,
                background: 'var(--c-ocean-teal)', color: '#fff',
                fontSize: 13, fontWeight: 600,
              }}
            >
              Link all
            </button>
          </div>
        </Card>
      )}

      {/* Per-transaction rows */}
      <Card padding={0}>
        {rows.map(({ txn, best }, i) => {
          const acc = state.accounts.find(a => a.id === txn.accountId);
          const bestAcc = best ? state.accounts.find(a => a.id === best.accountId) : null;
          const isExact = best?._score >= 5;
          const outId = txn.direction === 'expense' ? txn.id : best?.id;
          const inId  = txn.direction === 'income'  ? txn.id : best?.id;

          return (
            <div key={txn.id} style={{
              padding: '12px 14px',
              borderBottom: i < rows.length - 1 ? '1px solid var(--c-border)' : 'none',
            }}>
              {/* This transaction */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: best ? 8 : 0 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-deep-ink)' }}>{acc?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 1 }}>
                    {BappyUtil.fmtDateShort(txn.date)} · {txn.description}
                  </div>
                </div>
                <span className="tnum" style={{ fontSize: 13, fontWeight: 500, color: txn.direction === 'expense' ? 'var(--c-coral)' : 'var(--c-seafoam)' }}>
                  {txn.direction === 'expense' ? '−' : '+'}{BappyUtil.fmtGBP(txn.amount)}
                </span>
              </div>

              {/* Best candidate */}
              {best ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8,
                  background: isExact ? 'rgba(3,188,165,0.07)' : 'var(--c-snow-mist)',
                  border: `1px solid ${isExact ? 'rgba(3,188,165,0.25)' : 'var(--c-border)'}`,
                }}>
                  <Icon name="swap" size={13} color={isExact ? 'var(--c-seafoam)' : 'var(--c-slate-mute)'} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-deep-ink)' }}>{bestAcc?.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-slate-mute)' }}>{BappyUtil.fmtDateShort(best.date)}</div>
                  </div>
                  {isExact && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'rgba(3,188,165,0.15)', color: 'var(--c-seafoam)', fontWeight: 600, flexShrink: 0 }}>
                      Exact
                    </span>
                  )}
                  <button
                    onClick={() => handleLink(outId, inId)}
                    style={{
                      padding: '5px 12px', borderRadius: 999, flexShrink: 0,
                      background: 'var(--c-ocean-teal)', color: '#fff',
                      fontSize: 12, fontWeight: 600,
                    }}
                  >
                    Link
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', fontStyle: 'italic' }}>
                  No matching transfer found in other accounts
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

export { AccountsScreen, AccountDetailScreen, LedgerScreen, AddTransactionSheet, AddAccountSheet, EditTransactionSheet, EditAccountSheet, LinkTransfersSheet };
