import { Handle, Position } from '@xyflow/react';
import type { GraphNode } from '../core/model';
import './TicketNode.css';

export function TicketNode({ data }: { data: { node: GraphNode; selected: boolean; search: string; compact?: boolean; focal?: boolean } }) {
  const { node, selected, search, compact, focal } = data;
  const match = !!search && (node.key.toLowerCase().includes(search.toLowerCase()) || node.summary.toLowerCase().includes(search.toLowerCase()));
  const kindVar = `var(--kind-${node.type.kind})`;
  const statusVar = `var(--status-${node.status.category})`;

  if (compact) {
    return (
      <div className={`ticket compact ${selected ? 'selected' : ''} ${match ? 'match' : ''} ${focal ? 'focal' : ''} ${node.status.category === 'done' ? 'is-done' : ''}`} style={{ borderTopColor: kindVar }}>
        <Handle type="target" position={Position.Top} isConnectable={false} />
        <div className="ticket-compact-key" style={{ color: kindVar }}>{node.key}</div>
        <div className="ticket-compact-summary">{node.summary}</div>
        <div className="ticket-compact-foot">
          <span className="ticket-compact-status"
            style={{ color: statusVar, background: `color-mix(in srgb, ${statusVar} 14%, transparent)` }}>
            {node.status.name}
          </span>
          {node.storyPoints != null && <span className="ticket-compact-pts">{node.storyPoints}p</span>}
          {node.epicKey && node.type.kind !== 'epic' && (
            <span className="ticket-epic" title={node.epicSummary}>▣ {node.epicKey}</span>
          )}
        </div>
        <Handle type="source" position={Position.Bottom} isConnectable={false} />
      </div>
    );
  }

  return (
    <div className={`ticket ${selected ? 'selected' : ''} ${match ? 'match' : ''} ${focal ? 'focal' : ''} ${node.status.category === 'done' ? 'is-done' : ''}`} style={{ borderTopColor: kindVar }}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className="ticket-row">
        <span className="ticket-key" style={{ color: kindVar }}>{node.key}</span>
        <span className="ticket-type">{node.type.name}{node.priority ? ` · ${node.priority}` : ''}</span>
      </div>
      <div className="ticket-summary">{node.summary}</div>
      {node.epicKey && node.type.kind !== 'epic' && (
        <span className="ticket-epic" title={node.epicSummary}>▣ {node.epicKey}</span>
      )}
      <div className="ticket-meta">
        <span className="ticket-pill" style={{ background: `color-mix(in srgb, ${statusVar} 15%, transparent)`, color: statusVar }}>{node.status.name}</span>
        <span className="ticket-right">
          {node.storyPoints != null && <span className="ticket-pts">{node.storyPoints} pts</span>}
          {node.assignee && <span className="ticket-av" title={node.assignee.displayName}>{node.assignee.initials}</span>}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}
