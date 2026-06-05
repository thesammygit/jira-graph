import { Handle, Position } from '@xyflow/react';
import './grouped.css';

const TINT = ['#7b61ff', '#3ebd93', '#2186eb']; // depth 0,1,2 accent

export function ContainerNode({ data }: { data: { node: { key: string; summary: string } | null; depth: number; collapsed: boolean; onToggle?: (key: string) => void } }) {
  const { node, depth, collapsed, onToggle } = data;
  const accent = TINT[Math.min(depth, TINT.length - 1)];
  return (
    <div className={`container-node depth-${depth}`} style={{ borderColor: accent }}>
      <Handle type="target" position={Position.Top} />
      <div className="container-head" style={{ color: accent }}>
        <button className="caret" onClick={(e) => { e.stopPropagation(); node && onToggle?.(node.key); }}>{collapsed ? '▸' : '▾'}</button>
        <span className="ck">{node?.key}</span>
        <span className="cs">{node?.summary}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
