import { useMemo, useRef } from 'react';
import { ControlButton, Controls, useNodes, useReactFlow, useStore, useViewport, type Node } from '@xyflow/react';
import { GROUP } from '../graph/layouts/grouped';
import { TICKET_NODE_WIDTH } from '../graph/node-dimensions';

const DEPTH_KIND = ['epic', 'story', 'task'];
const MINI_W = 260;
const MINI_H = 180;
const MINI_PAD = 12;

export function CanvasChrome({ locked, onToggleLocked }: { locked: boolean; onToggleLocked: () => void }) {
  return (
    <>
      <Controls showInteractive={false}>
        <ControlButton
          className={`canvas-lock ${locked ? 'locked' : ''}`}
          onClick={onToggleLocked}
          title={locked ? 'Unlock pan, zoom, and selection' : 'Lock pan, zoom, and selection'}
          aria-label={locked ? 'Unlock pan, zoom, and selection' : 'Lock pan, zoom, and selection'}
          aria-pressed={locked}
        >
          <LockIcon locked={locked} />
        </ControlButton>
      </Controls>
      <TicketMiniMap locked={locked} />
    </>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      {locked ? (
        <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path d="M8 10V7a4 4 0 0 1 7.3-2.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}

function TicketMiniMap({ locked }: { locked: boolean }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const nodes = useNodes();
  const viewport = useViewport();
  const { setViewport } = useReactFlow();
  const flowSize = useStore((store) => ({ width: store.width, height: store.height }));

  const model = useMemo(() => buildMiniMapModel(nodes, viewport, flowSize), [nodes, viewport, flowSize]);
  if (!model) return null;

  const pointerToGraph = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: model.bounds.x + ((event.clientX - rect.left - model.offsetX) / model.scale),
      y: model.bounds.y + ((event.clientY - rect.top - model.offsetY) / model.scale),
    };
  };

  const moveViewport = (graphX: number, graphY: number, offsetX: number, offsetY: number) => {
    setViewport({
      x: -(graphX - offsetX) * viewport.zoom,
      y: -(graphY - offsetY) * viewport.zoom,
      zoom: viewport.zoom,
    });
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (locked || event.button !== 0) return;
    const graphPoint = pointerToGraph(event);
    if (!graphPoint) return;
    const insideViewport =
      graphPoint.x >= model.view.x &&
      graphPoint.x <= model.view.x + model.view.width &&
      graphPoint.y >= model.view.y &&
      graphPoint.y <= model.view.y + model.view.height;
    dragRef.current = insideViewport
      ? { dx: graphPoint.x - model.view.x, dy: graphPoint.y - model.view.y }
      : { dx: model.view.width / 2, dy: model.view.height / 2 };
    event.currentTarget.setPointerCapture(event.pointerId);
    moveViewport(graphPoint.x, graphPoint.y, dragRef.current.dx, dragRef.current.dy);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (locked || !dragRef.current) return;
    const graphPoint = pointerToGraph(event);
    if (!graphPoint) return;
    moveViewport(graphPoint.x, graphPoint.y, dragRef.current.dx, dragRef.current.dy);
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    if (locked) return;
    event.preventDefault();
    const nextZoom = Math.min(2, Math.max(0.12, viewport.zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
    setViewport({ x: viewport.x, y: viewport.y, zoom: nextZoom });
  };

  return (
    <div className={`ticket-minimap react-flow__panel bottom right ${locked ? 'locked' : ''}`}>
      <svg
        ref={svgRef}
        width={MINI_W}
        height={MINI_H}
        role="img"
        aria-label="Ticket graph minimap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <rect className="ticket-minimap-bg" x={0} y={0} width={MINI_W} height={MINI_H} rx={8} />
        {model.points.map((point) => (
          <circle
            key={point.id}
            className={`ticket-minimap-dot ${point.type}`}
            cx={point.x}
            cy={point.y}
            r={point.type === 'container' ? 3.5 : 2.6}
            style={{ fill: point.color }}
          />
        ))}
        <rect
          className="ticket-minimap-view"
          x={model.viewportRect.x}
          y={model.viewportRect.y}
          width={model.viewportRect.width}
          height={model.viewportRect.height}
          rx={2}
        />
      </svg>
    </div>
  );
}

function buildMiniMapModel(nodes: Node[], viewport: { x: number; y: number; zoom: number }, flowSize: { width: number; height: number }) {
  const placed = absoluteNodes(nodes);
  if (placed.length === 0 || flowSize.width <= 0 || flowSize.height <= 0) return null;

  const minX = Math.min(...placed.map((n) => n.x));
  const minY = Math.min(...placed.map((n) => n.y));
  const maxX = Math.max(...placed.map((n) => n.x + n.width));
  const maxY = Math.max(...placed.map((n) => n.y + n.height));
  const bounds = {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
  const scale = Math.min((MINI_W - MINI_PAD * 2) / bounds.width, (MINI_H - MINI_PAD * 2) / bounds.height);
  const offsetX = (MINI_W - bounds.width * scale) / 2;
  const offsetY = (MINI_H - bounds.height * scale) / 2;
  const project = (x: number, y: number) => ({
    x: offsetX + (x - bounds.x) * scale,
    y: offsetY + (y - bounds.y) * scale,
  });

  const view = {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: flowSize.width / viewport.zoom,
    height: flowSize.height / viewport.zoom,
  };
  const viewTopLeft = project(view.x, view.y);
  const viewportRect = {
    x: clamp(viewTopLeft.x, 2, MINI_W - 2),
    y: clamp(viewTopLeft.y, 2, MINI_H - 2),
    width: clamp(view.width * scale, 8, MINI_W - 4),
    height: clamp(view.height * scale, 8, MINI_H - 4),
  };

  return {
    bounds,
    offsetX,
    offsetY,
    scale,
    view,
    viewportRect,
    points: placed.map((node) => {
      const center = project(node.x + node.width / 2, node.y + node.height / 2);
      return {
        id: node.id,
        x: center.x,
        y: center.y,
        type: node.type,
        color: miniMapNodeColor(node.node),
      };
    }),
  };
}

function absoluteNodes(nodes: Node[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.map((node) => {
    let x = node.position.x;
    let y = node.position.y;
    let parent = node.parentId ? byId.get(node.parentId) : undefined;
    while (parent) {
      x += parent.position.x;
      y += parent.position.y;
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    const width = numericStyle(node.style?.width) ?? numericData((node.data as any)?.width) ?? (node.type === 'ticket' ? TICKET_NODE_WIDTH : 200);
    const height = numericStyle(node.style?.height) ?? numericData((node.data as any)?.height) ?? (node.type === 'ticket' ? GROUP.CHIP_H : GROUP.HEADER_H + GROUP.PAD);
    return { id: node.id, node, x, y, width, height, type: node.type === 'container' ? 'container' : 'ticket' };
  });
}

function numericStyle(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function numericData(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function miniMapNodeColor(node: Node): string {
  const data = node.data as any;
  if (node.type === 'container') {
    const kind = DEPTH_KIND[Math.min(data?.depth ?? 0, DEPTH_KIND.length - 1)];
    return `var(--kind-${kind})`;
  }
  const kind = data?.node?.type?.kind ?? 'other';
  return `var(--kind-${kind})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
