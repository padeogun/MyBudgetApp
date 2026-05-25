import React from 'react'
import { Icon } from './bappy-icons.jsx'
// Bappy primitives — Card, Tag, IconContainer, ProgressBar, Sheet, Button

// ─── IconContainer ────────────────────────────────────────────
function IconContainer({ glyph, size = 36, tint, variant = 'default' }) {
  // tint: full color of the glyph; bg derived from tint at low opacity
  const bg = variant === 'dark' ? 'rgba(255,255,255,0.08)'
           : variant === 'income' ? 'var(--c-seafoam-tint)'
           : tintBg(tint);
  const fg = variant === 'dark' ? '#fff' : tint || 'var(--c-ocean-teal)';
  return (
    <div style={{
      width: size, height: size, borderRadius: 10,
      background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon name={glyph} size={size * 0.55} color={fg} strokeWidth={1.8} />
    </div>
  );
}
function tintBg(tint) {
  if (!tint) return 'var(--c-ice-wash)';
  // hex → rgba at 0.14
  const m = tint.match(/^#([0-9a-f]{6})$/i);
  if (!m) return 'var(--c-ice-wash)';
  const n = parseInt(m[1], 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},0.14)`;
}

// ─── Card ────────────────────────────────────────────────────
function Card({ children, dark = false, padding = 16, style, onClick, ...rest }) {
  const baseStyle = dark ? {
    background: 'linear-gradient(135deg, #1F2C2C 0%, #2B3B3B 100%)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -16px rgba(0,0,0,0.4)',
  } : {
    background: '#fff',
    color: 'var(--c-slate)',
    border: '1px solid var(--c-border)',
  };
  return (
    <div onClick={onClick} style={{
      ...baseStyle,
      borderRadius: 14,
      padding,
      cursor: onClick ? 'pointer' : undefined,
      ...style,
    }} {...rest}>{children}</div>
  );
}

// ─── Tag ─────────────────────────────────────────────────────
function Tag({ children, variant = 'default', size = 'sm', style }) {
  const VARIANTS = {
    default:   { bg: 'var(--c-ice-wash)',    fg: 'var(--c-ocean-teal)' },
    income:    { bg: 'var(--c-seafoam-tint)',fg: 'var(--c-seafoam)' },
    warning:   { bg: 'var(--c-amber-tint)',  fg: '#B97A1A' },
    danger:    { bg: 'var(--c-coral-tint)',  fg: 'var(--c-coral)' },
    muted:     { bg: '#F1F5F6',              fg: 'var(--c-slate-mute)' },
    dark:      { bg: 'rgba(255,255,255,0.10)',fg: 'rgba(255,255,255,0.85)' },
    alert:     { bg: 'var(--c-coral)',       fg: '#fff' },
  };
  const v = VARIANTS[variant] || VARIANTS.default;
  const pad = size === 'sm' ? '3px 8px' : '5px 10px';
  const fs = size === 'sm' ? 11 : 12;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: v.bg, color: v.fg, padding: pad, fontSize: fs,
      fontWeight: 500, borderRadius: 999, letterSpacing: 0.15,
      whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  );
}

// ─── Progress bar ────────────────────────────────────────────
function ProgressBar({ value, max = 100, variant = 'default', height = 6, label, sublabel }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fills = {
    default: 'var(--c-ocean-teal)',
    warning: 'var(--c-amber)',
    danger:  'var(--c-coral)',
    success: 'var(--c-seafoam)',
  };
  return (
    <div>
      {(label || sublabel) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
          <span>{label}</span>
          <span style={{ color: 'var(--c-slate-mute)' }}>{sublabel}</span>
        </div>
      )}
      <div style={{
        height, borderRadius: 999, background: 'var(--c-ice-wash)', overflow: 'hidden',
      }}>
        <div style={{
          width: pct + '%', height: '100%', background: fills[variant] || fills.default,
          borderRadius: 999, transition: 'width 0.4s cubic-bezier(.4,1.4,.5,1)',
        }} />
      </div>
    </div>
  );
}

// ─── Button ──────────────────────────────────────────────────
function Button({ children, variant = 'primary', size = 'md', icon, onClick, disabled, style, type, full }) {
  const variants = {
    primary:   { bg: 'var(--c-ocean-teal)', fg: '#fff' },
    secondary: { bg: 'var(--c-ice-wash)',   fg: 'var(--c-ocean-teal)' },
    outline:   { bg: 'transparent',         fg: 'var(--c-ocean-teal)', border: '1px solid var(--c-ocean-teal)' },
    success:   { bg: 'var(--c-seafoam)',    fg: '#fff' },
    danger:    { bg: 'var(--c-coral)',      fg: '#fff' },
    ghost:     { bg: 'transparent',         fg: 'var(--c-slate)' },
    dark:      { bg: 'rgba(255,255,255,0.10)', fg: '#fff' },
  };
  const v = variants[variant];
  const heights = { sm: 32, md: 40, lg: 48 };
  const h = heights[size];
  return (
    <button onClick={onClick} disabled={disabled} type={type || 'button'} style={{
      height: h, padding: '0 ' + (size === 'sm' ? 12 : 16) + 'px',
      borderRadius: 10, background: v.bg, color: v.fg, border: v.border || 'none',
      fontWeight: 500, fontSize: size === 'sm' ? 13 : 15, letterSpacing: 0.1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      opacity: disabled ? 0.4 : 1, width: full ? '100%' : undefined, whiteSpace: 'nowrap', ...style,
    }}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

// ─── Sheet (bottom modal) ────────────────────────────────────
function Sheet({ open, onClose, title, children, footer, height }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      {/* scrim */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(31,44,44,0.45)',
        animation: 'bappy-fade 0.2s ease',
      }} />
      <div style={{
        position: 'relative', background: '#fff',
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
        maxHeight: height || '85%',
        display: 'flex', flexDirection: 'column',
        animation: 'bappy-slide-up 0.28s cubic-bezier(.2,.7,.2,1)',
      }}>
        {/* handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--c-haze-teal)', opacity: 0.5 }} />
        </div>
        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px 12px',
            borderBottom: '1px solid var(--c-border)',
          }}>
            <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--c-deep-ink)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 999, background: 'var(--c-ice-wash)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--c-slate)', flexShrink: 0,
            }}><Icon name="close" size={16} /></button>
          </div>
        )}
        <div className="bappy-scroll" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {children}
        </div>
        {footer && (
          <div style={{
            padding: 16, borderTop: '1px solid var(--c-border)',
            paddingBottom: 24,
          }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

// ─── Section header ──────────────────────────────────────────
function SectionHeader({ children, right, style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 16px 8px', ...style,
    }}>
      <div style={{
        fontSize: 13, fontWeight: 500, color: 'var(--c-slate-mute)',
        textTransform: 'uppercase', letterSpacing: 1,
      }}>{children}</div>
      {right}
    </div>
  );
}

// ─── List row ────────────────────────────────────────────────
function ListRow({ icon, title, subtitle, right, trailing, onClick, last, indent }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderBottom: last ? 'none' : '1px solid var(--c-border)',
      cursor: onClick ? 'pointer' : undefined,
      paddingLeft: indent ? 16 + indent : 16,
    }}>
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, color: 'var(--c-deep-ink)', fontWeight: 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</div>
        {subtitle && (
          <div style={{
            fontSize: 12, color: 'var(--c-slate-mute)', marginTop: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{subtitle}</div>
        )}
      </div>
      {right && <div style={{ textAlign: 'right' }}>{right}</div>}
      {trailing}
    </div>
  );
}

// ─── Severity dot ────────────────────────────────────────────
function SeverityDot({ severity, size = 8 }) {
  const colors = { info: 'var(--c-ocean-teal)', warning: 'var(--c-amber)', alert: 'var(--c-coral)' };
  return <span style={{
    display: 'inline-block', width: size, height: size,
    borderRadius: 999, background: colors[severity] || colors.info,
    flexShrink: 0,
  }} />;
}

// ─── Channel pill ────────────────────────────────────────────
function ChannelPill({ channel }) {
  const map = {
    in_app:   { glyph: 'ch-app',  label: 'In-app' },
    email:    { glyph: 'ch-mail', label: 'Email' },
    web_push: { glyph: 'ch-push', label: 'Push' },
  };
  const m = map[channel];
  if (!m) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'var(--c-ice-wash)', color: 'var(--c-ocean-teal)',
      padding: '3px 8px 3px 6px', borderRadius: 999,
      fontSize: 11, fontWeight: 500,
    }}>
      <Icon name={m.glyph} size={11} strokeWidth={2} />
      {m.label}
    </span>
  );
}

// ─── EmptyState ──────────────────────────────────────────────
function EmptyState({ glyph = 'spark2', title, body, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 12, padding: '48px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 999, background: 'var(--c-ice-wash)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--c-ocean-teal)',
      }}>
        <Icon name={glyph} size={28} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--c-deep-ink)' }}>{title}</div>
        {body && <div style={{ fontSize: 13, color: 'var(--c-slate-mute)', marginTop: 4 }}>{body}</div>}
      </div>
      {action}
    </div>
  );
}

// ─── Toggle ──────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      width: 44, height: 26, borderRadius: 999,
      background: value ? 'var(--c-ocean-teal)' : '#D6DBDB',
      position: 'relative', transition: 'background 0.18s ease',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 2, left: value ? 20 : 2,
        width: 22, height: 22, borderRadius: 999, background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
        transition: 'left 0.18s ease',
      }} />
    </button>
  );
}

// ─── Segmented control ──────────────────────────────────────
function Segmented({ options, value, onChange, dark }) {
  return (
    <div style={{
      display: 'flex', gap: 2, padding: 3,
      background: dark ? 'rgba(255,255,255,0.10)' : 'var(--c-ice-wash)',
      borderRadius: 10,
    }}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)} style={{
            flex: 1, height: 30, borderRadius: 8,
            background: active ? (dark ? 'rgba(255,255,255,0.92)' : '#fff') : 'transparent',
            color: active ? (dark ? 'var(--c-deep-ink)' : 'var(--c-ocean-teal)')
                          : (dark ? 'rgba(255,255,255,0.65)' : 'var(--c-slate-mute)'),
            fontSize: 13, fontWeight: 500, letterSpacing: 0.1,
            boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.16s',
            whiteSpace: 'nowrap', padding: '0 6px',
          }}>{opt.label}</button>
        );
      })}
    </div>
  );
}

// ─── Stepper ─────────────────────────────────────────────────
function Stepper({ steps, current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px 12px' }}>
      {steps.map((s, i) => {
        const done = i < current, active = i === current;
        return (
          <React.Fragment key={i}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, opacity: done || active ? 1 : 0.4,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 999,
                background: done ? 'var(--c-seafoam)' : active ? 'var(--c-ocean-teal)' : '#D6DBDB',
                color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600,
              }}>{done ? <Icon name="check" size={12} strokeWidth={3} color="#fff" /> : i + 1}</div>
              <span style={{ fontSize: 12, fontWeight: 500, color: active ? 'var(--c-deep-ink)' : 'var(--c-slate-mute)' }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export { IconContainer, Card, Tag, ProgressBar, Button, Sheet, SectionHeader, ListRow, SeverityDot, ChannelPill, EmptyState, Toggle, Segmented, Stepper, tintBg };