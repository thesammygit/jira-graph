import { useMemo, useRef, useState, useEffect } from 'react';
import type { Graph } from '../core/model';
import type { GraphState } from '../state/graphReducer';
import { buildTimeline } from '../graph/timeline';
import './timeline.css';

const KIND_COLOR: Record<string, string> = { epic: '#7b61ff', story: '#3ebd93', task: '#2186eb', subtask: '#a0aec0', bug: '#e12d39', other: '#7b8794' };
const ROW_H = 38, BAR_H = 22;
const LABEL_W = 220; // left-gutter width

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Compute UTC month-start boundaries between minMs and maxMs. */
function monthBoundaries(minMs: number, maxMs: number, scale: number): Array<{ x: number; label: string }> {
  const result: Array<{ x: number; label: string }> = [];
  const d = new Date(minMs);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() + 1); // start at the first month boundary after minMs
  while (d.getTime() <= maxMs) {
    const x = (d.getTime() - minMs) * scale;
    result.push({ x, label: `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}` });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return result;
}

export function TimelineView({ graph, state, onSelect }: { graph: Graph; state: GraphState; onSelect: (k: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => { if (ref.current) setWidth(Math.max(600, ref.current.clientWidth - LABEL_W)); }, []);

  const tl = useMemo(() => buildTimeline(graph, width), [graph, width]);
  const visible = (kind: string, cat: string) => !state.hiddenTypes.has(kind as any) && !state.hiddenStatuses.has(cat as any);
  const hasBars = tl.rows.some((r) => r.bars.length);

  if (!hasBars) {
    return (
      <div className="timeline timeline-empty-wrap" ref={ref}>
        <div className="timeline-empty">No scheduled issues. This dataset has no start/due dates — try the Cloud v3 sample, or pick a different mode.</div>
      </div>
    );
  }

  const scale = tl.maxMs > tl.minMs ? width / (tl.maxMs - tl.minMs) : 1;
  const months = monthBoundaries(tl.minMs, tl.maxMs, scale);

  // First pass: calculate rendered bar positions for dependency arrows
  const AXIS_H = 28; // height reserved for the date axis at the top
  const barPos = new Map<string, { cx: number; cy: number; rx: number }>();
  let yCalc = AXIS_H;
  for (const row of tl.rows) {
    yCalc += ROW_H; // epic header row
    for (const b of row.bars) {
      if (!visible(b.node.type.kind, b.node.status.category)) continue;
      const bx = LABEL_W + b.x;
      const by = yCalc + (ROW_H - BAR_H) / 2;
      barPos.set(b.key, { cx: bx, cy: by, rx: b.width });
      yCalc += ROW_H;
    }
  }

  // Total SVG height
  const svgH = tl.rows.reduce((s, r) => {
    const visibleBars = r.bars.filter((b) => visible(b.node.type.kind, b.node.status.category));
    return s + ROW_H * (1 + visibleBars.length);
  }, AXIS_H + 8);

  let y = AXIS_H;

  return (
    <div className="timeline" ref={ref}>
      <svg width={width + LABEL_W} height={svgH}>
        {/* ── Arrowhead marker def ── */}
        <defs>
          <marker id="tl-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#e12d39" opacity={0.7} />
          </marker>
        </defs>

        {/* ── Date axis ── */}
        <g className="tl-axis">
          {/* Axis baseline */}
          <line x1={LABEL_W} y1={AXIS_H - 1} x2={LABEL_W + width} y2={AXIS_H - 1} stroke="#e1e7ef" strokeWidth={1} />
          {months.map((m, i) => (
            <g key={i}>
              {/* Vertical gridline */}
              <line
                x1={LABEL_W + m.x} y1={0}
                x2={LABEL_W + m.x} y2={svgH}
                stroke="#e1e7ef" strokeWidth={1}
                strokeDasharray="3 4"
              />
              {/* Month label */}
              <text x={LABEL_W + m.x + 5} y={AXIS_H - 6} className="tl-month">{m.label}</text>
            </g>
          ))}
        </g>

        {/* ── Rows ── */}
        {tl.rows.map((row) => {
          const headerY = y; y += ROW_H;
          const header = (
            <text key={`h-${row.epicKey}`} x={8} y={headerY + 20} className="tl-epic">{row.label}</text>
          );
          const bars = row.bars.filter((b) => visible(b.node.type.kind, b.node.status.category)).map((b) => {
            const by = y; y += ROW_H;
            const bx = LABEL_W + b.x;
            const barW = Math.max(8, b.width);
            return (
              <g key={b.key} className="tl-bar" onClick={() => onSelect(b.key)} role="button" aria-label={b.key}>
                <rect
                  x={bx} y={by + (ROW_H - BAR_H) / 2}
                  width={barW} height={BAR_H}
                  rx={6}
                  fill={KIND_COLOR[b.node.type.kind]}
                  opacity={0.88}
                  className="tl-bar-rect"
                />
                {/* Summary text clipped inside bar */}
                <text
                  x={bx + 6} y={by + ROW_H / 2 + 4}
                  className="tl-sum"
                  clipPath={`url(#clip-${b.key})`}
                >{b.node.summary}</text>
                <clipPath id={`clip-${b.key}`}>
                  <rect x={bx + 4} y={by} width={Math.max(0, barW - 8)} height={ROW_H} />
                </clipPath>
                {/* Key label in left gutter */}
                <text x={8} y={by + ROW_H / 2 + 4} className="tl-key">{b.key}</text>
              </g>
            );
          });
          return <g key={row.epicKey}>{header}{bars}</g>;
        })}

        {/* ── Dependency arrows (blocks) ── */}
        {tl.dependencies.map(({ fromKey, toKey }) => {
          const from = barPos.get(fromKey);
          const to = barPos.get(toKey);
          if (!from || !to) return null;
          // Arrow from right-center of source to left-center of target
          const x1 = from.cx + from.rx;
          const y1 = from.cy + BAR_H / 2;
          const x2 = to.cx;
          const y2 = to.cy + BAR_H / 2;
          const dx = Math.abs(x2 - x1) * 0.4;
          const path = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
          return (
            <path
              key={`dep-${fromKey}-${toKey}`}
              d={path}
              className="tl-dep"
              markerEnd="url(#tl-arrow)"
            />
          );
        })}
      </svg>

      {tl.undated.length > 0 && (
        <div className="tl-undated">
          <span className="tl-undated-label">No dates</span>
          {tl.undated.map((u) => (
            <button key={u.key} onClick={() => onSelect(u.key)} className="tl-chip">{u.key}</button>
          ))}
        </div>
      )}
    </div>
  );
}
