import type { Graph, GraphNode } from '../core/model';

export interface TimelineBar { key: string; node: GraphNode; x: number; width: number }
export interface TimelineRow { epicKey: string; label: string; bars: TimelineBar[] }
export interface TimelineModel {
  rows: TimelineRow[];
  undated: GraphNode[];
  dependencies: Array<{ fromKey: string; toKey: string }>;
  minMs: number; maxMs: number;
}

const DAY = 86_400_000;
const ms = (iso?: string) => (iso ? Date.parse(iso) : NaN);

export function buildTimeline(graph: Graph, pixelWidth: number): TimelineModel {
  const dated = graph.nodes.filter((n) => n.dueDate || n.startDate);
  const undated = graph.nodes.filter((n) => !n.dueDate && !n.startDate);

  // time span across all start/due values
  let minMs = Infinity, maxMs = -Infinity;
  for (const n of dated) {
    const s = ms(n.startDate), d = ms(n.dueDate);
    for (const v of [s, d]) if (!Number.isNaN(v)) { minMs = Math.min(minMs, v); maxMs = Math.max(maxMs, v); }
  }
  if (!Number.isFinite(minMs)) { minMs = 0; maxMs = DAY; }
  if (maxMs === minMs) maxMs = minMs + DAY;
  const scale = pixelWidth / (maxMs - minMs);
  const xOf = (v: number) => (v - minMs) * scale;

  const bar = (n: GraphNode): TimelineBar => {
    const s = Number.isNaN(ms(n.startDate)) ? ms(n.dueDate) : ms(n.startDate);
    const e = Number.isNaN(ms(n.dueDate)) ? ms(n.startDate) : ms(n.dueDate);
    const x = xOf(Math.min(s, e));
    const width = Math.max(6, xOf(Math.max(s, e)) - x);
    return { key: n.key, node: n, x, width };
  };

  // group dated issues by their epic (via hierarchy edges); fall back to '__no_epic__'
  const epicOf = new Map<string, string>();
  for (const e of graph.edges) if (e.kind === 'hierarchy') epicOf.set(e.target, e.source);
  const rowMap = new Map<string, TimelineRow>();
  const nodeMap = new Map(graph.nodes.map((n) => [n.key, n]));
  for (const n of dated) {
    if (n.type.kind === 'epic') continue; // epics are row headers, not bars
    let epicKey = epicOf.get(n.key) ?? '__no_epic__';
    // climb to the epic level if the immediate parent is a story/task
    let guard = 0;
    while (epicKey !== '__no_epic__' && nodeMap.get(epicKey)?.type.kind !== 'epic' && guard++ < 10) {
      epicKey = epicOf.get(epicKey) ?? '__no_epic__';
    }
    // If the guard expired on a malformed/cyclic parent chain, fall back to "No epic"
    // rather than labelling the row with a non-epic ticket's summary.
    if (epicKey !== '__no_epic__' && nodeMap.get(epicKey)?.type.kind !== 'epic') epicKey = '__no_epic__';
    const label = epicKey === '__no_epic__' ? 'No epic' : (nodeMap.get(epicKey)?.summary ?? epicKey);
    const row = rowMap.get(epicKey) ?? { epicKey, label, bars: [] };
    if (!rowMap.has(epicKey)) rowMap.set(epicKey, row);
    row.bars.push(bar(n));
  }

  const datedKeys = new Set(dated.map((n) => n.key));
  const dependencies = graph.edges
    .filter((e) => e.kind === 'link' && e.relation === 'blocks' && datedKeys.has(e.source) && datedKeys.has(e.target))
    .map((e) => ({ fromKey: e.source, toKey: e.target }));

  return { rows: [...rowMap.values()], undated, dependencies, minMs, maxMs };
}
