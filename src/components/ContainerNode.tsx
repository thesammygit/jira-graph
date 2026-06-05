import { Handle, Position } from '@xyflow/react';
import './grouped.css';

const DEPTH_KIND = ['epic', 'story', 'task']; // depth 0,1,2 → kind tokens

export function ContainerNode({ data }: { data: { node: { key: string; summary: string } | null; depth: number; collapsed: boolean; width?: number; height?: number; onToggle?: (key: string) => void } }) {
  const { node, depth, collapsed, onToggle } = data;
  const kind = DEPTH_KIND[Math.min(depth, DEPTH_KIND.length - 1)];
  const accent = `var(--kind-${kind})`;
  const borderColor = `color-mix(in srgb, var(--kind-${kind}) 35%, var(--border))`;
  const bgColor = `color-mix(in srgb, var(--kind-${kind}) 5%, transparent)`;

  return (
    <div
      className={`container-node depth-${depth} ${collapsed ? 'collapsed' : ''}`}
      style={{ borderColor, background: bgColor }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="container-head" style={{ color: accent }}>
        <button
          className="caret"
          onClick={(e) => { e.stopPropagation(); node && onToggle?.(node.key); }}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <span className="ck">{node?.key}</span>
        <span className="cs">{node?.summary}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
