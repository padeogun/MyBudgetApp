import React from 'react'
// Bappy icons — simple line/glyph SVGs, currentColor, 24x24 viewBox
const ICON_PATHS = {
  // Category glyphs
  cart: 'M5 6h15l-1.5 8.5a2 2 0 0 1-2 1.6H9.5a2 2 0 0 1-2-1.6L5 4H2 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  tube: 'M5 10c0-3 3-5 7-5s7 2 7 5v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7zM5 12h14M9 16h.01M15 16h.01',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
  home: 'M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1v-9z',
  fork: 'M7 3v8a3 3 0 0 0 3 3v7M13 3v18M17 3c-1 4-1 6 0 8s2 1 2-1V3',
  play: 'M5 4l14 8L5 20V4z',
  spark: 'M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z',
  shirt: 'M4 7l5-3 1 2h4l1-2 5 3-2 4-3-1v10H9V10L6 11 4 7z',
  box: 'M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7M12 11v10',
  ticket: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7zM10 5v14',
  card: 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7zm0 4h20',
  'arrow-in': 'M12 3v14m0 0l-5-5m5 5l5-5M5 21h14',
  swap: 'M7 7h12m0 0l-3-3m3 3l-3 3M17 17H5m0 0l3 3m-3-3l3-3',
  dot: 'M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm5 17h.01',
  car:   'M5 11l2-5h10l2 5H5zm-2 0h18v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7zm5 5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zm7 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0',
  bag:   'M6 5h12l2 15H4L6 5zm2-1a4 4 0 0 1 8 0',
  child: 'M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5 22v-2a7 7 0 0 1 14 0v2',
  // Nav
  'nav-home': 'M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1v-9z',
  'nav-money': 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM12 9v6m-3-3h6',
  'nav-plan': 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 8l3 3 5-5M7 2v4M17 2v4',
  'nav-insights': 'M3 21V3m18 18H3m4-3V11m5 7V6m5 12v-9',
  'nav-more': 'M4 12h.01M12 12h.01M20 12h.01',
  // Actions
  bell: 'M6 8a6 6 0 1 1 12 0c0 5 2 7 2 7H4s2-2 2-7zm3 11a3 3 0 0 0 6 0',
  plus: 'M12 5v14M5 12h14',
  'chev-right': 'M9 6l6 6-6 6',
  'chev-left': 'M15 6l-6 6 6 6',
  'chev-down': 'M6 9l6 6 6-6',
  'chev-up': 'M6 15l6-6 6 6',
  close: 'M6 6l12 12M6 18L18 6',
  check: 'M5 12l5 5L20 7',
  edit: 'M16 4l4 4-10 10H6v-4L16 4zM14 6l4 4',
  trash: 'M4 7h16M9 7V4h6v3m1 0v13H8V7M10 11v6m4-6v6',
  dots: 'M6 12h.01M12 12h.01M18 12h.01',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm5 12l5 5',
  // Account types
  'acc-bank': 'M3 9l9-5 9 5v2H3V9zM5 11v7m4-7v7m6-7v7m4-7v7M3 20h18',
  'acc-savings': 'M5 8a4 4 0 0 1 8-1h4l2 2-1 2 1 2v3a2 2 0 0 1-2 2h-2l-1 2h-3v-2h-2v2H6l-1-2H4v-4a3 3 0 0 1 1-2V8zm3 1h.01',
  'acc-credit': 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7zm0 4h20M6 16h4',
  'acc-loan': 'M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v3H3V6zm0 3h18v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9zM8 14h8',
  // Channels
  'ch-app': 'M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 16h2',
  'ch-mail': 'M3 7l9 6 9-6M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-9-4-9 4z',
  'ch-push': 'M12 3a7 7 0 0 1 7 7v5l2 2H3l2-2v-5a7 7 0 0 1 7-7zm-2 17a2 2 0 0 0 4 0',
  filter: 'M3 5h18l-7 8v6l-4-2v-4L3 5z',
  download: 'M12 4v12m0 0l-5-5m5 5l5-5M4 20h16',
  warn: 'M12 3l10 18H2L12 3zm0 7v5m0 3v.01',
  info: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 6v6m0-9v.01',
  google: 'M21 12c0 5-4 9-9 9s-9-4-9-9 4-9 9-9c2 0 4 1 6 2l-2 2c-1-1-2-1-4-1a6 6 0 1 0 6 7h-6v-3h9c0 1 0 1 0 2z',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8m0-5v5h-5M21 12a9 9 0 0 1-15 6.7L3 16m0 5v-5h5',
  spark2: 'M5 12s2-5 7-5 7 5 7 5-2 5-7 5-7-5-7-5zm7 0a0 0 0 1 0 0 0 0 0 1 0 0 0z',
  star: 'M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6z',
  shield: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z',
  cog: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 0V3l3 1m-3-1L9 4m3 16v-3l3-1m-3 1l-3-1m12-3l-3-3v3l3-3zm0-6l-3 3v-3l3 3zM4 10l3-3v3L4 10zm0 4l3 3v-3l-3 3z',
  // Logo mark — concentric rings ('orbital')
  'logo': 'M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0M12 12m-1.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0'
};

function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.75, fill = 'none', style }) {
  const path = ICON_PATHS[name];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
      <path d={path} fill={fill} stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" />
    </svg>);

}

// Logo wordmark — small orbital mark + 'bappy'
function BappyLogo({ size = 22, color = '#02A8B9', dark = false }) {
  const text = dark ? '#fff' : '#1F2C2C';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <svg width={size} height={size} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="1.5" opacity="0.4" />
        <circle cx="12" cy="12" r="6" fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" />
        <circle cx="12" cy="12" r="2.5" fill={color} />
        <circle cx="20" cy="6" r="1.6" fill={color} />
      </svg>
      <span style={{
        fontFamily: 'Roboto, sans-serif', fontWeight: 500,
        fontSize: size * 0.85, letterSpacing: -0.3,
        color: text
      }}>Bappy</span>
    </div>);

}

export { Icon, BappyLogo, ICON_PATHS };