import React from 'react'
import { BAPPY_SEED, BappyUtil, useBappy, BappyContext, BappyAuthContext, BappyProvider, useBappyAuth, BappyAuthProvider } from './bappy-state.jsx'
import { getToken, sendGmailMessage } from './google-auth.js'
import { Icon, BappyLogo, ICON_PATHS } from './bappy-icons.jsx'
import { IconContainer, Card, Tag, ProgressBar, Button, Sheet, SectionHeader, ListRow, SeverityDot, ChannelPill, EmptyState, Toggle, Segmented, Stepper, tintBg } from './bappy-primitives.jsx'
import { chartPalette, Sparkline, AreaChart, Donut, BarChart, StackedDebtChart, DebtCurve } from './bappy-charts.jsx'
import { BappyRouter, BappyRouteContext, useRoute, ScreenHeader, TabBar, FAB } from './bappy-nav.jsx'
// Bappy — More tab: settings hub, nudge rules editor

// ─── Import helpers ──────────────────────────────────────────
function parseCSVText(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const pushField = () => { row.push(field.trim()); field = ''; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') pushField();
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        pushField();
        if (row.some(Boolean)) rows.push(row);
        row = [];
      } else field += ch;
    }
  }
  pushField();
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function parseDateStr(s) {
  if (!s) return null;
  s = String(s).trim();

  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Any slash-separated date: n1/n2/year (2- or 4-digit year)
  // Handles: DD/MM/YYYY (UK), M/D/YY (US credit card), M/D/YYYY, D/M/YY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const [, f1, f2, yr] = slash;
    const year = yr.length === 2 ? (parseInt(yr, 10) >= 50 ? '19' : '20') + yr : yr;
    const n1 = parseInt(f1, 10), n2 = parseInt(f2, 10);
    let month, day;
    if (n2 > 12) {
      // f2 can only be a day → M/D format (US)
      month = f1; day = f2;
    } else if (n1 > 12) {
      // f1 can only be a day → D/M format (UK)
      day = f1; month = f2;
    } else if (yr.length === 4) {
      // 4-digit year, both ≤ 12: assume UK DD/MM/YYYY
      day = f1; month = f2;
    } else {
      // 2-digit year, both ≤ 12: assume US M/D/YY (credit card exports)
      month = f1; day = f2;
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // DD Mon YY  e.g. "20 May 26"
  const MONTHS = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
  const monYY = s.match(/^(\d{1,2}) (\w{3}) (\d{2,4})$/);
  if (monYY && MONTHS[monYY[2]]) {
    const year = monYY[3].length === 2 ? '20' + monYY[3] : monYY[3];
    return `${year}-${String(MONTHS[monYY[2]]).padStart(2,'0')}-${monYY[1].padStart(2,'0')}`;
  }

  // Excel serial date (number stored as string)
  const serial = parseFloat(s);
  if (!isNaN(serial) && serial > 40000) {
    const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function isLikelyHeader(row) {
  const dateRe = /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/;
  const numRe  = /^-?\d+\.?\d*$/;
  const textCount = row.filter(c => c && !dateRe.test(c.trim()) && !numRe.test(c.trim())).length;
  return textCount >= Math.ceil(row.length / 2);
}

function autoDetectMapping(headers) {
  const h = headers.map(h => h.toLowerCase());
  const find = (...terms) => {
    const i = h.findIndex(col => terms.some(t => col.includes(t)));
    return i >= 0 ? i : null;
  };
  return {
    date:        find('date'),
    description: find('memo', 'desc', 'narrat', 'particular', 'detail', 'ref'),
    amount:      find('amount', 'value', 'sum'),
    debit:       h.findIndex(c => c === 'debit'),
    credit:      h.findIndex(c => c === 'credit'),
    category:    find('categ', 'type', 'label', 'tag', 'class'),
  };
}

function mapRow(r, mapping, accountId, defaultCategoryId = 'cat-other', categories = []) {
  let amount;
  if (mapping.amount != null && mapping.amount >= 0) {
    amount = parseFloat(String(r[mapping.amount] || '').replace(/[£,\s]/g, '')) || null;
  } else if (mapping.debit >= 0 || mapping.credit >= 0) {
    const debit  = parseFloat(String(r[mapping.debit]  || '').replace(/[£,\s]/g, '')) || 0;
    const credit = parseFloat(String(r[mapping.credit] || '').replace(/[£,\s]/g, '')) || 0;
    amount = credit > 0 ? credit : (debit > 0 ? -debit : null);
  }
  if (amount == null || amount === 0) return null;
  const date = parseDateStr(mapping.date >= 0 ? r[mapping.date] : null);
  if (!date) return null;
  const description = (mapping.description >= 0 ? r[mapping.description] : '') || '';

  // Resolve category: try to match the cell value to a known category name (case-insensitive),
  // fall back to defaultCategoryId when no column is mapped or no name matches.
  let resolvedCategoryId = defaultCategoryId;
  let categoryFromFile = false;
  if (mapping.category != null && mapping.category >= 0) {
    const cellVal = String(r[mapping.category] || '').trim().toLowerCase();
    if (cellVal) {
      const match = categories.find(c => c.name.toLowerCase() === cellVal);
      if (match) { resolvedCategoryId = match.id; categoryFromFile = true; }
    }
  }

  return {
    date, amount: Math.abs(amount),
    direction: amount >= 0 ? 'income' : 'expense',
    description: description.trim() || (amount >= 0 ? 'Income' : 'Expense'),
    accountId, categoryId: resolvedCategoryId,
    _categoryFromFile: categoryFromFile,   // preview-only flag, not persisted
    type: 'one_off', status: 'posted',
    recurrenceTemplateId: null, transferToId: null,
  };
}

function MoreHomeScreen() {
  const { state, dispatch } = useBappy();
  const route = useRoute();
  const auth = useBappyAuth();
  const activeRules = state.nudgeRules.filter(r => r.active).length;
  const s = state.settings;
  const nudgeTypes = state.nudgeTypePrefs || DEFAULT_NUDGE_TYPES;
  const enabledTypes = nudgeTypes.filter(n => n.enabled).length;
  const pushDevices = state.pushDevices || DEFAULT_PUSH_DEVICES;

  return (
    <div style={{ paddingBottom: 120 }}>
      <ScreenHeader title="More" subtitle="Settings & data" />

      {/* Profile card */}
      <div style={{ padding: '0 16px 8px' }}>
        <Card padding={14}
          onClick={() => route.push('more-profile')}
          style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 999,
            background: 'linear-gradient(135deg, #02A8B9 0%, #03BCA5 100%)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 500,
          }}>{(() => {
            const name = auth.user?.name || 'Sam Farrow';
            const parts = name.trim().split(/\s+/);
            return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'SF';
          })()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, color: 'var(--c-deep-ink)', fontWeight: 500 }}>
              {auth.user?.name || 'Sam Farrow'}
            </div>
            <div style={{
              fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{auth.user?.email || 'sam.farrow@gmail.com'}</div>
          </div>
          <Icon name={auth.user?.method === 'apple' ? 'logo' : 'google'} size={20} color="var(--c-slate-mute)" />
        </Card>
      </div>

      {/* Settings groups */}
      <SettingsGroup title="Profile">
        <SettingsRow icon="cog"      title="General & pay schedule"
          subtitle={
            s.payFrequency === 'monthly'
              ? `Monthly · day ${s.payAnchorDay}`
              : s.payFrequency === 'weekly'
              ? `Weekly · ${WEEKDAY_LABELS_LONG[s.payAnchorWeekday ?? 5]}s`
              : `Bi-weekly · ${WEEKDAY_LABELS_LONG[s.payAnchorWeekday ?? 5]}s`
          }
          onClick={() => route.push('more-general')} />
        <SettingsRow icon="acc-bank" title="Categories"
          subtitle={`${state.categories.length} categories`}
          onClick={() => route.push('more-categories')} />
        <SettingsRow icon="card"     title="Preferences"
          subtitle={`Forecast ${s.forecastHorizonDays}d · floor £${s.lowBalanceFloor}`}
          onClick={() => route.push('more-preferences')} last />
      </SettingsGroup>

      <SettingsGroup title="Notifications">
        <SettingsRow icon="bell"     title="Nudge types"
          subtitle={`${enabledTypes} of ${nudgeTypes.length} enabled`}
          onClick={() => route.push('more-nudge-types')} />
        <SettingsRow icon="shield"   title="Nudge rules"
          subtitle={`${activeRules} active · routing, throttling, escalation`}
          onClick={() => route.push('rules')} />
        <SettingsRow icon="ch-mail"  title="Email channel"
          subtitle={`${s.emailDigestMode[0].toUpperCase() + s.emailDigestMode.slice(1)} · ${auth.user?.email || 'sam.farrow@gmail.com'}`}
          onClick={() => route.push('more-email')} />
        <SettingsRow icon="ch-push"  title="Web Push devices"
          subtitle={`${pushDevices.length} ${pushDevices.length === 1 ? 'device' : 'devices'}`}
          onClick={() => route.push('more-push')} last />
      </SettingsGroup>

      <SettingsGroup title="Data">
        <SettingsRow icon="download" title="Excel import"
          subtitle={state.transactions.length > 0
            ? `${state.transactions.length.toLocaleString()} transaction${state.transactions.length !== 1 ? 's' : ''} in ledger`
            : 'No transactions yet'}
          onClick={() => route.openSheet({ kind: 'import' })} />
        {state.lastImport && (
          <ListRow
            icon={<IconContainer glyph="refresh" tint="#E8566A" size={32} />}
            title="Undo last import"
            subtitle={`${state.lastImport.count} rows · ${state.lastImport.filename || 'unknown file'} · ${BappyUtil.fmtDateShort(state.lastImport.date)}`}
            trailing={<Icon name="chev-right" size={14} color="var(--c-slate-mute)" />}
            onClick={() => {
              if (confirm(`Remove the ${state.lastImport.count} transactions imported from "${state.lastImport.filename}"?\n\nAccount balances will be reversed.`)) {
                dispatch({ type: 'ROLLBACK_IMPORT' });
              }
            }}
          />
        )}
        <SettingsRow icon="acc-bank" title="Backup & export"
          subtitle="Firebase cloud sync active"
          onClick={() => route.push('more-backup')} last />
      </SettingsGroup>

      <SettingsGroup title="About">
        <SettingsRow icon="info"     title="About Bappy"
          subtitle="v0.1.0 · build f3a2c"
          onClick={() => route.push('more-about')} last />
      </SettingsGroup>

      <div style={{
        padding: '16px 16px 4px', marginTop: 8,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        <button onClick={() => {
          if (confirm('Sign out of Bappy?')) auth.signOut();
        }} style={{
          fontSize: 13, color: 'var(--c-slate)', fontWeight: 500,
          padding: '8px 16px', borderRadius: 8,
        }}>Sign out</button>
        <button onClick={() => {
          if (confirm('Reset all data?')) dispatch({ type: 'RESET' });
        }} style={{
          fontSize: 12, color: 'var(--c-coral)', fontWeight: 500,
          padding: '6px 16px', borderRadius: 8,
        }}>Reset demo data</button>
      </div>
    </div>
  );
}

// Constants the More screens use (fallbacks if not in state)
const DEFAULT_NUDGE_TYPES = [
  { id: 'budget_threshold',      label: 'Budget threshold',       sub: 'When a budget crosses 75%, 100% or projected over.', severity: 'warning', enabled: true },
  { id: 'recurring_drift',       label: 'Recurring drift',        sub: 'When a subscription jumps vs. its baseline.',          severity: 'warning', enabled: true },
  { id: 'low_balance',           label: 'Low balance',            sub: 'Current balance crosses the floor in the next 14d.',  severity: 'alert',   enabled: true },
  { id: 'payday_summary',        label: 'Payday summary',         sub: 'A morning recap on each payday.',                      severity: 'info',    enabled: true },
  { id: 'new_recurring',         label: 'New recurring detected', sub: 'A pattern looks like a subscription.',                 severity: 'info',    enabled: true },
  { id: 'debt_progress',         label: 'Debt progress',          sub: 'When a card or loan crosses a payoff milestone.',      severity: 'info',    enabled: true },
  { id: 'unusual_spend',         label: 'Unusual spend',          sub: 'A single charge much higher than your norm.',          severity: 'warning', enabled: true },
  { id: 'forecast_warning',      label: 'Forecast warning',       sub: 'Forecasted to dip below floor before payday.',         severity: 'alert',   enabled: true },
];

const DEFAULT_PUSH_DEVICES = [
  { id: 'd1', name: 'MacBook Air — Safari',  added: '2026-03-04', lastSeen: '2026-05-23' },
  { id: 'd2', name: 'iPhone 15 — Chrome',    added: '2026-04-12', lastSeen: '2026-05-24' },
];

// ─── More: Profile editor ──────────────────────────────────
function MoreProfileScreen() {
  const auth = useBappyAuth();
  const route = useRoute();
  const [name, setName] = React.useState(auth.user?.name || 'Sam Farrow');
  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="Profile" leading="back" subtitle="Account" />
      <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 84, height: 84, borderRadius: 999,
          background: 'linear-gradient(135deg, #02A8B9 0%, #03BCA5 100%)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30, fontWeight: 500,
          boxShadow: '0 8px 20px -8px rgba(2,168,185,0.5)',
        }}>{(name[0] || '?').toUpperCase()}{(name.split(' ')[1]?.[0] || '').toUpperCase()}</div>
        <button style={{
          fontSize: 13, color: 'var(--c-ocean-teal)', fontWeight: 500, padding: '4px 10px',
        }}>Change photo</button>
      </div>
      <SettingsGroup title="Identity">
        <FieldRow label="Name">
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </FieldRow>
        <FieldRow label="Email">
          <span style={{ color: 'var(--c-slate-mute)', fontSize: 14 }}>{auth.user?.email || 'sam.farrow@gmail.com'}</span>
        </FieldRow>
        <FieldRow label="Signed in via" last>
          <Tag variant="default">{auth.user?.method === 'apple' ? 'Apple' : auth.user?.method === 'email' ? 'Email code' : 'Google'}</Tag>
        </FieldRow>
      </SettingsGroup>
      <SettingsGroup title="Connected accounts">
        <ListRow icon={<IconContainer glyph="google" tint="#4285F4" size={32} />} title="Google" subtitle="Linked" trailing={<Tag variant="income">Active</Tag>} />
        <ListRow icon={<IconContainer glyph="logo" tint="#1F2C2C" size={32} />} title="Apple" subtitle="Not linked" trailing={<Tag variant="muted">Link</Tag>} last />
      </SettingsGroup>
      <div style={{ padding: 16 }}>
        <Button variant="primary" full onClick={() => {
          auth.updateUser({ name });
          route.pop();
        }}>Save changes</Button>
      </div>
    </div>
  );
}

// ─── More: General & pay schedule ─────────────────────────
function MoreGeneralScreen() {
  const { state, dispatch } = useBappy();
  const s = state.settings;
  const set = (patch) => dispatch({ type: 'UPDATE_SETTINGS', patch });
  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="General" leading="back" subtitle="Pay schedule & basics" />
      <SettingsGroup title="Pay schedule">
        <FieldRow label="Frequency">
          <Segmented
            options={[
              { value: 'weekly',  label: 'Weekly' },
              { value: 'biweekly', label: 'Bi-weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
            value={s.payFrequency}
            onChange={v => set({ payFrequency: v })}
          />
        </FieldRow>
        {s.payFrequency === 'monthly' ? (
          <FieldRow label={`Pay anchor day (${s.payAnchorDay})`} last>
            <input type="range" min="1" max="31" value={s.payAnchorDay}
              onChange={e => set({ payAnchorDay: Number(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--c-ocean-teal)' }} />
          </FieldRow>
        ) : (
          <FieldRow label="Pay weekday" last>
            <WeekdayPicker
              value={s.payAnchorWeekday ?? 5}
              onChange={v => set({ payAnchorWeekday: v })}
            />
          </FieldRow>
        )}
      </SettingsGroup>
      <SettingsGroup title="Locale">
        <FieldRow label="Currency">
          <Segmented
            options={[
              { value: 'GBP', label: '£ GBP' },
              { value: 'EUR', label: '€ EUR' },
              { value: 'USD', label: '$ USD' },
            ]}
            value={s.currency} onChange={v => set({ currency: v })}
          />
        </FieldRow>
        <FieldRow label="Week starts on" last>
          <Segmented
            options={[
              { value: 'Mon', label: 'Mon' },
              { value: 'Sun', label: 'Sun' },
            ]}
            value={s.weekStart} onChange={v => set({ weekStart: v })}
          />
        </FieldRow>
      </SettingsGroup>
      <div style={{ padding: '8px 16px 0' }}>
        <Card padding={12} style={{ background: 'rgba(2,168,185,0.06)', border: '1px solid var(--c-haze-teal)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="info" size={16} color="var(--c-ocean-teal)" style={{ marginTop: 1 }} />
            <div style={{ fontSize: 12, color: 'var(--c-slate)', lineHeight: 1.5 }}>
              {s.payFrequency === 'monthly' && <>Your pay schedule defines the "available to spend" window. Next payday: <strong>day {s.payAnchorDay} each month</strong>.</>}
              {s.payFrequency === 'weekly' && <>Your pay schedule defines the "available to spend" window. Next payday: <strong>every {WEEKDAY_LABELS_LONG[s.payAnchorWeekday ?? 5]}</strong>.</>}
              {s.payFrequency === 'biweekly' && <>Your pay schedule defines the "available to spend" window. Next payday: <strong>every other {WEEKDAY_LABELS_LONG[s.payAnchorWeekday ?? 5]}</strong>.</>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── More: Categories ─────────────────────────────────────
const CAT_GLYPHS = ['cart','tube','bolt','home','fork','play','spark','shirt','box','ticket','card','arrow-in','bell','star','shield','cog','refresh','dot'];
const CAT_TINTS  = ['#02A8B9','#03BCA5','#F4A535','#E8566A','#9C6ADE','#1F2C2C','#7A8181'];

function CategoryForm({ form, setForm, onSave, onCancel, onDelete, isNew }) {
  return (
    <div style={{ padding: '14px 14px 12px' }}>
      <input
        autoFocus
        placeholder="Category name"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
        style={{
          width: '100%', height: 38, padding: '0 12px',
          border: '1.5px solid var(--c-border)', borderRadius: 8,
          fontSize: 14, color: 'var(--c-deep-ink)', background: '#fff',
          fontFamily: 'inherit', outline: 'none', marginBottom: 10,
          boxSizing: 'border-box',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--c-ocean-teal)'}
        onBlur={e => e.target.style.borderColor = 'var(--c-border)'}
      />
      {/* Glyph picker */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        {CAT_GLYPHS.map(g => (
          <button key={g} onClick={() => setForm(f => ({ ...f, glyph: g }))} style={{
            width: 34, height: 34, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: form.glyph === g ? form.tint : 'var(--c-ice-wash)',
            color: form.glyph === g ? '#fff' : 'var(--c-slate)',
            border: form.glyph === g ? `2px solid ${form.tint}` : '2px solid transparent',
            transition: 'all 0.12s',
          }}>
            <Icon name={g} size={16} />
          </button>
        ))}
      </div>
      {/* Tint picker */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {CAT_TINTS.map(t => (
          <button key={t} onClick={() => setForm(f => ({ ...f, tint: t }))} style={{
            width: 28, height: 28, borderRadius: 999, background: t,
            boxShadow: form.tint === t ? `0 0 0 3px #fff, 0 0 0 5px ${t}` : 'none',
            transition: 'box-shadow 0.12s',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{
          fontSize: 13, color: 'var(--c-slate-mute)', padding: '7px 12px',
          borderRadius: 8, background: 'var(--c-ice-wash)',
        }}>Cancel</button>
        {!isNew && onDelete && (
          <button onClick={onDelete} style={{
            fontSize: 13, color: 'var(--c-coral)', padding: '7px 12px',
            borderRadius: 8, background: 'var(--c-coral-tint)',
          }}>Delete</button>
        )}
        <button onClick={onSave} disabled={!form.name.trim()} style={{
          flex: 1, fontSize: 13, fontWeight: 500, color: '#fff',
          padding: '7px 14px', borderRadius: 8,
          background: form.name.trim() ? 'var(--c-ocean-teal)' : 'var(--c-haze-teal)',
          cursor: form.name.trim() ? 'pointer' : 'default',
        }}>{isNew ? 'Add category' : 'Save changes'}</button>
      </div>
    </div>
  );
}

function MoreCategoriesScreen() {
  const { state, dispatch } = useBappy();
  const [adding, setAdding] = React.useState(false);
  const [editId, setEditId] = React.useState(null);
  const [form, setForm] = React.useState({ name: '', glyph: 'cart', tint: '#02A8B9' });

  const counts = React.useMemo(() => {
    const m = {};
    state.transactions.forEach(t => { m[t.categoryId] = (m[t.categoryId] || 0) + 1; });
    return m;
  }, [state.transactions]);

  const openAdd = () => {
    setEditId(null);
    setForm({ name: '', glyph: 'cart', tint: '#02A8B9' });
    setAdding(true);
  };
  const openEdit = (c) => {
    setAdding(false);
    setEditId(c.id);
    setForm({ name: c.name, glyph: c.glyph, tint: c.tint });
  };
  const handleSaveAdd = () => {
    if (!form.name.trim()) return;
    dispatch({ type: 'ADD_CATEGORY', cat: { name: form.name.trim(), glyph: form.glyph, tint: form.tint } });
    setAdding(false);
  };
  const handleSaveEdit = () => {
    if (!form.name.trim()) return;
    dispatch({ type: 'UPDATE_CATEGORY', id: editId, patch: { name: form.name.trim(), glyph: form.glyph, tint: form.tint } });
    setEditId(null);
  };
  const handleDelete = (id) => {
    if (confirm('Remove this category? Existing transactions will keep it as a label.')) {
      dispatch({ type: 'DELETE_CATEGORY', id });
      if (editId === id) setEditId(null);
    }
  };

  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="Categories" leading="back"
        subtitle={`${state.categories.length} total`}
        trailing={
          <button style={{
            width: 36, height: 36, borderRadius: 999,
            background: 'var(--c-ice-wash)', color: 'var(--c-ocean-teal)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={openAdd}>
            <Icon name="plus" size={18} />
          </button>
        }
      />
      <div style={{ padding: '0 16px' }}>
        <Card padding={0}>
          {state.categories.map((c, i, arr) => {
            if (editId === c.id) {
              return (
                <div key={c.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--c-border)' : 'none' }}>
                  <CategoryForm
                    form={form} setForm={setForm}
                    onSave={handleSaveEdit}
                    onCancel={() => setEditId(null)}
                    onDelete={() => handleDelete(c.id)}
                    isNew={false}
                  />
                </div>
              );
            }
            return (
              <ListRow key={c.id}
                icon={<IconContainer glyph={c.glyph} tint={c.tint} size={32} />}
                title={c.name}
                subtitle={`${counts[c.id] || 0} ${counts[c.id] === 1 ? 'transaction' : 'transactions'}`}
                trailing={<Icon name="chev-right" size={14} color="var(--c-slate-mute)" />}
                onClick={() => openEdit(c)}
                last={i === arr.length - 1}
              />
            );
          })}
        </Card>
        {adding && (
          <div style={{ marginTop: 12 }}>
            <Card padding={0}>
              <CategoryForm
                form={form} setForm={setForm}
                onSave={handleSaveAdd}
                onCancel={() => setAdding(false)}
                isNew
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── More: Preferences ────────────────────────────────────
function MorePreferencesScreen() {
  const { state, dispatch } = useBappy();
  const s = state.settings;
  const set = (patch) => dispatch({ type: 'UPDATE_SETTINGS', patch });
  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="Preferences" leading="back" subtitle="Forecast & detection" />
      <SettingsGroup title="Forecast">
        <FieldRow label={`Horizon (${s.forecastHorizonDays} days)`}>
          <Segmented
            options={[
              { value: 30,  label: '30d' },
              { value: 60,  label: '60d' },
              { value: 90,  label: '90d' },
              { value: 180, label: '180d' },
            ]}
            value={s.forecastHorizonDays}
            onChange={v => set({ forecastHorizonDays: Number(v) })}
          />
        </FieldRow>
        <FieldRow label={`Low-balance floor (£${s.lowBalanceFloor})`} last>
          <input type="range" min="0" max="1000" step="50" value={s.lowBalanceFloor}
            onChange={e => set({ lowBalanceFloor: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--c-ocean-teal)' }} />
        </FieldRow>
      </SettingsGroup>
      <SettingsGroup title="Detection">
        <FieldRow label={`Recurring confidence (${Math.round(s.detectionConfidenceThreshold * 100)}%)`} last>
          <input type="range" min="0.4" max="0.95" step="0.05" value={s.detectionConfidenceThreshold}
            onChange={e => set({ detectionConfidenceThreshold: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--c-ocean-teal)' }} />
        </FieldRow>
      </SettingsGroup>
      <SettingsGroup title="Display">
        <FieldRow label="Currency style" last>
          <Segmented
            options={[
              { value: 'exact',   label: '£1,234.56' },
              { value: 'compact', label: '£1.2k' },
            ]}
            value={s.currencyStyle || 'exact'}
            onChange={v => set({ currencyStyle: v })}
          />
        </FieldRow>
      </SettingsGroup>
    </div>
  );
}

// ─── More: Nudge types ────────────────────────────────────
function MoreNudgeTypesScreen() {
  const { state, dispatch } = useBappy();
  const types = state.nudgeTypePrefs || DEFAULT_NUDGE_TYPES;
  const toggle = (id) => dispatch({
    type: 'UPDATE_NUDGE_TYPES',
    patch: types.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t),
  });
  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="Nudge types" leading="back" subtitle="What you'll be nudged about" />
      <div style={{ padding: '0 16px 12px' }}>
        <Card padding={12} style={{ background: 'rgba(2,168,185,0.06)', border: '1px solid var(--c-haze-teal)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="info" size={16} color="var(--c-ocean-teal)" style={{ marginTop: 1 }} />
            <div style={{ fontSize: 12, color: 'var(--c-slate)', lineHeight: 1.5 }}>
              Each type can be muted entirely. Routing, throttling and escalation live in <strong>Nudge rules</strong>.
            </div>
          </div>
        </Card>
      </div>
      <div style={{ padding: '0 16px' }}>
        <Card padding={0}>
          {types.map((t, i, arr) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
              borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--c-border)',
            }}>
              <div style={{ marginTop: 6, flexShrink: 0 }}><SeverityDot severity={t.severity} size={9} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--c-deep-ink)', fontWeight: 500 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 2, lineHeight: 1.45 }}>{t.sub}</div>
              </div>
              <Toggle value={t.enabled} onChange={() => toggle(t.id)} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── More: Email channel ──────────────────────────────────
function MoreEmailScreen() {
  const { state, dispatch } = useBappy();
  const auth = useBappyAuth();
  const s = state.settings;
  const set = (patch) => dispatch({ type: 'UPDATE_SETTINGS', patch });
  const [testState, setTestState] = React.useState('idle'); // idle | sending | sent | error
  const [testError, setTestError] = React.useState('');
  const sendTest = async () => {
    const to = auth.user?.email;
    if (!to) { setTestError('No email address found. Sign in with Google first.'); setTestState('error'); return; }
    setTestState('sending');
    setTestError('');
    try {
      const token = await getToken(false);
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      await sendGmailMessage(token, {
        to,
        subject: 'Bappy — test nudge email',
        text: `Hi,\n\nThis is a test email from Bappy to confirm your email channel is working.\n\nSent: ${dateStr}\n\nBappy never moves your money. Read-only by design.`,
        html: `<!DOCTYPE html><html><body style="font-family:Roboto,Arial,sans-serif;background:#F5FBFC;margin:0;padding:24px">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #DCEFF1">
  <div style="background:linear-gradient(135deg,#02A8B9,#03BCA5);padding:24px 28px 20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <svg width="28" height="28" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.5"/>
        <circle cx="12" cy="12" r="6" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.8"/>
        <circle cx="12" cy="12" r="2.6" fill="#fff"/>
        <circle cx="20" cy="6" r="1.8" fill="#fff"/>
      </svg>
      <span style="color:#fff;font-size:18px;font-weight:500;letter-spacing:-0.3px">Bappy</span>
    </div>
    <div style="color:#fff;font-size:22px;font-weight:300;line-height:1.2">Email channel confirmed ✓</div>
    <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:8px">${dateStr}</div>
  </div>
  <div style="padding:24px 28px">
    <p style="margin:0 0 16px;color:#4A5050;font-size:15px;line-height:1.6">
      This test confirms your Bappy email channel is configured correctly.
      You'll receive nudges at this address based on your digest settings.
    </p>
    <div style="background:#E0F4F6;border-radius:10px;padding:16px 18px;margin-bottom:20px">
      <div style="font-size:12px;color:#7A8181;margin-bottom:4px">Example nudge</div>
      <div style="font-size:15px;color:#1F2C2C;font-weight:500">⚠️ Groceries budget at 82%</div>
      <div style="font-size:13px;color:#4A5050;margin-top:4px">You've spent £246 of your £300 monthly budget with 9 days left.</div>
    </div>
    <p style="margin:0;font-size:12px;color:#7A8181;line-height:1.5">
      Bappy never stores your bank credentials. Read-only by design.<br>
      <a href="https://bappy-app.web.app" style="color:#02A8B9">Manage settings</a>
    </p>
  </div>
</div>
</body></html>`,
      });
      setTestState('sent');
      setTimeout(() => setTestState('idle'), 5000);
    } catch (err) {
      console.error('Test email failed', err);
      setTestError(err.message || String(err));
      setTestState('error');
      setTimeout(() => setTestState('idle'), 6000);
    }
  };
  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="Email channel" leading="back" subtitle="How email nudges are sent" />
      <SettingsGroup title="Delivery">
        <FieldRow label="Address">
          <span style={{ fontSize: 13, color: 'var(--c-deep-ink)', fontWeight: 500 }}>
            {auth.user?.email || 'sam.farrow@gmail.com'}
          </span>
        </FieldRow>
        <FieldRow label="Mode" last>
          <Segmented
            options={[
              { value: 'immediate', label: 'Now' },
              { value: 'daily',     label: 'Daily' },
              { value: 'weekly',    label: 'Weekly' },
            ]}
            value={s.emailDigestMode} onChange={v => set({ emailDigestMode: v })}
          />
        </FieldRow>
      </SettingsGroup>
      <SettingsGroup title="Quiet hours">
        <FieldRow label="Start">
          <span style={{ fontSize: 14, fontFamily: 'Roboto Mono', color: 'var(--c-deep-ink)' }}>{s.quietHours.start}</span>
        </FieldRow>
        <FieldRow label="End" last>
          <span style={{ fontSize: 14, fontFamily: 'Roboto Mono', color: 'var(--c-deep-ink)' }}>{s.quietHours.end}</span>
        </FieldRow>
      </SettingsGroup>
      <div style={{ padding: '16px 16px 8px' }}>
        <Button variant={testState === 'sent' ? 'primary' : 'outline'} full icon="ch-mail"
          disabled={testState === 'sending'}
          onClick={sendTest}>
          {testState === 'sending' ? 'Sending…' : testState === 'sent' ? '✓ Email delivered' : 'Send test email'}
        </Button>
      </div>
      {testState === 'error' && testError && (
        <div style={{ margin: '0 16px 8px', padding: '10px 14px', borderRadius: 10, background: 'var(--c-coral-tint)', color: 'var(--c-coral)', fontSize: 13, lineHeight: 1.5 }}>
          <strong>Failed:</strong> {testError}
          {(testError.includes('403') || testError.includes('disabled') || testError.includes('not enabled')) && (
            <div style={{ marginTop: 6 }}>
              Enable the <strong>Gmail API</strong> at{' '}
              <a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=bappy-app"
                target="_blank" rel="noreferrer" style={{ color: 'var(--c-coral)', fontWeight: 500 }}>
                console.cloud.google.com
              </a>
              , then try again.
            </div>
          )}
        </div>
      )}
      {testState === 'sent' && (
        <div style={{ margin: '0 16px 8px', padding: '10px 14px', borderRadius: 10, background: 'var(--c-seafoam-tint)', color: '#0a7a6a', fontSize: 13 }}>
          Check your inbox at <strong>{auth.user?.email}</strong>.
        </div>
      )}
    </div>
  );
}

// ─── More: Push devices ───────────────────────────────────
function MorePushScreen() {
  const { state, dispatch } = useBappy();
  const devices = state.pushDevices || DEFAULT_PUSH_DEVICES;
  const remove = (id) => dispatch({ type: 'REMOVE_DEVICE', id });
  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="Web Push devices" leading="back" subtitle={`${devices.length} registered`} />
      <div style={{ padding: '0 16px' }}>
        <Card padding={0}>
          {devices.map((d, i, arr) => (
            <ListRow key={d.id}
              icon={<IconContainer glyph="ch-push" tint="#02A8B9" size={32} />}
              title={d.name}
              subtitle={`Added ${BappyUtil.fmtDateShort(d.added)} · Last active ${BappyUtil.fmtRelativeDate(d.lastSeen)}`}
              trailing={
                <button onClick={() => {
                  if (confirm(`Revoke "${d.name}"?`)) remove(d.id);
                }} style={{ fontSize: 12, color: 'var(--c-coral)', fontWeight: 500, padding: '4px 8px' }}>
                  Revoke
                </button>
              }
              last={i === arr.length - 1}
            />
          ))}
          {devices.length === 0 && (
            <EmptyState glyph="ch-push" title="No devices yet"
              body="Allow notifications from any browser to start receiving push nudges." />
          )}
        </Card>
      </div>
      <div style={{ padding: 16 }}>
        <Button variant="outline" full icon="plus" onClick={() => {
          dispatch({
            type: 'ADD_DEVICE',
            device: {
              id: 'd' + Date.now(),
              name: 'This browser',
              added: new Date().toISOString().slice(0, 10),
              lastSeen: new Date().toISOString().slice(0, 10),
            },
          });
        }}>Enable on this browser</Button>
      </div>
    </div>
  );
}

// ─── More: Backup & export ────────────────────────────────
function MoreBackupScreen() {
  const { state, syncStatus, syncError, lastSynced, pushToSheets, pullFromSheets } = useBappy();
  const auth = useBappyAuth();
  const [busy, setBusy] = React.useState(null);
  const [notice, setNotice] = React.useState('');

  // Any Firebase-authenticated user (Google or email) gets cloud sync.
  // Local-only: signed in without a UID (demo / fallback path).
  const isGoogleUser = auth.signedIn && !!auth.user?.uid;

  // Human-readable "X min ago" / "just now" for the sync timestamp
  const fmtSyncAge = (iso) => {
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 10_000)      return 'Just now';
    if (ms < 3_600_000)   return Math.floor(ms / 60_000) + ' min ago';
    if (ms < 86_400_000)  return Math.floor(ms / 3_600_000) + ' hr ago';
    return BappyUtil.fmtDateShort(new Date(iso));
  };

  const handlePull = async () => {
    if (busy) return;
    setBusy('sync');
    try {
      await pullFromSheets();
      showNotice('Data pulled from cloud ✓');
    } catch (err) {
      showNotice('Pull failed — ' + (err?.message || err));
    }
    setBusy(null);
  };

  const handlePush = async () => {
    if (busy) return;
    if (!confirm('Push your current local data to Firebase? This will overwrite whatever is stored in the cloud with what you have on this device.')) return;
    setBusy('push');
    try {
      await pushToSheets();
      showNotice('Local data pushed to cloud ✓');
    } catch (err) {
      showNotice('Push failed — ' + (err?.message || err));
    }
    setBusy(null);
  };

  const sizeKB = Math.round(JSON.stringify(state).length / 1024);

  const showNotice = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 3500); };

  const exportXlsx = async () => {
    if (busy) return;
    setBusy('xlsx');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Transactions
      const txnRows = state.transactions.map(t => ({
        Date: t.date,
        Description: t.description || '',
        Amount: (t.direction === 'expense' ? -t.amount : t.amount).toFixed(2),
        Direction: t.direction,
        Account: state.accounts.find(a => a.id === t.accountId)?.name || t.accountId,
        Category: state.categories.find(c => c.id === t.categoryId)?.name || t.categoryId,
        Type: t.type,
        Status: t.status,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txnRows.length ? txnRows : [{}]), 'Transactions');

      // Accounts
      const accRows = state.accounts.map(a => ({
        Name: a.name,
        Type: a.type,
        Balance: (a.balance || 0).toFixed(2),
        Currency: a.currency || state.settings.currency || 'GBP',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accRows.length ? accRows : [{}]), 'Accounts');

      // Budgets
      const budRows = state.budgets.map(b => ({
        Category: state.categories.find(c => c.id === b.categoryId)?.name || b.categoryId,
        Limit: (b.amount || 0).toFixed(2),
        Period: b.period,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(budRows.length ? budRows : [{}]), 'Budgets');

      // Recurring
      const recRows = state.recurring.map(r => ({
        Payee: r.payee || '',
        Amount: (r.amount || 0).toFixed(2),
        Frequency: r.frequency,
        NextDue: r.nextDue || '',
        Active: r.active ? 'Yes' : 'No',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recRows.length ? recRows : [{}]), 'Recurring');

      XLSX.writeFile(wb, 'bappy-export.xlsx');
      showNotice('Excel file downloaded ✓');
    } catch (err) {
      console.error('XLSX export failed', err);
      showNotice('Export failed — ' + (err.message || err));
    }
    setBusy(null);
  };

  const exportCsv = () => {
    if (busy) return;
    setBusy('csv');
    try {
      const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = ['Date', 'Description', 'Amount', 'Direction', 'Account', 'Category', 'Status'];
      const rows = state.transactions.map(t => [
        t.date,
        escape(t.description || ''),
        (t.direction === 'expense' ? -t.amount : t.amount).toFixed(2),
        t.direction,
        escape(state.accounts.find(a => a.id === t.accountId)?.name || ''),
        escape(state.categories.find(c => c.id === t.categoryId)?.name || ''),
        t.status,
      ]);
      const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'bappy-transactions.csv'; a.click();
      URL.revokeObjectURL(url);
      showNotice('CSV downloaded ✓');
    } catch (err) {
      showNotice('Export failed — ' + (err.message || err));
    }
    setBusy(null);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'bappy-data.json'; a.click();
    URL.revokeObjectURL(url);
    showNotice('JSON downloaded ✓');
  };

  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="Backup & export" leading="back" subtitle="Take your data with you" />

      {/* Summary card */}
      <div style={{ padding: '0 16px 8px' }}>
        <Card padding={14}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--c-slate-mute)' }}>Local storage</div>
              <div style={{ fontSize: 15, color: 'var(--c-deep-ink)', fontWeight: 500, marginTop: 2 }}>
                {isGoogleUser ? 'Firebase sync active' : 'Sign in to enable cloud sync'}
              </div>
            </div>
            <Tag variant={isGoogleUser ? 'income' : 'default'}>
              {isGoogleUser ? 'Synced' : 'Local only'}
            </Tag>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 14, fontSize: 12, color: 'var(--c-slate-mute)' }}>
            <span>{state.transactions.length} transactions</span>
            <span>·</span>
            <span>{state.accounts.length} accounts</span>
            <span>·</span>
            <span>~{sizeKB} KB</span>
          </div>
        </Card>
      </div>

      {/* Notice toast */}
      {notice && (
        <div style={{
          margin: '0 16px 8px', padding: '10px 14px', borderRadius: 10,
          background: notice.includes('failed') ? 'var(--c-coral-tint)' : 'var(--c-seafoam-tint)',
          color: notice.includes('failed') ? 'var(--c-coral)' : '#0a7a6a',
          fontSize: 13, fontWeight: 500,
        }}>{notice}</div>
      )}

      <SettingsGroup title="Export">
        <SettingsRow icon="download" title="Export to Excel (.xlsx)"
          subtitle={busy === 'xlsx' ? 'Generating…' : 'Transactions, accounts, budgets & recurring'}
          onClick={exportXlsx} />
        <SettingsRow icon="download" title="Export to CSV"
          subtitle={busy === 'csv' ? 'Generating…' : 'Transactions as comma-separated values'}
          onClick={exportCsv} />
        <SettingsRow icon="download" title="Download raw data (.json)"
          subtitle="Full schema · for migration or debugging" last
          onClick={exportJson} />
      </SettingsGroup>

      <SettingsGroup title="Cloud sync">
        {isGoogleUser ? (
          <>
            {/* Sync status card */}
            <div style={{ padding: '12px 16px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-deep-ink)' }}>
                    Firebase Cloud
                  </div>
                  <div style={{ fontSize: 12, color: syncStatus === 'error' ? 'var(--c-coral)' : 'var(--c-slate-mute)', marginTop: 2 }}>
                    {syncStatus === 'syncing'
                      ? 'Syncing…'
                      : syncStatus === 'error'
                      ? (syncError || 'Sync failed')
                      : lastSynced
                      ? ('Last synced ' + fmtSyncAge(lastSynced))
                      : 'Auto-syncs on every change'}
                  </div>
                </div>
                <Tag variant={syncStatus === 'error' ? 'expense' : 'income'}>
                  {syncStatus === 'error' ? 'Error' : 'Active'}
                </Tag>
              </div>
              <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 8, lineHeight: 1.5 }}>
                Your data syncs to Firebase automatically. Use "Pull from cloud" to fetch changes made on another device.
              </div>
            </div>
            <SettingsRow
              icon="swap"
              title={busy === 'sync' ? 'Pulling from cloud…' : 'Pull latest from cloud'}
              subtitle="Fetch data updated on another device"
              onClick={handlePull}
            />
            <SettingsRow
              icon="arrow-in"
              title={busy === 'push' ? 'Pushing to cloud…' : 'Push local data to cloud'}
              subtitle="Overwrite cloud with data on this device"
              onClick={handlePush}
              last
            />
          </>
        ) : (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="info" size={16} color="var(--c-ocean-teal)" style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: 'var(--c-slate)', lineHeight: 1.5 }}>
                Sign in with Google to enable automatic cross-device sync via Firebase.
              </div>
            </div>
          </div>
        )}
      </SettingsGroup>
    </div>
  );
}

// ─── More: About ──────────────────────────────────────────
function MoreAboutScreen() {
  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="About" leading="back" subtitle="Bappy" />
      <div style={{
        padding: '16px 24px 24px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        <svg width="56" height="56" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="none" stroke="#02A8B9" strokeWidth="1.4" opacity="0.4" />
          <circle cx="12" cy="12" r="6"  fill="none" stroke="#02A8B9" strokeWidth="1.4" opacity="0.75" />
          <circle cx="12" cy="12" r="2.6" fill="#02A8B9" />
          <circle cx="20" cy="6" r="1.8" fill="#02A8B9" />
        </svg>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--c-deep-ink)', letterSpacing: -0.3 }}>Bappy</div>
        <div style={{ fontSize: 12, color: 'var(--c-slate-mute)' }}>Version 0.1.0 · build f3a2c · 24 May 2026</div>
      </div>
      <SettingsGroup title="Resources">
        <SettingsRow icon="spark"    title="What's new"
          subtitle="May release · forecasts, debt sims"
          onClick={() => window.open('https://bappy-app.web.app/changelog', '_blank', 'noopener')} />
        <SettingsRow icon="info"     title="Help & FAQ"
          subtitle="Common questions"
          onClick={() => window.open('https://bappy-app.web.app/help', '_blank', 'noopener')} />
        <SettingsRow icon="ch-mail"  title="Contact support"
          subtitle="support@bappy.app"
          onClick={() => { window.location.href = 'mailto:support@bappy.app'; }} last />
      </SettingsGroup>
      <SettingsGroup title="Legal">
        <SettingsRow icon="shield"   title="Privacy Policy"
          onClick={() => window.open('https://bappy-app.web.app/privacy', '_blank', 'noopener')} />
        <SettingsRow icon="card"     title="Terms of Service"
          onClick={() => window.open('https://bappy-app.web.app/terms', '_blank', 'noopener')} />
        <SettingsRow icon="acc-bank" title="Open source licenses" subtitle="React, Roboto, xlsx, …" last
          onClick={() => window.open('https://bappy-app.web.app/licenses', '_blank', 'noopener')} />
      </SettingsGroup>
      <div style={{
        padding: '20px 24px 8px', textAlign: 'center', fontSize: 11,
        color: 'var(--c-slate-mute)', lineHeight: 1.5,
      }}>
        Made in London. Bappy is read-only — we never move your money.
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────
const WEEKDAY_LABELS       = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const WEEKDAY_LABELS_SHORT = ['S','M','T','W','T','F','S'];
const WEEKDAY_LABELS_LONG  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function WeekdayPicker({ value, onChange }) {
  // Order respects weekStart? For simplicity always Mon-first display, but values follow Sun=0..Sat=6 to match JS Date.getUTCDay()
  const order = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 3,
      background: 'var(--c-ice-wash)', borderRadius: 10,
    }}>
      {order.map(idx => {
        const active = value === idx;
        return (
          <button key={idx} onClick={() => onChange(idx)} style={{
            flex: 1, height: 30, borderRadius: 8,
            background: active ? '#fff' : 'transparent',
            color: active ? 'var(--c-ocean-teal)' : 'var(--c-slate-mute)',
            fontSize: 12, fontWeight: 500, letterSpacing: 0.2,
            boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.16s',
          }}>{WEEKDAY_LABELS_SHORT[idx]}</button>
        );
      })}
    </div>
  );
}

const inputStyle = {
  width: 180, height: 32, padding: '0 10px',
  border: '1px solid var(--c-border)', borderRadius: 8,
  fontSize: 13, color: 'var(--c-deep-ink)', background: '#fff',
  fontFamily: 'Roboto, sans-serif', outline: 'none',
  textAlign: 'right',
};

function FieldRow({ label, children, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderBottom: last ? 'none' : '1px solid var(--c-border)',
      minHeight: 50,
    }}>
      <div style={{
        flexShrink: 0, fontSize: 13, color: 'var(--c-slate)',
        flexBasis: 130,
      }}>{label}</div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        {children}
      </div>
    </div>
  );
}

function SettingsGroup({ title, children }) {
  return (
    <>
      <SectionHeader>{title}</SectionHeader>
      <div style={{ padding: '0 16px' }}>
        <Card padding={0}>{children}</Card>
      </div>
    </>
  );
}

function SettingsRow({ icon, title, subtitle, onClick, last }) {
  return (
    <ListRow
      last={last}
      onClick={onClick || (() => {})}
      icon={<IconContainer glyph={icon} tint="#02A8B9" size={32} />}
      title={title}
      subtitle={subtitle}
      trailing={<Icon name="chev-right" size={14} color="var(--c-slate-mute)" />}
    />
  );
}

// ─── Nudge rules editor ──────────────────────────────────────
function RulesScreen() {
  const { state, dispatch } = useBappy();
  const route = useRoute();
  const [axis, setAxis] = React.useState('routing');
  const rules = state.nudgeRules
    .filter(r => r.axis === axis)
    .sort((a, b) => b.priority - a.priority);

  return (
    <div style={{ paddingBottom: 140 }}>
      <ScreenHeader title="Nudge rules" leading="back" subtitle="Routing · Throttling · Escalation" />

      <div style={{ padding: '0 16px 12px' }}>
        <Segmented
          options={[
            { value: 'routing', label: 'Routing' },
            { value: 'throttling', label: 'Throttling' },
            { value: 'escalation', label: 'Escalation' },
          ]}
          value={axis}
          onChange={setAxis}
        />
      </div>

      {/* Description */}
      <div style={{ padding: '0 16px 8px' }}>
        <Card padding={12} style={{
          background: 'rgba(2,168,185,0.06)', border: '1px solid var(--c-haze-teal)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Icon name="info" size={16} color="var(--c-ocean-teal)" style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: 'var(--c-slate)', lineHeight: 1.45 }}>
              {axis === 'routing' && 'Build the channel set for each nudge. Higher priority evaluates first.'}
              {axis === 'throttling' && 'Cap how often each channel is used. Drops over-cap sends.'}
              {axis === 'escalation' && 'Re-act on un-acted nudges after a delay. Can re-push or bump severity.'}
            </div>
          </div>
        </Card>
      </div>

      {/* Rules list */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rules.map(r => <RuleCard key={r.id} rule={r} />)}
        <button onClick={() => dispatch({ type: 'ADD_RULE', axis })} style={{
          marginTop: 6, padding: '14px', borderRadius: 12,
          border: '1px dashed var(--c-haze-teal)', color: 'var(--c-ocean-teal)',
          background: 'transparent', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 6, fontWeight: 500, fontSize: 14,
        }}>
          <Icon name="plus" size={16} /> Add {axis} rule
        </button>
      </div>
    </div>
  );
}

function RuleCard({ rule }) {
  const { dispatch } = useBappy();
  return (
    <Card padding={12} style={{ opacity: rule.active ? 1 : 0.5 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: 'var(--c-ice-wash)',
          color: 'var(--c-ocean-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, fontFamily: 'Roboto Mono', flexShrink: 0,
        }}>{rule.id}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 14, color: 'var(--c-deep-ink)', fontWeight: 500 }}>{rule.name}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            <Tag variant="muted" size="sm">priority {rule.priority}</Tag>
            {rule.then.add_channels && rule.then.add_channels.map(c => <ChannelPill key={c} channel={c} />)}
            {rule.then.set_channels && rule.then.set_channels.map(c => <ChannelPill key={c} channel={c} />)}
            {rule.then.remove_channels && rule.then.remove_channels.map(c => (
              <span key={c} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                background: 'var(--c-coral-tint)', color: 'var(--c-coral)',
                padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500,
              }}>−{c.replace('_', ' ')}</span>
            ))}
            {rule.then.max_per_day && <Tag variant="warning" size="sm">{rule.then.max_per_day}/day</Tag>}
            {rule.then.max_per_type_per_day && <Tag variant="warning" size="sm">{rule.then.max_per_type_per_day}/type/day</Tag>}
            {rule.then.min_gap && <Tag variant="warning" size="sm">≥{rule.then.min_gap}</Tag>}
            {rule.then.re_push && <Tag variant="default" size="sm">re-push</Tag>}
            {rule.then.bump_severity && <Tag variant="danger" size="sm">bump severity</Tag>}
          </div>
          <div style={{
            fontSize: 11, fontFamily: 'Roboto Mono', color: 'var(--c-slate-mute)',
            background: 'var(--c-snow-mist)', padding: '6px 8px', borderRadius: 6,
            border: '1px solid var(--c-border)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            when {' '}
            {Object.entries(rule.when).map(([k, v]) => (
              <span key={k}>
                <span style={{ color: 'var(--c-ocean-teal)' }}>{k}</span>
                <span>: </span>
                <span style={{ color: 'var(--c-deep-ink)' }}>{Array.isArray(v) ? v.join(',') : String(v)}</span>
                {' · '}
              </span>
            ))}
          </div>
        </div>
        <Toggle value={rule.active} onChange={() => dispatch({ type: 'TOGGLE_RULE', id: rule.id })} />
      </div>
    </Card>
  );
}

// ─── Import duplicate detection ──────────────────────────────
// Returns the set of indices (into newTxns) that are exact duplicates of
// an already-existing transaction (same account, direction, amount, date, description).
function findImportDuplicateIndices(newTxns, existingTxns) {
  const norm = s => (s || '').trim().toLowerCase();
  const dupeIdx = new Set();
  newTxns.forEach((t, i) => {
    const isDup = existingTxns.some(ex =>
      ex.accountId  === t.accountId  &&
      ex.direction  === t.direction  &&
      ex.date       === t.date       &&
      Math.abs(ex.amount - t.amount) < 0.01 &&
      norm(ex.description) === norm(t.description)
    );
    if (isDup) dupeIdx.add(i);
  });
  return dupeIdx;
}

// ─── Transfer auto-link helpers (used by ImportSheet) ────────
// Find exact-match transfer pairs: same date, same amount, opposite directions, different accounts.
function findAutoLinkPairs(unlinkedTransfers) {
  const expenses = unlinkedTransfers.filter(t => t.direction === 'expense');
  const incomes  = unlinkedTransfers.filter(t => t.direction === 'income');
  const pairs = [], usedIds = new Set();
  expenses.forEach(exp => {
    if (usedIds.has(exp.id)) return;
    const match = incomes.find(inc =>
      !usedIds.has(inc.id) &&
      inc.amount === exp.amount &&
      inc.date === exp.date &&
      inc.accountId !== exp.accountId
    );
    if (match) {
      pairs.push({ outId: exp.id, inId: match.id });
      usedIds.add(exp.id); usedIds.add(match.id);
    }
  });
  return pairs;
}

// Count near-match pairs (date within ±2 days, same amount) — surfaced as suggestions, not auto-linked.
function countNearMatches(unlinkedTransfers) {
  const expenses = unlinkedTransfers.filter(t => t.direction === 'expense');
  const incomes  = unlinkedTransfers.filter(t => t.direction === 'income');
  let count = 0;
  const usedIds = new Set();
  expenses.forEach(exp => {
    if (usedIds.has(exp.id)) return;
    const match = incomes.find(inc =>
      !usedIds.has(inc.id) &&
      inc.amount === exp.amount &&
      inc.accountId !== exp.accountId &&
      Math.abs(new Date(inc.date) - new Date(exp.date)) / 86400000 <= 2
    );
    if (match) { count++; usedIds.add(exp.id); usedIds.add(match.id); }
  });
  return count;
}

// ─── Excel / CSV import sheet ────────────────────────────────
const IMPORT_FIELDS = [
  { key: 'date',        label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'amount',      label: 'Amount (single col)' },
  { key: 'debit',       label: 'Debit column' },
  { key: 'credit',      label: 'Credit column' },
  { key: 'category',    label: 'Category column' },
];

function ImportSheet() {
  const { state, dispatch } = useBappy();
  const route = useRoute();
  const fileRef = React.useRef();

  const [step,              setStep]              = React.useState(0);
  const [headers,           setHeaders]           = React.useState([]);
  const [rows,              setRows]              = React.useState([]);
  const [mapping,           setMapping]           = React.useState({});
  const [accountId,         setAccountId]         = React.useState(state.accounts[0]?.id || '');
  const [defaultCategoryId, setDefaultCategoryId] = React.useState(state.categories[0]?.id || 'cat-other');
  const [preview,           setPreview]           = React.useState([]);
  const [imported,          setImported]          = React.useState(0);
  const [autoLinked,        setAutoLinked]        = React.useState(0);
  const [nearMatch,         setNearMatch]         = React.useState(0);
  const [skipDuplicates,    setSkipDuplicates]    = React.useState(true);
  const [duplicatesSkipped, setDuplicatesSkipped] = React.useState(0);
  const [filename,          setFilename]          = React.useState('');
  const [error,             setError]             = React.useState('');

  // catId defaults to current defaultCategoryId but can be passed explicitly
  // when called immediately after setDefaultCategoryId (before re-render)
  const buildPreview = (hdrs, rawRows, map, accId, catId = defaultCategoryId) =>
    rawRows.slice(0, 6).map(r => {
      const t = mapRow(r, map, accId, catId, state.categories);
      if (!t) return null;
      const norm = s => (s || '').trim().toLowerCase();
      const isDup = state.transactions.some(ex =>
        ex.accountId === accId &&
        ex.direction === t.direction &&
        ex.date === t.date &&
        Math.abs(ex.amount - t.amount) < 0.01 &&
        norm(ex.description) === norm(t.description)
      );
      return { ...t, _isDuplicate: isDup };
    }).filter(Boolean);

  const validCount = (rawRows, map, accId) =>
    rawRows.filter(r => mapRow(r, map, accId, defaultCategoryId, state.categories)).length;

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    setError('');
    try {
      let allRows;
      if (/\.(xlsx|xls)$/i.test(f.name)) {
        const XLSX = await import('xlsx');
        const buf  = await f.arrayBuffer();
        const wb   = XLSX.read(buf, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        allRows    = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false })
                        .map(r => r.map(c => String(c ?? '')));
      } else {
        const text = await f.text();
        allRows = parseCSVText(text);
      }

      if (!allRows.length) { setError('File appears to be empty.'); return; }

      let hdrs, dataRows;
      if (isLikelyHeader(allRows[0])) {
        hdrs     = allRows[0].map(h => String(h).trim());
        dataRows = allRows.slice(1).filter(r => r.some(Boolean));
      } else {
        hdrs     = allRows[0].map((_, i) => `Col ${i + 1}`);
        dataRows = allRows.filter(r => r.some(Boolean));
      }

      const map = autoDetectMapping(hdrs);
      setHeaders(hdrs);
      setRows(dataRows);
      setMapping(map);
      setPreview(buildPreview(hdrs, dataRows, map, accountId));
      setStep(1);
    } catch (err) {
      setError('Could not read file: ' + (err.message || err));
    }
  };

  const handleRunImport = () => {
    // Strip preview-only flags, then pre-assign IDs so auto-link pairs can reference them
    const baseTxns = rows.map(r => mapRow(r, mapping, accountId, defaultCategoryId, state.categories))
      .filter(Boolean)
      .map(({ _categoryFromFile, ...t }) => t);
    const now = Date.now();
    const txnsWithIds = baseTxns.map((t, i) => ({ ...t, id: 'tx-' + (now + i) }));

    // Duplicate detection — filter before further processing if toggle is on
    const dupIndices = findImportDuplicateIndices(txnsWithIds, state.transactions);
    const dedupedTxns = skipDuplicates
      ? txnsWithIds.filter((_, i) => !dupIndices.has(i))
      : txnsWithIds;

    // Phase 3a: exact-match auto-link pairs
    const existingUnlinked = state.transactions.filter(t =>
      t.categoryId === 'cat-transfer' && !t.transferToId &&
      (t.direction === 'expense' || t.direction === 'income')
    );
    const newUnlinked = dedupedTxns.filter(t => t.categoryId === 'cat-transfer');
    const allUnlinked = [...existingUnlinked, ...newUnlinked];
    const autoLinkPairs = findAutoLinkPairs(allUnlinked);
    const autoLinkedIds = new Set(autoLinkPairs.flatMap(p => [p.outId, p.inId]));

    // Phase 3b: count near-matches that couldn't be auto-linked (need manual review)
    const remainingUnlinked = allUnlinked.filter(t => !autoLinkedIds.has(t.id));
    const nearMatchCount = countNearMatches(remainingUnlinked);

    dispatch({ type: 'IMPORT_BATCH', txns: dedupedTxns, filename, autoLinkPairs });
    setAutoLinked(autoLinkPairs.length);
    setNearMatch(nearMatchCount);
    setDuplicatesSkipped(skipDuplicates ? dupIndices.size : 0);
    setImported(dedupedTxns.length);
    setStep(3);
  };

  const colSelect = (field) => (
    <select
      value={mapping[field] ?? ''}
      onChange={e => {
        const newMap = { ...mapping, [field]: e.target.value === '' ? null : Number(e.target.value) };
        setMapping(newMap);
        setPreview(buildPreview(headers, rows, newMap, accountId));
      }}
      style={{ fontSize: 13, color: 'var(--c-ocean-teal)', fontWeight: 500, border: 'none', background: 'transparent', outline: 'none', maxWidth: 160 }}
    >
      <option value="">— skip —</option>
      {headers.map((h, i) => <option key={i} value={i}>{h || `Col ${i + 1}`}</option>)}
    </select>
  );

  return (
    <div>
      <Stepper steps={['Upload', 'Map', 'Preview', 'Done']} current={step} />

      {/* ── Step 0: file picker ── */}
      {step === 0 && (
        <div>
          {error && (
            <div style={{ color: 'var(--c-coral)', fontSize: 13, marginBottom: 12, padding: '10px 14px', background: 'var(--c-coral-tint)', borderRadius: 10 }}>
              {error}
            </div>
          )}
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
          <div
            style={{ padding: 32, textAlign: 'center', border: '2px dashed var(--c-haze-teal)', borderRadius: 14, background: 'var(--c-snow-mist)', cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}
          >
            <div style={{ width: 48, height: 48, borderRadius: 999, margin: '0 auto 12px', background: 'var(--c-ice-wash)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-ocean-teal)' }}>
              <Icon name="download" size={24} />
            </div>
            <div style={{ fontSize: 14, color: 'var(--c-deep-ink)', fontWeight: 500 }}>Tap to choose a file</div>
            <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 4 }}>.csv or .xlsx bank export</div>
            <Button variant="primary" size="sm" style={{ marginTop: 14 }} onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
              Choose file
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 1: column mapping ── */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* account + category selectors */}
          <Card padding={0}>
            {state.accounts.length > 0 && (
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)' }}>
                <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Import into</span>
                <select
                  value={accountId}
                  onChange={e => { setAccountId(e.target.value); setPreview(buildPreview(headers, rows, mapping, e.target.value)); }}
                  style={{ fontSize: 14, color: 'var(--c-ocean-teal)', fontWeight: 500, border: 'none', background: 'transparent', outline: 'none' }}
                >
                  {state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            {state.categories.length > 0 && (
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Default category</span>
                <select
                  value={defaultCategoryId}
                  onChange={e => { setDefaultCategoryId(e.target.value); setPreview(buildPreview(headers, rows, mapping, accountId, e.target.value)); }}
                  style={{ fontSize: 14, color: 'var(--c-ocean-teal)', fontWeight: 500, border: 'none', background: 'transparent', outline: 'none' }}
                >
                  {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--c-border)' }}>
              <div>
                <span style={{ fontSize: 14, color: 'var(--c-slate)' }}>Skip likely duplicates</span>
                <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 1 }}>Skips rows already in your ledger</div>
              </div>
              <Toggle value={skipDuplicates} onChange={setSkipDuplicates} />
            </div>
          </Card>
          {/* column map */}
          <Card padding={0}>
            {IMPORT_FIELDS.map(({ key, label }, i) => (
              <div key={key} style={{ borderBottom: i < IMPORT_FIELDS.length - 1 ? '1px solid var(--c-border)' : 'none' }}>
                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--c-slate)' }}>{label}</span>
                  {colSelect(key)}
                </div>
                {key === 'category' && mapping.category != null && mapping.category >= 0 && (
                  <div style={{ padding: '0 14px 10px', fontSize: 11, color: 'var(--c-slate-mute)', lineHeight: 1.4 }}>
                    Cell values are matched to your category names (case-insensitive). Unmatched rows use the default category above.
                  </div>
                )}
              </div>
            ))}
          </Card>
          <Button variant="primary" full onClick={() => setStep(2)}>Preview →</Button>
          <Button variant="outline" full onClick={() => setStep(0)}>Back</Button>
        </div>
      )}

      {/* ── Step 2: preview ── */}
      {step === 2 && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--c-slate)', marginBottom: 10 }}>
            Showing first {preview.length} rows · <strong>{validCount(rows, mapping, accountId)}</strong> of {rows.length} will import
          </div>
          <Card padding={0}>
            {preview.length === 0
              ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--c-slate-mute)', fontSize: 13 }}>No valid rows — go back and check mapping.</div>
              : preview.map((t, i) => (
                <div key={i} style={{ padding: '10px 14px', borderBottom: i < preview.length - 1 ? '1px solid var(--c-border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--c-deep-ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>{t.date}</span>
                      <span>·</span>
                      <span>{state.categories.find(c => c.id === t.categoryId)?.name || 'Other'}</span>
                      {t._categoryFromFile && (
                        <span style={{
                          fontSize: 10, padding: '1px 5px', borderRadius: 999,
                          background: 'rgba(2,168,185,0.12)', color: 'var(--c-ocean-teal)', fontWeight: 500,
                        }}>from file</span>
                      )}
                      {t._isDuplicate && (
                        <span style={{
                          fontSize: 10, padding: '1px 5px', borderRadius: 999,
                          background: 'rgba(244,165,53,0.15)', color: 'var(--c-amber)', fontWeight: 500,
                        }}>duplicate</span>
                      )}
                    </div>
                  </div>
                  <div className="tnum" style={{ fontSize: 14, fontWeight: 500, flexShrink: 0, color: t.direction === 'income' ? 'var(--c-seafoam)' : 'var(--c-coral)' }}>
                    {t.direction === 'income' ? '+' : '−'}£{t.amount.toFixed(2)}
                  </div>
                </div>
              ))
            }
          </Card>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button variant="primary" full disabled={preview.length === 0} onClick={handleRunImport}>
              Import {validCount(rows, mapping, accountId)} transactions
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: done ── */}
      {step === 3 && (
        <div style={{ textAlign: 'center', padding: '24px 8px' }}>
          <div style={{ width: 56, height: 56, borderRadius: 999, margin: '0 auto 14px', background: 'var(--c-seafoam)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={28} strokeWidth={3} />
          </div>
          <div style={{ fontSize: 17, color: 'var(--c-deep-ink)', fontWeight: 500 }}>Import complete</div>
          <div style={{ fontSize: 13, color: 'var(--c-slate-mute)', marginTop: 4 }}>
            {imported} transactions added{filename ? <> from <strong>{filename}</strong></> : ''}
          </div>
          {duplicatesSkipped > 0 && (
            <div style={{ marginTop: 8, padding: '8px 14px', borderRadius: 10, background: 'rgba(244,165,53,0.10)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="warn" size={14} color="var(--c-amber)" />
              <span style={{ fontSize: 13, color: 'var(--c-amber)', fontWeight: 500 }}>
                {duplicatesSkipped} duplicate{duplicatesSkipped !== 1 ? 's' : ''} skipped
              </span>
            </div>
          )}
          {autoLinked > 0 && (
            <div style={{ marginTop: 8, padding: '8px 14px', borderRadius: 10, background: 'rgba(3,188,165,0.10)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="swap" size={14} color="var(--c-seafoam)" />
              <span style={{ fontSize: 13, color: 'var(--c-seafoam)', fontWeight: 500 }}>
                {autoLinked} transfer pair{autoLinked !== 1 ? 's' : ''} auto-linked
              </span>
            </div>
          )}
          {nearMatch > 0 && (
            <div style={{ marginTop: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(244,165,53,0.10)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="warn" size={14} color="var(--c-amber)" />
              <span style={{ fontSize: 13, color: 'var(--c-amber)', fontWeight: 500 }}>
                {nearMatch} transfer{nearMatch !== 1 ? 's' : ''} may need linking — check Money tab
              </span>
            </div>
          )}
          <Button variant="primary" full style={{ marginTop: 20 }} onClick={() => { route.closeSheet(); route.push('ledger'); }}>
            View ledger
          </Button>
          <button style={{ marginTop: 12, width: '100%', padding: '12px', color: 'var(--c-coral)', fontSize: 14, fontWeight: 500, textAlign: 'center' }}
            onClick={() => {
              if (confirm(`Undo the import of ${imported} transactions from "${filename}"?`)) {
                dispatch({ type: 'ROLLBACK_IMPORT' });
                route.closeSheet();
              }
            }}>
            Undo this import
          </button>
        </div>
      )}
    </div>
  );
}

export { MoreHomeScreen, RulesScreen, ImportSheet, MoreProfileScreen, MoreGeneralScreen, MoreCategoriesScreen, MorePreferencesScreen, MoreNudgeTypesScreen, MoreEmailScreen, MorePushScreen, MoreBackupScreen, MoreAboutScreen, DEFAULT_NUDGE_TYPES, DEFAULT_PUSH_DEVICES };