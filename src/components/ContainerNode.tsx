import { Handle, Position } from '@xyflow/react';
import './grouped.css';

const TINT = ['#7b61ff', '#3ebd93', '#2186eb']; // depth 0,1,2 accent
const TINT_BG = ['rgba(123,97,255,.05)', 'rgba(62,189,147,.04)', 'rgba(33,134,235,.04)'];
const TINT_BORDER = ['rgba(123,97,255,.35)', 'rgba(62,189,147,.30)', 'rgba(33,134,235,.28)'];

export function ContainerNode({ data }: { data: { node: { key: string; summary: string } | null; depth: number; collapsed: boolean; width?: number; height?: number; onToggle?: (key: string) => void } }) {
  const { node, depth, collapsed, onToggle } = data;
  const accent = TINT[Math.min(depth, TINT.length - 1)];
  const bgColor = TINT_BG[Math.min(depth, TINT_BG.length - 1)];
  const borderColor = TINT_BORDER[Math.min(depth, TINT_BORDER.length - 1)];

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
