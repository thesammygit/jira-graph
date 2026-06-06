import { Handle, Position } from '@xyflow/react';
import './TicketNode.css';

/** The "+N more" cell at the end of a capped box — click to show every member. */
export function MoreChipNode({ data }: { data: { boxKey: string; label: string; onExpand?: (boxKey: string) => void } }) {
  return (
    <button className="ticket compact more-chip" onClick={() => data.onExpand?.(data.boxKey)}
      title="Show all tickets in this box">
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <span className="more-chip-label">{data.label}</span>
      <span className="more-chip-hint">show all</span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </button>
  );
}
