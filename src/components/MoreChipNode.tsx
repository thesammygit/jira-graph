import { Handle, Position } from '@xyflow/react';
import './TicketNode.css';

/** Synthetic box cell: "+N more" (capped box — click shows every member) or
 *  "N filtered" (box emptied by active filters — click clears them). */
export function MoreChipNode({ data }: { data: { boxKey: string; label: string; mode?: 'more' | 'filtered'; onExpand?: (boxKey: string, mode: 'more' | 'filtered') => void } }) {
  const mode = data.mode ?? 'more';
  return (
    <button className={`ticket compact more-chip ${mode}`} onClick={() => data.onExpand?.(data.boxKey, mode)}
      title={mode === 'filtered' ? 'These tickets are hidden by your active filters — click to clear filters' : 'Show all tickets in this box'}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <span className="more-chip-label">{data.label}</span>
      <span className="more-chip-hint">{mode === 'filtered' ? 'clear filters' : 'show all'}</span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </button>
  );
}
