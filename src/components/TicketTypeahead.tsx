import { useMemo, useState } from 'react';
import type { Dispatch } from 'react';
import type { Graph } from '../core/model';
import type { Action } from '../state/graphReducer';
import { revealAction } from '../graph/reveal';

/**
 * Unified search: typing live-highlights matches in the current view AND offers
 * a jump list — Enter (or clicking a result) reveals that ticket in Overview,
 * zoomed and highlighted (loosening Show depth/filters if they hide it).
 */
export function TicketTypeahead({ graph, dispatch }: { graph: Graph; dispatch: Dispatch<Action> }) {
  const [q, setQ] = useState('');
  // One lowercase haystack per graph — not two toLowerCase() per node per keystroke.
  const index = useMemo(() => graph.nodes.map((n) => ({ n, hay: `${n.key} ${n.summary}`.toLowerCase() })), [graph]);
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const out = [];
    for (const { n, hay } of index) {
      if (hay.includes(needle)) { out.push(n); if (out.length === 8) break; }
    }
    return out;
  }, [q, index]);
  const type = (value: string) => {
    setQ(value);
    dispatch({ type: 'setSearch', query: value }); // live highlight in the current view
  };
  const jump = (key: string) => {
    const action = revealAction(graph, key);
    if (action) dispatch(action);
    type(''); // clear the input + highlight after jumping
  };
  return (
    <div className="tt">
      <input className="sb-search" placeholder="Search · Enter reveals ticket" value={q}
        onChange={(e) => type(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches[0]) jump(matches[0].key);
          if (e.key === 'Escape') type('');
        }} />
      {matches.length > 0 && (
        <ul className="tt-list">
          {matches.map((n) => (
            <li key={n.key}><button onClick={() => jump(n.key)}><b>{n.key}</b> {n.summary}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
