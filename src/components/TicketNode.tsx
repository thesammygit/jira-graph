import { Handle, Position } from '@xyflow/react';
import type { GraphNode } from '../core/model';
import './TicketNode.css';

const KIND_COLOR: Record<string, string> = { epic: '#7b61ff', story: '#3ebd93', task: '#2186eb', subtask: '#a0aec0', bug: '#e12d39', other: '#7b8794' };
const CAT_COLOR: Record<string, string> = { todo: '#9aa5b1', inprogress: '#f0b429', done: '#3ebd93' };

export function TicketNode({ data }: { data: { node: GraphNode; selected: boolean; search: string; compact?: boolean } }) {
  const { node, selected, search, compact } = data;
  const match = !!search && (node.key.toLowerCase().includes(search.toLowerCase()) || node.summary.toLowerCase().includes(search.toLowerCase()));
  const kindColor = KIND_COLOR[node.type.kind];
  const catColor = CAT_COLOR[node.status.category];

  if (compact) {
    return (
      <div className={`ticket compact ${selected ? 'selected' : ''} ${match ? 'match' : ''}`} style={{ borderTopColor: kindColor }}>
        <Handle type="target" position={Position.Top} />
        <div className="ticket-compact-key" style={{ color: kindColor }}>{node.key}</div>
        <div className="ticket-compact-summary">{node.summary}</div>
        <div className="ticket-compact-foot">
          <span className="ticket-compact-dot" style={{ background: catColor }} title={node.status.name} />
          {node.storyPoints != null && <span className="ticket-compact-pts">{node.storyPoints}p</span>}
        </div>
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  return (
    <div className={`ticket ${selected ? 'selected' : ''} ${match ? 'match' : ''}`} style={{ borderTopColor: kindColor }}>
      <Handle type="target" position={Position.Top} />
      <div className="ticket-row">
        <span className="ticket-key" style={{ color: kindColor }}>{node.key}</span>
        <span className="ticket-type">{node.type.name}{node.priority ? ` · ${node.priority}` : ''}</span>
      </div>
      <div className="ticket-summary">{node.summary}</div>
      <div className="ticket-meta">
        <span className="ticket-pill" style={{ background: catColor + '22', color: catColor }}>{node.status.name}</span>
        <span className="ticket-right">
          {node.storyPoints != null && <span className="ticket-pts">{node.storyPoints} pts</span>}
          {node.assignee && <span className="ticket-av" title={node.assignee.displayName}>{node.assignee.initials}</span>}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
