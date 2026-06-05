import { useMemo, useRef, useState, useEffect } from 'react';
import type { Graph } from '../core/model';
import type { GraphState } from '../state/graphReducer';
import { buildTimeline } from '../graph/timeline';
import './timeline.css';

const KIND_COLOR: Record<string, string> = { epic: '#7b61ff', story: '#3ebd93', task: '#2186eb', subtask: '#a0aec0', bug: '#e12d39', other: '#7b8794' };
const ROW_H = 38, BAR_H = 22;

export function TimelineView({ graph, state, onSelect }: { graph: Graph; state: GraphState; onSelect: (k: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => { if (ref.current) setWidth(Math.max(600, ref.current.clientWidth - 220)); }, []);

  const tl = useMemo(() => buildTimeline(graph, width), [graph, width]);
  const visible = (kind: string, cat: string) => !state.hiddenTypes.has(kind as any) && !state.hiddenStatuses.has(cat as any);
  const hasBars = tl.rows.some((r) => r.bars.length);

  if (!hasBars) {
    return <div className="timeline-empty" ref={ref}>No scheduled issues. This dataset has no start/due dates — try the Cloud v3 sample, or pick a different mode.</div>;
  }

  let y = 0;
  return (
    <div className="timeline" ref={ref}>
      <svg width={width + 240} height={tl.rows.reduce((s, r) => s + ROW_H * (r.bars.length + 1), 0) + 40}>
        {tl.rows.map((row) => {
          const headerY = y; y += ROW_H;
          const header = (
            <text key={`h-${row.epicKey}`} x={8} y={headerY + 22} className="tl-epic">{row.label}</text>
          );
          const bars = row.bars.filter((b) => visible(b.node.type.kind, b.node.status.category)).map((b) => {
            const by = y; y += ROW_H;
            return (
              <g key={b.key} className="tl-bar" onClick={() => onSelect(b.key)}>
                <rect x={220 + b.x} y={by + (ROW_H - BAR_H) / 2} width={b.width} height={BAR_H} rx={5} fill={KIND_COLOR[b.node.type.kind]} opacity={0.9} />
                <text x={8} y={by + 24} className="tl-key">{b.key}</text>
                <text x={220 + b.x + 6} y={by + 24} className="tl-sum">{b.node.summary}</text>
              </g>
            );
          });
          return <g key={row.epicKey}>{header}{bars}</g>;
        })}
      </svg>
      {tl.undated.length > 0 && (
        <div className="tl-undated"><span className="label">No dates</span> {tl.undated.map((u) => <button key={u.key} onClick={() => onSelect(u.key)}>{u.key}</button>)}</div>
      )}
    </div>
  );
}
