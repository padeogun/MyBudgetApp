import React from 'react'
import { BAPPY_SEED, BappyUtil, useBappy, BappyContext, BappyAuthContext, BappyProvider, useBappyAuth, BappyAuthProvider } from './bappy-state.jsx'
import { Icon, BappyLogo, ICON_PATHS } from './bappy-icons.jsx'
import { IconContainer, Card, Tag, ProgressBar, Button, Sheet, SectionHeader, ListRow, SeverityDot, ChannelPill, EmptyState, Toggle, Segmented, Stepper, tintBg } from './bappy-primitives.jsx'
import { chartPalette, Sparkline, AreaChart, Donut, BarChart, StackedDebtChart, DebtCurve } from './bappy-charts.jsx'
import { BappyRouter, BappyRouteContext, useRoute, ScreenHeader, TabBar, FAB } from './bappy-nav.jsx'
// Bappy — login / welcome screen
// Shown before the app shell when not authenticated.

function LoginScreen({ onSignIn, onGoogleSignIn, gisReady }) {
  const [email, setEmail] = React.useState('');
  const [stage, setStage] = React.useState('welcome'); // welcome | email | code
  const [code, setCode] = React.useState(['', '', '', '', '', '']);
  const [busy, setBusy] = React.useState(false);
  const codeRefs = React.useRef([]);

  const proceedEmail = () => {
    if (!email.includes('@')) return;
    setBusy(true);
    setTimeout(() => { setBusy(false); setStage('code'); }, 600);
  };

  const submitCode = () => {
    setBusy(true);
    setTimeout(() => { setBusy(false); onSignIn({ email, method: 'email' }); }, 700);
  };

  const handleCodeChange = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...code];
    next[i] = v;
    setCode(next);
    if (v && i < 5) codeRefs.current[i + 1]?.focus();
    if (next.every(c => c) && i === 5) {
      setTimeout(submitCode, 200);
    }
  };

  const handleCodeKey = (i, e) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) codeRefs.current[i - 1]?.focus();
  };

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: 'var(--c-snow-mist)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Status bar spacer */}
      <div style={{ height: 47, flexShrink: 0 }} />

      {/* Hero with orbital animation */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(160deg, #02A8B9 0%, #03BCA5 55%, #0FCDB0 100%)',
        padding: '40px 24px 56px',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {/* decorative orbit rings */}
        <svg style={{
          position: 'absolute', top: -80, right: -90, opacity: 0.18,
        }} width="320" height="320" viewBox="0 0 320 320" aria-hidden="true">
          <circle cx="160" cy="160" r="150" fill="none" stroke="#fff" strokeWidth="1" />
          <circle cx="160" cy="160" r="110" fill="none" stroke="#fff" strokeWidth="1" />
          <circle cx="160" cy="160" r="70" fill="none" stroke="#fff" strokeWidth="1" />
          <circle cx="305" cy="80" r="5" fill="#fff" />
          <circle cx="240" cy="250" r="3" fill="#fff" />
        </svg>

        {/* logo mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.5" />
            <circle cx="12" cy="12" r="6"  fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.8" />
            <circle cx="12" cy="12" r="2.6" fill="#fff" />
            <circle cx="20" cy="6" r="1.8" fill="#fff" />
          </svg>
          <span style={{ color: '#fff', fontWeight: 500, fontSize: 22, letterSpacing: -0.4 }}>Bappy</span>
        </div>

        <div style={{
          color: '#fff', fontSize: 30, fontWeight: 300, lineHeight: 1.15, letterSpacing: -0.6,
          maxWidth: 280,
        }}>
          Your budget,<br />
          with nudges that<br />
          <span style={{ fontWeight: 500 }}>actually help.</span>
        </div>
        <div style={{
          color: 'rgba(255,255,255,0.78)', fontSize: 13, marginTop: 14,
          lineHeight: 1.5, maxWidth: 290,
        }}>
          Track every account, forecast what's left, and only get nudged when it matters.
        </div>
      </div>

      {/* Form card — overlaps hero */}
      <div style={{
        flex: 1, padding: '0 20px', marginTop: -28,
        overflowY: 'auto', position: 'relative',
      }} className="bappy-scroll">
        <div style={{
          background: '#fff', borderRadius: 18, padding: 22,
          border: '1px solid var(--c-border)',
          boxShadow: '0 18px 40px -24px rgba(31,44,44,0.25), 0 2px 6px rgba(31,44,44,0.04)',
        }}>
          {stage === 'welcome' && (
            <LoginWelcome
              onEmail={() => setStage('email')}
              onGoogleSignIn={onGoogleSignIn}
              gisReady={gisReady}
            />
          )}
          {stage === 'email' && (
            <LoginEmail
              email={email} setEmail={setEmail}
              onSubmit={proceedEmail} onBack={() => setStage('welcome')}
              busy={busy}
            />
          )}
          {stage === 'code' && (
            <LoginCode
              email={email} code={code}
              onChange={handleCodeChange} onKey={handleCodeKey}
              refs={codeRefs} onBack={() => setStage('email')}
              busy={busy} onResend={() => { setBusy(true); setTimeout(() => setBusy(false), 600); }}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 8px 28px', textAlign: 'center',
          fontSize: 11, color: 'var(--c-slate-mute)', lineHeight: 1.55,
        }}>
          By continuing you agree to Bappy's{' '}
          <span style={{ color: 'var(--c-ocean-teal)', fontWeight: 500 }}>Terms</span>{' '}and{' '}
          <span style={{ color: 'var(--c-ocean-teal)', fontWeight: 500 }}>Privacy Policy</span>.
          <div style={{ marginTop: 10, opacity: 0.8 }}>
            Bappy never stores your bank credentials. Read-only by design.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Welcome stage — provider buttons ──────────────────────
function LoginWelcome({ onEmail, onGoogleSignIn, gisReady }) {
  const [googleBusy, setGoogleBusy] = React.useState(false);
  const [googleError, setGoogleError] = React.useState(null);

  const handleGoogle = async () => {
    if (!onGoogleSignIn) return;
    setGoogleBusy(true);
    setGoogleError(null);
    try {
      await onGoogleSignIn();
    } catch (e) {
      setGoogleError('Sign-in failed: ' + (e?.message || 'unknown error'));
      setGoogleBusy(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--c-deep-ink)', marginBottom: 4 }}>
        Sign in to Bappy
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginBottom: 18 }}>
        New here? Your account is created automatically.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ProviderButton
          icon={googleBusy
            ? <span style={{ width: 18, height: 18, border: '2px solid #4285F4', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'bappy-spin 0.7s linear infinite' }} />
            : <GoogleGlyph />}
          label={googleBusy ? 'Signing in…' : !gisReady ? 'Loading…' : 'Continue with Google'}
          onClick={handleGoogle}
          disabled={!gisReady || googleBusy}
        />
      </div>

      {googleError && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(232,86,106,0.08)', borderRadius: 8, fontSize: 12, color: '#E8566A' }}>
          {googleError}
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        margin: '18px 0 14px',
      }}>
        <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
        <span style={{ fontSize: 11, color: 'var(--c-slate-mute)', letterSpacing: 1, textTransform: 'uppercase' }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
      </div>

      <Button variant="outline" full size="lg" icon="ch-mail" onClick={onEmail}>
        Continue with email
      </Button>
    </div>
  );
}

// ─── Email entry stage ───────────────────────────────────────
function LoginEmail({ email, setEmail, onSubmit, onBack, busy }) {
  return (
    <div>
      <button onClick={onBack} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color: 'var(--c-slate-mute)', fontSize: 13, marginBottom: 14,
      }}>
        <Icon name="chev-left" size={14} /> Back
      </button>
      <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--c-deep-ink)', marginBottom: 4 }}>
        What's your email?
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginBottom: 18 }}>
        We'll send a 6-digit code to sign you in.
      </div>

      <label style={{ display: 'block', position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--c-slate-mute)', display: 'flex',
        }}>
          <Icon name="ch-mail" size={16} />
        </div>
        <input
          type="email"
          autoFocus
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
          placeholder="you@example.com"
          style={{
            width: '100%', height: 48, paddingLeft: 40, paddingRight: 14,
            border: '1px solid var(--c-border)', borderRadius: 12,
            fontSize: 15, color: 'var(--c-deep-ink)', background: '#fff',
            fontFamily: 'Roboto, sans-serif',
            outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--c-ocean-teal)'}
          onBlur={e => e.target.style.borderColor = 'var(--c-border)'}
        />
      </label>

      <Button
        variant="primary" full size="lg"
        onClick={onSubmit}
        disabled={busy || !email.includes('@')}
        style={{ marginTop: 16 }}
      >
        {busy ? 'Sending code…' : 'Send code'}
      </Button>
    </div>
  );
}

// ─── Code entry stage ────────────────────────────────────────
function LoginCode({ email, code, onChange, onKey, refs, onBack, busy, onResend }) {
  const [resent, setResent] = React.useState(false);
  const handleResend = () => {
    onResend?.();
    setResent(true);
    setTimeout(() => setResent(false), 3000);
  };
  return (
    <div>
      <button onClick={onBack} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color: 'var(--c-slate-mute)', fontSize: 13, marginBottom: 14,
      }}>
        <Icon name="chev-left" size={14} /> Back
      </button>
      <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--c-deep-ink)', marginBottom: 4 }}>
        Check your inbox
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-slate-mute)', marginBottom: 18, lineHeight: 1.5 }}>
        We sent a code to <span style={{ color: 'var(--c-deep-ink)', fontWeight: 500 }}>{email}</span>.
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        {code.map((c, i) => (
          <input
            key={i}
            ref={el => refs.current[i] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={c}
            onChange={e => onChange(i, e.target.value)}
            onKeyDown={e => onKey(i, e)}
            autoFocus={i === 0}
            style={{
              width: 44, height: 52, textAlign: 'center',
              border: '1px solid var(--c-border)', borderRadius: 12,
              fontSize: 22, fontWeight: 500, fontFamily: 'Roboto Mono',
              color: 'var(--c-deep-ink)', background: c ? 'var(--c-ice-wash)' : '#fff',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        ))}
      </div>

      <div style={{
        marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={handleResend} style={{
          fontSize: 12,
          color: resent ? 'var(--c-seafoam)' : 'var(--c-ocean-teal)',
          fontWeight: 500, transition: 'color 0.2s',
        }}>
          {resent ? '✓ Code resent' : 'Resend code'}
        </button>
        {busy && (
          <span style={{ fontSize: 12, color: 'var(--c-slate-mute)' }}>
            Verifying…
          </span>
        )}
      </div>

      <div style={{
        marginTop: 18, padding: 10,
        background: 'rgba(2,168,185,0.06)', borderRadius: 10,
        border: '1px solid var(--c-haze-teal)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Icon name="info" size={14} color="var(--c-ocean-teal)" />
        <span style={{ fontSize: 11, color: 'var(--c-slate)' }}>
          Demo: enter any 6 digits to sign in.
        </span>
      </div>
    </div>
  );
}

// ─── Provider button ────────────────────────────────────────
function ProviderButton({ icon, label, onClick, dark }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', height: 48, borderRadius: 12,
      border: dark ? 'none' : '1px solid var(--c-border)',
      background: dark ? '#1F2C2C' : '#fff',
      color: dark ? '#fff' : 'var(--c-deep-ink)',
      fontSize: 15, fontWeight: 500, letterSpacing: 0.1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      cursor: 'pointer',
    }}>
      {icon}{label}
    </button>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.227c0-.708-.064-1.388-.183-2.04H12v3.858h5.382a4.604 4.604 0 0 1-1.995 3.022v2.51h3.232c1.892-1.742 2.98-4.305 2.98-7.35z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.964-.895 6.619-2.423l-3.232-2.51c-.895.6-2.04.954-3.387.954-2.605 0-4.81-1.76-5.596-4.122H3.064v2.59A9.996 9.996 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.404 13.9a6.005 6.005 0 0 1 0-3.8V7.51H3.064a10.002 10.002 0 0 0 0 8.98l3.34-2.59z" />
      <path fill="#EA4335" d="M12 5.977c1.47 0 2.788.505 3.825 1.498l2.868-2.868C16.96 3.062 14.696 2 12 2 8.094 2 4.722 4.24 3.064 7.51l3.34 2.59C7.19 7.738 9.395 5.977 12 5.977z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M17.3 12.3c-.03-2.95 2.4-4.36 2.5-4.42-1.36-2-3.5-2.27-4.25-2.3-1.8-.18-3.53 1.07-4.45 1.07-.94 0-2.34-1.05-3.85-1.02-1.98.03-3.8 1.15-4.82 2.92-2.06 3.57-.52 8.84 1.47 11.74.98 1.42 2.13 3 3.64 2.95 1.47-.06 2.02-.95 3.79-.95 1.76 0 2.27.95 3.82.92 1.58-.03 2.58-1.44 3.54-2.86 1.12-1.64 1.58-3.23 1.6-3.32-.03-.01-3.06-1.17-3.1-4.65z" />
      <path d="M14.94 3.78c.81-.99 1.36-2.36 1.21-3.72-1.17.05-2.6.78-3.44 1.77-.75.87-1.41 2.27-1.23 3.61 1.3.1 2.64-.66 3.46-1.66z" />
    </svg>
  );
}

export { LoginScreen };
