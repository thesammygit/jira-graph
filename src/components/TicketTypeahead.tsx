import { useState } from 'react';
import type { Dispatch } from 'react';
import type { Graph } from '../core/model';
import type { Action } from '../state/graphReducer';

export function TicketTypeahead({ graph, dispatch }: { graph: Graph; dispatch: Dispatch<Action> }) {
  const [q, setQ] = useState('');
  const matches = q.trim()
    ? graph.nodes.filter((n) => n.key.toLowerCase().includes(q.toLowerCase()) || n.summary.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : [];
  const focus = (key: string) => { dispatch({ type: 'openSpotlight', key }); setQ(''); };
  return (
    <div className="tt">
      <input className="sb-search" placeholder="Focus a ticket…" value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) focus(matches[0].key); }} />
      {matches.length > 0 && (
        <ul className="tt-list">
          {matches.map((n) => (
            <li key={n.key}><button onClick={() => focus(n.key)}><b>{n.key}</b> {n.summary}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
