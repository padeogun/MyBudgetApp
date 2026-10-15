import React from 'react'
import { useBappy, useBappyAuth } from './bappy-state.jsx'
import { Icon, BappyLogo } from './bappy-icons.jsx'
// Bappy nav — Header, TabBar, Sidebar, FAB

// ─── Desktop breakpoint hook ─────────────────────────────────
function useDesktop() {
  const [desktop, setDesktop] = React.useState(
    () => typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false
  )
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const h = e => setDesktop(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return desktop
}

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
  const route    = useRoute()
  const { state } = useBappy()
  const isDesktop = useDesktop()
  const unread   = state.nudges.filter(n => n.status === 'new').length
  const textColor = dark ? '#fff' : 'var(--c-deep-ink)'
  const subColor  = dark ? 'rgba(255,255,255,0.6)' : 'var(--c-slate-mute)'

  // On desktop, root screens don't need a top-row at all (sidebar has logo + nav).
  // Drill-down screens still need the back button row.
  const showTopRow = leading === 'back' || !!trailing || (!isDesktop && leading === 'logo')

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
    : leading === 'logo' && !isDesktop ? <BappyLogo size={22} dark={dark} /> : null

  const bellBtn = (
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
  )

  return (
    <div style={{
      padding: isDesktop ? '20px 24px 14px' : '8px 16px 12px',
      display: 'flex', flexDirection: 'column', gap: 10,
      background: 'transparent',
    }}>
      {showTopRow && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {lead || <div />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {trailing}
            {bellBtn}
          </div>
        </div>
      )}
      {/* On desktop root screens, bell sits inline with the title */}
      {!showTopRow && isDesktop && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {subtitle && (
              <div style={{ fontSize: 12, color: subColor, textTransform: 'uppercase', letterSpacing: 1.1, fontWeight: 500, marginBottom: 3 }}>
                {subtitle}
              </div>
            )}
            {title && (
              <div style={{ fontSize: 26, fontWeight: 600, color: textColor, letterSpacing: -0.4, lineHeight: 1.1 }}>
                {title}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {trailing}
            {bellBtn}
          </div>
        </div>
      )}
      {(showTopRow || !isDesktop) && (title || subtitle) && (
        <div>
          {subtitle && (
            <div style={{ fontSize: 12, color: subColor, textTransform: 'uppercase', letterSpacing: 1.1, fontWeight: 500, marginBottom: 2 }}>
              {subtitle}
            </div>
          )}
          {title && (
            <div style={{ fontSize: big ? 28 : 22, fontWeight: big ? 300 : 500, color: textColor, lineHeight: 1.15, letterSpacing: -0.3 }}>
              {title}
            </div>
          )}
        </div>
      )}
    </div>
  )
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
  const isDesktop = useDesktop()
  const route = useRoute()
  const currentRoot = route.stack[0]?.name
  // On desktop the Sidebar replaces the tab bar
  if (isDesktop) return null
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
          const active = currentRoot === tab.id
          return (
            <button key={tab.id} onClick={() => route.gotoTab(tab.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '6px 4px', color: active ? 'var(--c-ocean-teal)' : 'var(--c-slate-mute)',
            }}>
              <Icon name={tab.icon} size={22} strokeWidth={active ? 2.2 : 1.7} />
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: 0.2 }}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Desktop sidebar ─────────────────────────────────────────
function Sidebar() {
  const route      = useRoute()
  const { state, syncStatus, lastSynced } = useBappy()
  const auth       = useBappyAuth()
  const currentRoot = route.stack[0]?.name
  const unread     = state.nudges.filter(n => n.status === 'new').length
  const user       = auth?.user

  const syncColor = syncStatus === 'error' ? '#E8566A' : syncStatus === 'syncing' ? '#F4A535' : '#03BCA5'
  const syncLabel = syncStatus === 'error' ? 'Sync error' : syncStatus === 'syncing' ? 'Syncing…' : lastSynced ? 'Synced' : 'Local only'

  return (
    <div style={{
      width: 220, flexShrink: 0, height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#fff',
      borderRight: '1px solid var(--c-border)',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 18px 10px' }}>
        <BappyLogo size={22} />
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {TABS.map(tab => {
          const active = currentRoot === tab.id
          return (
            <button key={tab.id} onClick={() => route.gotoTab(tab.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: active ? 'rgba(2,168,185,0.10)' : 'transparent',
              color: active ? 'var(--c-ocean-teal)' : 'var(--c-slate)',
              fontSize: 14, fontWeight: active ? 600 : 400,
              width: '100%', textAlign: 'left',
              transition: 'background 0.12s, color 0.12s',
              border: 'none', cursor: 'pointer',
            }}>
              <Icon name={tab.icon} size={18} strokeWidth={active ? 2.2 : 1.7} />
              <span style={{ flex: 1 }}>{tab.label}</span>
              {tab.id === 'more-home' && unread > 0 && (
                <span style={{
                  background: 'var(--c-coral)', color: '#fff',
                  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                }}>{unread}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer: sync dot + user */}
      <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: user ? 10 : 0 }}>
          <div style={{ width: 7, height: 7, borderRadius: 999, background: syncColor, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--c-slate-mute)' }}>{syncLabel}</span>
        </div>
        {user && (
          <button
            onClick={() => route.push('more-profile')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', textAlign: 'left', background: 'none', border: 'none',
              padding: '6px 8px', borderRadius: 10, cursor: 'pointer',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--c-ice-wash)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 999, flexShrink: 0,
              background: 'rgba(2,168,185,0.12)', color: 'var(--c-ocean-teal)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
            }}>
              {(user.name || user.email || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-deep-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name || user.email}
              </div>
              {user.name && user.email && (
                <div style={{ fontSize: 11, color: 'var(--c-slate-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </div>
              )}
            </div>
            <Icon name="chev-right" size={14} color="var(--c-slate-mute)" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── FAB ────────────────────────────────────────────────────
function FAB({ onClick, icon = 'plus', label }) {
  const isDesktop = useDesktop()
  return (
    <button onClick={onClick} style={{
      position: 'absolute', bottom: isDesktop ? 32 : 100, right: 18, zIndex: 70,
      height: 48, borderRadius: 999,
      padding: label ? '0 20px 0 14px' : '0',
      minWidth: label ? 'auto' : 48,
      width: label ? 'auto' : 48,
      background: 'linear-gradient(135deg, #02A8B9 0%, #03BCA5 100%)',
      color: '#fff',
      boxShadow: '0 8px 20px -4px rgba(2,168,185,0.5), 0 4px 6px rgba(2,168,185,0.2)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      gap: 8,
    }}>
      <Icon name={icon} size={22} strokeWidth={2.4} />
      {label && <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.1 }}>{label}</span>}
    </button>
  );
}

export { BappyRouter, useRoute, ScreenHeader, TabBar, Sidebar, FAB, BappyRouteContext, useDesktop };
