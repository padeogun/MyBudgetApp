import React from 'react'
import { useBappy, BappyUtil } from './bappy-state.jsx'
import { Icon } from './bappy-icons.jsx'
import { Card, Tag, Button, Segmented } from './bappy-primitives.jsx'
// Bappy charts — hand-rolled SVG, brand-cohesive
const chartPalette = {
  primary: '#02A8B9',
  primaryFaint: '#02A8B922',
  seafoam: '#03BCA5',
  amber: '#F4A535',
  coral: '#E8566A',
  grid: '#E0F4F6',
  axis: '#A8D2D6',
  text: '#7A8181',
  ink: '#1F2C2C',
};

// ─── Sparkline ───────────────────────────────────────────────
// Uses viewBox so it fills 100% of its container width naturally.
// width/height define the internal coordinate space (viewBox); height is also the rendered height.
function Sparkline({ values, width = 120, height = 32, color = chartPalette.primary, fill = true, strokeWidth = 1.5, dots = false }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 4) - 2]);
  const linePath = splinePath(points);
  const areaPath = linePath + ` L${width} ${height} L0 ${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      {fill && <path d={areaPath} fill={color} opacity={0.12} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {dots && points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={2} fill={color} />
      ))}
    </svg>
  );
}

// ─── Catmull-Rom → cubic bezier spline ───────────────────────
// Converts a polyline into a smooth SVG cubic bezier path that passes
// through every point. alpha=1/6 gives the standard Catmull-Rom tension.
function splinePath(pts, alpha = 1 / 6) {
  if (pts.length < 2) return '';
  const d = [`M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = (p1[0] + (p2[0] - p0[0]) * alpha).toFixed(1);
    const cp1y = (p1[1] + (p2[1] - p0[1]) * alpha).toFixed(1);
    const cp2x = (p2[0] - (p3[0] - p1[0]) * alpha).toFixed(1);
    const cp2y = (p2[1] - (p3[1] - p1[1]) * alpha).toFixed(1);
    d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`);
  }
  return d.join(' ');
}

// ─── Area chart (cash flow) ──────────────────────────────────
function AreaChart({ series, width = 340, height = 180, markers = [], floor, color = chartPalette.primary, dark = false }) {
  if (!series || series.length < 2) return null;
  const padL = 38, padR = 12, padT = 16, padB = 28;
  const W = width - padL - padR, H = height - padT - padB;

  const values = series.map(s => s.balance);
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const scaleX = (i) => padL + (i / (series.length - 1)) * W;
  const scaleY = (v) => padT + H - ((v - min) / range) * H;

  const pts = series.map((s, i) => [scaleX(i), scaleY(s.balance)]);
  const linePath = splinePath(pts);
  const areaPath = linePath + ` L${scaleX(series.length - 1)} ${padT + H} L${padL} ${padT + H} Z`;

  // Y-axis ticks (4)
  const ticks = [];
  for (let i = 0; i <= 4; i++) {
    const v = min + (range * i / 4);
    ticks.push({ y: scaleY(v), label: BappyUtil.fmtGBPCompact(v) });
  }

  // X-axis ticks: first, mid, last
  const xticks = [0, Math.floor(series.length / 2), series.length - 1].map(i => ({
    x: scaleX(i), label: BappyUtil.fmtDateShort(series[i].date),
  }));

  const gridC = dark ? 'rgba(255,255,255,0.10)' : chartPalette.grid;
  const axisC = dark ? 'rgba(255,255,255,0.45)' : chartPalette.text;

  return (
    <svg width={width} height={height}>
      <defs>
        <linearGradient id="areagrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* grid + y labels */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={t.y} x2={width - padR} y2={t.y} stroke={gridC} strokeDasharray="2,4" />
          <text x={padL - 6} y={t.y + 3} fontSize="10" textAnchor="end" fill={axisC} fontFamily="Roboto Mono">{t.label}</text>
        </g>
      ))}
      {/* floor line */}
      {floor !== undefined && floor > min && floor < max && (
        <g>
          <line x1={padL} y1={scaleY(floor)} x2={width - padR} y2={scaleY(floor)}
                stroke={chartPalette.coral} strokeDasharray="3,3" strokeWidth="1" />
          <text x={width - padR - 2} y={scaleY(floor) - 4} fontSize="9.5" textAnchor="end"
                fill={chartPalette.coral} fontFamily="Roboto Mono">floor</text>
        </g>
      )}
      {/* area + line */}
      <path d={areaPath} fill="url(#areagrad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* markers (liquidity alerts) */}
      {markers.map((m, i) => {
        const idx = series.findIndex(s => s.date === m.date);
        if (idx < 0) return null;
        const x = scaleX(idx), y = scaleY(series[idx].balance);
        return (
          <g key={i}>
            <line x1={x} y1={padT} x2={x} y2={padT + H} stroke={chartPalette.coral} strokeDasharray="2,3" strokeWidth="1" opacity="0.7" />
            <circle cx={x} cy={y} r={5} fill="#fff" stroke={chartPalette.coral} strokeWidth="2" />
          </g>
        );
      })}
      {/* x labels */}
      {xticks.map((t, i) => (
        <text key={i} x={t.x} y={height - 8} fontSize="10" textAnchor="middle" fill={axisC} fontFamily="Roboto">{t.label}</text>
      ))}
    </svg>
  );
}

// ─── Donut chart ─────────────────────────────────────────────
function Donut({ segments, size = 140, thickness = 18, centerLabel, centerSub }) {
  const r = (size - thickness) / 2;
  const c = size / 2;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let cum = 0;
  return (
    <svg width={size} height={size}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#F1F5F6" strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const frac = seg.value / total;
        const len = 2 * Math.PI * r;
        const dash = frac * len;
        const offset = -cum * len + len / 4; // rotate to start at top
        cum += frac;
        return (
          <circle key={i} cx={c} cy={c} r={r} fill="none"
            stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${len - dash}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${c} ${c})`}
            style={{ transition: 'stroke-dasharray 0.4s' }}
          />
        );
      })}
      {centerLabel && (
        <text x={c} y={c - 2} textAnchor="middle" fontSize="20" fontWeight="500"
              fill={chartPalette.ink} fontFamily="Roboto" fontVariantNumeric="tabular-nums">
          {centerLabel}
        </text>
      )}
      {centerSub && (
        <text x={c} y={c + 16} textAnchor="middle" fontSize="11" fill={chartPalette.text} fontFamily="Roboto">
          {centerSub}
        </text>
      )}
    </svg>
  );
}

// ─── Bar chart ───────────────────────────────────────────────
function BarChart({ bars, width = 340, height = 140, color = chartPalette.primary, labelMode = 'short' }) {
  const padL = 32, padR = 8, padT = 16, padB = 22;
  const W = width - padL - padR, H = height - padT - padB;
  const max = Math.max(...bars.map(b => b.value), 1);
  const barW = W / bars.length;
  const innerW = Math.min(barW * 0.65, 22);
  return (
    <svg width={width} height={height}>
      {[0, 0.5, 1].map((f, i) => (
        <line key={i} x1={padL} y1={padT + H - f * H} x2={width - padR} y2={padT + H - f * H}
              stroke={chartPalette.grid} strokeDasharray="2,3" />
      ))}
      {bars.map((b, i) => {
        const h = (b.value / max) * H;
        const x = padL + i * barW + (barW - innerW) / 2;
        return (
          <g key={i}>
            <rect x={x} y={padT + H - h} width={innerW} height={h}
                  rx="3" fill={b.color || color} />
            <text x={padL + i * barW + barW / 2} y={height - 8}
                  textAnchor="middle" fontSize="10" fill={chartPalette.text} fontFamily="Roboto">
              {b.label}
            </text>
          </g>
        );
      })}
      <text x={padL - 4} y={padT + 4} textAnchor="end" fontSize="9.5"
            fill={chartPalette.text} fontFamily="Roboto Mono">
        {BappyUtil.fmtGBPCompact(max)}
      </text>
    </svg>
  );
}

// ─── Stacked debt curves (all-debts) ─────────────────────────
function StackedDebtChart({ debts, width = 340, height = 180, monthsCap = 60 }) {
  // debts: array of { name, color, curve: [{month, balance}] }
  const padL = 38, padR = 12, padT = 12, padB = 24;
  const W = width - padL - padR, H = height - padT - padB;
  // Determine months to chart
  const maxMonths = Math.min(monthsCap, Math.max(...debts.map(d => d.curve.length)));
  // Build stacked points at each month
  const monthly = [];
  for (let m = 0; m < maxMonths; m++) {
    const layers = debts.map(d => {
      const pt = d.curve[Math.min(m, d.curve.length - 1)];
      return pt ? pt.balance : 0;
    });
    monthly.push(layers);
  }
  const maxTotal = Math.max(...monthly.map(layers => layers.reduce((s, v) => s + v, 0)), 1);

  const scaleX = (i) => padL + (i / (maxMonths - 1)) * W;
  const scaleY = (v) => padT + H - (v / maxTotal) * H;

  // Build cumulative areas
  const areas = [];
  for (let li = 0; li < debts.length; li++) {
    const lower = monthly.map(l => l.slice(0, li).reduce((s, v) => s + v, 0));
    const upper = monthly.map(l => l.slice(0, li + 1).reduce((s, v) => s + v, 0));
    const top = upper.map((v, i) => `${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(' L');
    const bot = lower.map((v, i) => `${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`).reverse().join(' L');
    areas.push({ path: `M${top} L${bot} Z`, color: debts[li].color });
  }

  // Find debt-free month
  const totals = monthly.map(l => l.reduce((s, v) => s + v, 0));
  const freeIdx = totals.findIndex(t => t < 1);

  return (
    <svg width={width} height={height}>
      {[0, 0.5, 1].map((f, i) => (
        <line key={i} x1={padL} y1={padT + f * H} x2={width - padR} y2={padT + f * H}
              stroke={chartPalette.grid} strokeDasharray="2,3" />
      ))}
      <text x={padL - 4} y={padT + 4} textAnchor="end" fontSize="9.5"
            fill={chartPalette.text} fontFamily="Roboto Mono">
        {BappyUtil.fmtGBPCompact(maxTotal)}
      </text>
      <text x={padL - 4} y={padT + H + 4} textAnchor="end" fontSize="9.5"
            fill={chartPalette.text} fontFamily="Roboto Mono">£0</text>
      {areas.map((a, i) => (
        <path key={i} d={a.path} fill={a.color} opacity={0.85} />
      ))}
      {freeIdx > 0 && (
        <g>
          <line x1={scaleX(freeIdx)} y1={padT} x2={scaleX(freeIdx)} y2={padT + H}
                stroke={chartPalette.seafoam} strokeDasharray="3,3" strokeWidth="1.5" />
          <circle cx={scaleX(freeIdx)} cy={padT + H} r={4} fill={chartPalette.seafoam} />
          <text x={scaleX(freeIdx)} y={padT - 2} fontSize="10" textAnchor="middle"
                fill={chartPalette.seafoam} fontFamily="Roboto" fontWeight="500">
            free · {freeIdx}mo
          </text>
        </g>
      )}
      {/* X axis labels */}
      <text x={padL} y={height - 8} fontSize="10" fill={chartPalette.text} fontFamily="Roboto">now</text>
      <text x={width - padR} y={height - 8} fontSize="10" textAnchor="end" fill={chartPalette.text} fontFamily="Roboto">{maxMonths}mo</text>
    </svg>
  );
}

// ─── Per-debt curve (one debt simulation) ───────────────────
function DebtCurve({ baseline, withExtra, width = 340, height = 160 }) {
  // baseline / withExtra : [{month, balance}]
  const padL = 38, padR = 12, padT = 14, padB = 24;
  const W = width - padL - padR, H = height - padT - padB;
  const allMonths = Math.max(baseline.length, withExtra.length);
  const maxBal = Math.max(...baseline.map(p => p.balance), ...withExtra.map(p => p.balance)) || 1;

  const sx = (m) => padL + (m / (allMonths - 1)) * W;
  const sy = (v) => padT + H - (v / maxBal) * H;

  const toPath = (curve) => splinePath(curve.map(p => [sx(p.month), sy(p.balance)]));

  const baseEnd = baseline[baseline.length - 1];
  const extraEnd = withExtra[withExtra.length - 1];

  return (
    <svg width={width} height={height}>
      {[0, 0.5, 1].map((f, i) => (
        <line key={i} x1={padL} y1={padT + f * H} x2={width - padR} y2={padT + f * H}
              stroke={chartPalette.grid} strokeDasharray="2,3" />
      ))}
      <text x={padL - 4} y={padT + 4} textAnchor="end" fontSize="9.5"
            fill={chartPalette.text} fontFamily="Roboto Mono">
        {BappyUtil.fmtGBPCompact(maxBal)}
      </text>
      <path d={toPath(baseline)} fill="none" stroke={chartPalette.text} strokeWidth={1.5}
            strokeDasharray="4,3" strokeLinecap="round" />
      <path d={toPath(withExtra)} fill="none" stroke={chartPalette.seafoam} strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" />
      {/* End markers */}
      <circle cx={sx(baseEnd.month)} cy={sy(baseEnd.balance)} r={3.5} fill="#fff" stroke={chartPalette.text} strokeWidth="1.5" />
      <circle cx={sx(extraEnd.month)} cy={sy(extraEnd.balance)} r={3.5} fill={chartPalette.seafoam} />
      <text x={padL} y={height - 8} fontSize="10" fill={chartPalette.text} fontFamily="Roboto">now</text>
      <text x={width - padR} y={height - 8} fontSize="10" textAnchor="end" fill={chartPalette.text} fontFamily="Roboto">
        {allMonths}mo
      </text>
    </svg>
  );
}

// ─── Responsive container width hook ────────────────────────
function useContainerWidth(fallback = 340) {
  const ref = React.useRef(null);
  const [width, setWidth] = React.useState(fallback);
  React.useEffect(() => {
    if (!ref.current) return;
    const w = ref.current.offsetWidth;
    if (w > 0) setWidth(w);
    const obs = new ResizeObserver(entries => {
      const cw = entries[0].contentRect.width;
      if (cw > 0) setWidth(cw);
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, width];
}

export { chartPalette, Sparkline, AreaChart, Donut, BarChart, StackedDebtChart, DebtCurve, useContainerWidth };
