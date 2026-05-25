import React from 'react'
import { useBappy } from './bappy-state.jsx'
import { Icon, BappyLogo } from './bappy-icons.jsx'
// Bappy nav — Header, TabBar, FAB

// Route + UI context
const BappyRouteContext = React.createContext(null);
const useRoute = () => React.useContext(BappyRouteContext);

function BappyRouter({ initialRoute = { name: 'home' }, children, openSheet, closeSheet, sheet }) {
  const [stack, setStack] = React.useState([initialRoute]);
  const current = stack[stack.length - 1];
  const api = React.useMemo(() => ({
    current,
    stack,
    push: (name, params = {}) => setStack(s => [...s, { name, params }]),
    pop: () => setStack(s => s.length > 1 ? s.slice(0, -1) : s),
    popTo: (name) => setStack(s => {
      const idx = s.findIndex(r => r.name === name);
      return idx >= 0 ? s.slice(0, idx + 1) : [{ name }];
    }),
    gotoTab: (root) => setStack([{ name: root }]),
    replace: (name, params = {}) => setStack(s => [...s.slice(0, -1), { name, params }]),
    canGoBack: stack.length > 1,
    openSheet, closeSheet, sheet,
  }), [stack, sheet]);
  return React.createElement(BappyRouteContext.Provider, { value: api }, children);
}

// ─── Header (per-screen) ─────────────────────────────────────
function ScreenHeader({ title, subtitle, leading = 'logo', trailing, dark = false, big = false }) {
  const route = useRoute();
  const { state } = useBappy();
  const unread = state.nudges.filter(n => n.status === 'new').length;
  const textColor = dark ? '#fff' : 'var(--c-deep-ink)';
  const subColor = dark ? 'rgba(255,255,255,0.6)' : 'var(--c-slate-mute)';

  const lead = leading === 'back'
    ? (
      <button onClick={() => route.pop()} style={{
        width: 36, height: 36, borderRadius: 999,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: dark ? 'rgba(255,255,255,0.10)' : 'var(--c-ice-wash)',
        color: dark ? '#fff' : 'var(--c-slate)',
      }}>
        <Icon name="chev-left" size={20} />
      </button>
    )
    : leading === 'logo' ? <BappyLogo size={22} dark={dark} /> : null;

  return (
    <div style={{
      padding: '8px 16px 12px',
      display: 'flex', flexDirection: 'column', gap: 10,
      background: 'transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {lead}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {trailing}
          <button onClick={() => route.push('nudges')} style={{
            position: 'relative', width: 36, height: 36, borderRadius: 999,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: dark ? 'rgba(255,255,255,0.10)' : 'var(--c-ice-wash)',
            color: dark ? '#fff' : 'var(--c-slate)',
          }}>
            <Icon name="bell" size={18} />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px',
                borderRadius: 999, background: 'var(--c-coral)', color: '#fff',
                fontSize: 10, fontWeight: 600, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
              }}>{unread}</span>
            )}
          </button>
        </div>
      </div>
      {(title || subtitle) && (
        <div>
          {subtitle && (
            <div style={{
              fontSize: 12, color: subColor, textTransform: 'uppercase',
              letterSpacing: 1.1, fontWeight: 500, marginBottom: 2,
            }}>{subtitle}</div>
          )}
          {title && (
            <div style={{
              fontSize: big ? 28 : 22, fontWeight: big ? 300 : 500,
              color: textColor, lineHeight: 1.15, letterSpacing: -0.3,
            }}>{title}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab bar ────────────────────────────────────────────────
const TABS = [
  { id: 'home',          icon: 'nav-home',     label: 'Home' },
  { id: 'accounts',      icon: 'nav-money',    label: 'Money' },
  { id: 'plan-home',     icon: 'nav-plan',     label: 'Plan' },
  { id: 'insights-home', icon: 'nav-insights', label: 'Insights' },
  { id: 'more-home',     icon: 'nav-more',     label: 'More' },
];

function TabBar() {
  const route = useRoute();
  const currentRoot = route.stack[0]?.name;
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 80,
      paddingBottom: 'env(safe-area-inset-bottom, 12px)', paddingTop: 6,
      background: 'rgba(255,255,255,0.92)',
      borderTop: '1px solid var(--c-border)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        {TABS.map(tab => {
          const active = currentRoot === tab.id;
          return (
            <button key={tab.id} onClick={() => route.gotoTab(tab.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '6px 4px', color: active ? 'var(--c-ocean-teal)' : 'var(--c-slate-mute)',
            }}>
              <Icon name={tab.icon} size={22} strokeWidth={active ? 2.2 : 1.7} />
              <span style={{
                fontSize: 10, fontWeight: 500, letterSpacing: 0.2,
              }}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── FAB ────────────────────────────────────────────────────
function FAB({ onClick, icon = 'plus' }) {
  return (
    <button onClick={onClick} style={{
      position: 'absolute', bottom: 100, right: 18, zIndex: 70,
      width: 56, height: 56, borderRadius: 999,
      background: 'linear-gradient(135deg, #02A8B9 0%, #03BCA5 100%)',
      color: '#fff',
      boxShadow: '0 8px 20px -4px rgba(2,168,185,0.5), 0 4px 6px rgba(2,168,185,0.2)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={icon} size={24} strokeWidth={2.4} />
    </button>
  );
}

export { BappyRouter, useRoute, ScreenHeader, TabBar, FAB, BappyRouteContext };
