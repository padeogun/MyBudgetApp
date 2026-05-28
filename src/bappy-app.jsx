// Bappy — main App component, route → screen mapping, sheet host
import React from 'react'
import { useBappy, BappyProvider, useBappyAuth, BappyAuthProvider } from './bappy-state.jsx'
import { BappyRouter, useRoute, TabBar, FAB } from './bappy-nav.jsx'
import { Sheet } from './bappy-primitives.jsx'
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakToggle, TweakButton } from './tweaks-panel.jsx'
import { HomeScreen, NudgesScreen, NudgeDetailScreen } from './bappy-screens-home.jsx'
import { AccountsScreen, AccountDetailScreen, LedgerScreen, AddTransactionSheet, AddAccountSheet, EditTransactionSheet, EditAccountSheet } from './bappy-screens-money.jsx'
import { PlanHomeScreen, BudgetsScreen, BudgetDetailScreen, RecurringScreen, SuggestionsScreen } from './bappy-screens-plan.jsx'
import { InsightsHomeScreen, ForecastScreen, DebtPerScreen, DebtAllScreen, AvailableScreen, UpcomingScreen } from './bappy-screens-insights.jsx'
import { ByCategoryScreen, SummariesScreen, NetWorthScreen } from './bappy-screens-insights-reports.jsx'
import { MoreHomeScreen, RulesScreen, ImportSheet, MoreProfileScreen, MoreGeneralScreen, MoreCategoriesScreen, MorePreferencesScreen, MoreNudgeTypesScreen, MoreEmailScreen, MorePushScreen, MoreBackupScreen, MoreAboutScreen } from './bappy-screens-more.jsx'
import { LoginScreen } from './bappy-screens-login.jsx'

const SCREENS = {
  'home':            () => <HomeScreen />,
  'nudges':          () => <NudgesScreen />,
  'nudge-detail':    () => <NudgeDetailScreen />,
  'accounts':        () => <AccountsScreen />,
  'account-detail':  () => <AccountDetailScreen />,
  'ledger':          () => <LedgerScreen />,
  'plan-home':       () => <PlanHomeScreen />,
  'budgets':         () => <BudgetsScreen />,
  'budget-detail':   () => <BudgetDetailScreen />,
  'recurring':       () => <RecurringScreen />,
  'suggestions':     () => <SuggestionsScreen />,
  'insights-home':   () => <InsightsHomeScreen />,
  'forecast':        () => <ForecastScreen />,
  'debt-per':        () => <DebtPerScreen />,
  'debt-all':        () => <DebtAllScreen />,
  'available':       () => <AvailableScreen />,
  'upcoming':        () => <UpcomingScreen />,
  'more-home':       () => <MoreHomeScreen />,
  'rules':           () => <RulesScreen />,
  'more-profile':    () => <MoreProfileScreen />,
  'more-general':    () => <MoreGeneralScreen />,
  'more-categories': () => <MoreCategoriesScreen />,
  'more-preferences':() => <MorePreferencesScreen />,
  'more-nudge-types':() => <MoreNudgeTypesScreen />,
  'more-email':      () => <MoreEmailScreen />,
  'more-push':       () => <MorePushScreen />,
  'more-backup':     () => <MoreBackupScreen />,
  'more-about':      () => <MoreAboutScreen />,
  'by-category':     () => <ByCategoryScreen />,
  'summaries':       () => <SummariesScreen />,
  'net-worth':       () => <NetWorthScreen />,
}

const FAB_ROUTES = new Set(['accounts'])

function SyncBanner() {
  const { syncStatus, syncError, storageError } = useBappy()
  const [dismissedSync,    setDismissedSync]    = React.useState(false)
  const [dismissedStorage, setDismissedStorage] = React.useState(false)

  React.useEffect(() => { if (syncStatus !== 'error') setDismissedSync(false) }, [syncStatus])
  React.useEffect(() => { if (!storageError) setDismissedStorage(false) }, [storageError])

  if (storageError && !dismissedStorage) return (
    <div style={{ background: '#fff3cd', borderBottom: '1px solid #ffc107', padding: '8px 16px', fontSize: 12, color: '#856404', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ flex: 1 }}>
        <strong>⚠️ Data not saved to this device.</strong>
        <div style={{ marginTop: 3 }}>{storageError}</div>
      </div>
      <button onClick={() => setDismissedStorage(true)} style={{ color: '#856404', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>✕</button>
    </div>
  )
  if (syncStatus === 'syncing') return (
    <div style={{ background: 'var(--c-ice-wash)', borderBottom: '1px solid var(--c-border)', padding: '6px 16px', fontSize: 12, color: 'var(--c-ocean-teal)', display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: 'spin 1s linear infinite' }}><circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20" strokeDashoffset="10"/></svg>
      Syncing…
    </div>
  )
  if (syncStatus === 'error' && !dismissedSync) return (
    <div style={{ background: 'var(--c-coral-tint)', borderBottom: '1px solid #f5c6cb', padding: '8px 16px', fontSize: 12, color: '#721c24', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ flex: 1 }}>
        <strong>Cloud sync failed — data won't carry across devices.</strong>
        {syncError?.includes('permission-denied') || syncError?.includes('PERMISSION_DENIED') ? (
          <div style={{ marginTop: 3 }}>Firestore permissions error. Check your security rules at <a href="https://console.firebase.google.com/project/bappy-app/firestore/rules" target="_blank" rel="noreferrer" style={{ color: '#721c24' }}>Firebase Console</a>.</div>
        ) : syncError?.includes('unavailable') || syncError?.includes('Failed to fetch') ? (
          <div style={{ marginTop: 3 }}>Can't reach Firebase — check your internet connection and try again.</div>
        ) : (
          <div style={{ marginTop: 3 }}>{syncError}</div>
        )}
      </div>
      <button onClick={() => setDismissedSync(true)} style={{ color: '#721c24', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>✕</button>
    </div>
  )
  return null
}

function AppShell() {
  const auth = useBappyAuth()
  const [sheet, setSheet] = React.useState(null)
  const openSheet = (s) => setSheet(s)
  const closeSheet = () => setSheet(null)
  if (!auth.signedIn) return <LoginScreen onSignIn={auth.signIn} onGoogleSignIn={auth.googleSignIn} gisReady={auth.gisReady} />
  return (
    <BappyRouter initialRoute={{ name: 'home' }} openSheet={openSheet} closeSheet={closeSheet} sheet={sheet}>
      <AppBody />
    </BappyRouter>
  )
}

function AppBody() {
  const route = useRoute()
  const screen = SCREENS[route.current.name]
  const showFAB = FAB_ROUTES.has(route.current.name)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'var(--c-snow-mist)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 'env(safe-area-inset-top, 0px)', flexShrink: 0 }} />
      <SyncBanner />
      <div className="bappy-scroll" style={{ flex: 1, overflowY: 'auto', animation: 'bappy-fade 0.25s ease' }}
        key={route.current.name + JSON.stringify(route.current.params)}>
        {screen ? screen() : <div style={{ padding: 24 }}>Unknown route: {route.current.name}</div>}
      </div>
      {showFAB && <FAB onClick={() => route.openSheet({ kind: 'add' })} label="Add transaction" />}
      <TabBar />
      <Sheet open={!!route.sheet} onClose={route.closeSheet}
        title={
          route.sheet?.kind === 'add'          ? 'New transaction' :
          route.sheet?.kind === 'transfer'     ? 'Transfer' :
          route.sheet?.kind === 'import'       ? 'Excel import' :
          route.sheet?.kind === 'add-account'  ? 'Add account' :
          route.sheet?.kind === 'edit-txn'     ? 'Edit transaction' :
          route.sheet?.kind === 'edit-account' ? 'Edit account' : ''
        }
        height="92%">
        {route.sheet?.kind === 'add'          && <AddTransactionSheet initial={{ accountId: route.sheet.accountId }} />}
        {route.sheet?.kind === 'transfer'     && <AddTransactionSheet initial={{ direction: 'transfer', accountId: route.sheet.accountId }} />}
        {route.sheet?.kind === 'import'       && <ImportSheet />}
        {route.sheet?.kind === 'add-account'  && <AddAccountSheet />}
        {route.sheet?.kind === 'edit-txn'     && <EditTransactionSheet key={route.sheet.txnId}     txnId={route.sheet.txnId} />}
        {route.sheet?.kind === 'edit-account' && <EditAccountSheet   key={route.sheet.accountId} accountId={route.sheet.accountId} />}
      </Sheet>
    </div>
  )
}

const TWEAK_DEFAULTS = { scenario: 'default', density: 'cosy', accent: '#02A8B9', showFloor: true, currencyStyle: 'exact' }

function BappyTweaks() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS)
  const { dispatch } = useBappy()
  React.useEffect(() => { document.documentElement.style.setProperty('--c-ocean-teal', tweaks.accent) }, [tweaks.accent])
  return (
    <TweaksPanel>
      <TweakSection title="Demo scenario">
        <TweakRadio value={tweaks.scenario} onChange={v => { setTweak('scenario', v); dispatch({ type: 'UPDATE_SETTINGS', patch: { lowBalanceFloor: v === 'tight' ? 500 : v === 'healthy' ? 100 : 200 } }) }}
          options={[{ value: 'healthy', label: 'Healthy' }, { value: 'default', label: 'Default' }, { value: 'tight', label: 'Tight' }]} />
      </TweakSection>
      <TweakSection title="Accent">
        <TweakColor value={tweaks.accent} onChange={v => setTweak('accent', v)} options={['#02A8B9', '#03BCA5', '#9C6ADE', '#F4A535', '#E8566A']} />
      </TweakSection>
      <TweakSection title="Low-balance floor">
        <TweakToggle value={tweaks.showFloor} onChange={v => setTweak('showFloor', v)} label="Show floor line on cash flow chart" />
      </TweakSection>
      <TweakSection title="Data">
        <TweakButton onClick={() => { if (confirm('Reset demo data?')) dispatch({ type: 'RESET' }) }}>Reset all data</TweakButton>
      </TweakSection>
    </TweaksPanel>
  )
}

export function BappyApp() {
  return (
    <BappyProvider>
      <BappyAuthProvider>
        <div className="bappy-stage">
          <AppShell />
        </div>
        <BappyTweaks />
      </BappyAuthProvider>
    </BappyProvider>
  )
}