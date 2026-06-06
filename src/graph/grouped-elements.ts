import type { Edge, Node } from '@xyflow/react';
import type { Graph, GraphNode } from '../core/model';
import type { Grouping, GroupContainer } from './grouping';
import { GROUP, type GroupedLayout } from './layouts/grouped';
import type { GraphState } from '../state/graphReducer';
import { relationStyle } from './relation-colors';
import { isNodeVisible } from './visible';

/** Max member chips a box renders before tucking the rest behind a +N-more cell. */
export const MEMBER_CAP = 30;
export const MORE_PREFIX = '__more__:';

/** Synthetic member standing in for the tickets past the cap. */
function moreChip(boxKey: string, hidden: number): GraphNode {
  return {
    id: `${MORE_PREFIX}${boxKey}`, key: `${MORE_PREFIX}${boxKey}`,
    summary: `+${hidden} more`, type: { name: 'More', kind: 'other' },
    status: { name: '', category: 'todo' }, hierarchyLevel: 0,
    url: '', raw: null, project: { key: '', name: '' }, labels: [], components: [],
  } as GraphNode;
}

export function filterGroupingForState(grouping: Grouping, state: GraphState): Grouping {
  const keepContainer = (container: GroupContainer): GroupContainer | null => {
    const nodeVisible = container.node ? isNodeVisible(container.node, state) : false;
    const subContainers = container.subContainers
      .map(keepContainer)
      .filter((c): c is GroupContainer => Boolean(c));
    let members = container.members.filter((member) => isNodeVisible(member, state));
    // Pagination: huge flat boxes show the first MEMBER_CAP chips + a "+N more"
    // cell — links from tucked-away tickets re-aggregate onto the box.
    if (members.length > MEMBER_CAP && !state.expandedBoxes.has(container.key)) {
      const hidden = members.length - MEMBER_CAP;
      members = [...members.slice(0, MEMBER_CAP), moreChip(container.key, hidden)];
    }

    if (!nodeVisible && subContainers.length === 0 && members.length === 0) return null;
    return { ...container, subContainers, members };
  };

  return {
    containers: grouping.containers
      .map(keepContainer)
      .filter((c): c is GroupContainer => Boolean(c)),
  };
}

export function toGroupedElements(graph: Graph, grouping: Grouping, layout: GroupedLayout, state: GraphState): { nodes: Node[]; edges: Edge[] } {
  // Map each ticket to the container that owns it, and whether it is currently visible.
  const ownerContainer = new Map<string, string>();   // ticket key -> nearest container key
  const ancestorChain = new Map<string, string[]>();  // container key -> [self, parent, ...] container chain
  const visibleMembers = new Set<string>();
  const visibleContainers = new Set<string>();

  // Walk grouping to record ownership + ancestor chains (+ more-cell labels).
  const moreLabels = new Map<string, string>();
  const walk = (c: GroupContainer, chain: string[]) => {
    const here = [c.key, ...chain];
    ancestorChain.set(c.key, here);
    for (const m of c.members) {
      ownerContainer.set(m.key, c.key);
      if (m.key.startsWith(MORE_PREFIX)) moreLabels.set(m.key, m.summary);
    }
    for (const s of c.subContainers) walk(s, here);
  };
  grouping.containers.forEach((c) => walk(c, []));

  // A container is "hidden under collapse" if any ancestor (strictly above self) is collapsed.
  const isUnderCollapse = (containerKey: string): boolean => {
    const chain = ancestorChain.get(containerKey) ?? [containerKey];
    // chain[0] is self; an ancestor strictly above self being collapsed hides it
    return chain.slice(1).some((a) => state.collapsed.has(a));
  };

  // Build nodes.
  const nodes: Node[] = [];
  const nodeByKey = new Map(graph.nodes.map((n) => [n.key, n]));
  for (const pc of layout.containers) {
    if (isUnderCollapse(pc.key)) continue; // a sub-container inside a collapsed ancestor is not shown
    visibleContainers.add(pc.key);
    const header = pc.key === '__ungrouped__' ? { key: '__ungrouped__', summary: 'Ungrouped' } : nodeByKey.get(pc.key);
    nodes.push({
      id: pc.key, type: 'container', position: { x: pc.x, y: pc.y },
      ...(pc.parentKey ? { parentId: pc.parentKey, extent: 'parent' as const } : {}),
      data: { node: header, depth: pc.depth, collapsed: state.collapsed.has(pc.key), focal: state.focusKey === pc.key, width: pc.width, height: pc.height },
      // top-level width/height (not just style) — controlled-mode consumers
      // like the MiniMap need explicit dimensions on the user node
      width: pc.width, height: pc.height,
      style: { width: pc.width, height: pc.height },
    });
  }
  for (const pm of layout.members) {
    const ownerCollapsed = state.collapsed.has(pm.parentKey) || isUnderCollapse(pm.parentKey);
    if (ownerCollapsed) continue;
    if (pm.key.startsWith(MORE_PREFIX)) {
      // "+N more" cell — expands its box to show every member
      nodes.push({
        id: pm.key, type: 'moreChip', parentId: pm.parentKey, extent: 'parent',
        position: { x: pm.x, y: pm.y },
        data: { boxKey: pm.key.slice(MORE_PREFIX.length), label: moreLabels.get(pm.key) ?? '+ more' },
        width: GROUP.CHIP_W, height: GROUP.CHIP_H,
        style: { width: GROUP.CHIP_W, height: GROUP.CHIP_H },
      });
      continue;
    }
    const node = nodeByKey.get(pm.key); if (!node) continue;
    if (!isNodeVisible(node, state)) continue;
    visibleMembers.add(pm.key);
    nodes.push({
      id: pm.key, type: 'ticket', parentId: pm.parentKey, extent: 'parent',
      position: { x: pm.x, y: pm.y },
      data: { node, selected: state.selectedKey === pm.key, search: state.search, compact: true, focal: state.focusKey === pm.key },
      width: GROUP.CHIP_W, height: GROUP.CHIP_H,
      style: { width: GROUP.CHIP_W, height: GROUP.CHIP_H },
    });
  }

  // Ticket-hierarchy parents — lets endpoints truncated below the depth cut
  // (absent from the grouping entirely) climb to a rendered ancestor.
  const hierParent = new Map<string, string>();
  for (const e of graph.edges) if (e.kind === 'hierarchy') hierParent.set(e.target, e.source);

  // Resolve an endpoint: if the member is visible, return its key. Otherwise climb
  // the ownerContainer/ancestor chain and return the FIRST visible container hit —
  // i.e. the innermost (nearest) collapsed container that absorbs this member.
  const resolveEndpoint = (key: string): string | null => {
    if (visibleMembers.has(key)) return key;
    if (visibleContainers.has(key)) return key; // the endpoint is itself a rendered container (epic/story/task box)
    // Not directly visible: climb to the nearest visible ancestor container.
    // Members climb via ownerContainer; container keys climb via their ancestor chain.
    let container: string | undefined = ownerContainer.get(key) ?? (ancestorChain.has(key) ? ancestorChain.get(key)![1] : undefined);
    if (!container) {
      // Deliberately filtered out (type/project/label/…): the link disappears with it.
      const gn = nodeByKey.get(key);
      if (gn && !isNodeVisible(gn, state)) return null;
      // Truncated by the depth cut: walk up the ticket hierarchy instead.
      let p = hierParent.get(key);
      while (p) {
        if (visibleMembers.has(p) || visibleContainers.has(p)) return p;
        p = hierParent.get(p);
      }
      return null;
    }
    while (container) {
      if (visibleContainers.has(container)) return container; // innermost visible ancestor
      const chain: string[] = ancestorChain.get(container) ?? [];
      container = chain[1]; // parent container
    }
    return null;
  };

  // The top-level container a visible endpoint lives in (itself when top-level).
  const topMost = (key: string): string => {
    const chain = ancestorChain.get(key); // container keys have a chain [self, …, top]
    if (chain) return chain[chain.length - 1];
    const owner = ownerContainer.get(key); // members climb via their owner
    const oc = owner ? ancestorChain.get(owner) : undefined;
    return oc ? oc[oc.length - 1] : key;
  };

  // Build edges: only link edges (hierarchy is implied by containment).
  // Readability rule: links BETWEEN top-level boxes are aggregated to ONE wall-to-wall
  // wire per (boxA, boxB, relation) — the gutters stay clean and Spotlight/EdgePopup
  // carry the ticket-level detail. Links WITHIN a box stay ticket-to-ticket.
  // The linkLevel filter hides low-level noise: a wire renders only when BOTH linked
  // tickets are at-or-above the chosen hierarchy level (e.g. 'story' hides task↔task).
  const KIND_RANK: Record<string, number> = { epic: 3, story: 2, task: 1, bug: 1, other: 1, subtask: 0 };
  const LEVEL_THRESHOLD: Record<GraphState['linkLevel'], number> = { epic: 3, story: 2, task: 1, all: 0 };
  const levelThr = LEVEL_THRESHOLD[state.linkLevel];
  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const ge of graph.edges) {
    if (ge.kind !== 'link') continue;
    const relKey = ge.relation;
    if (state.hiddenRelations.has(relKey)) continue;
    if (levelThr > 0) {
      const sKind = nodeByKey.get(ge.source)?.type.kind ?? 'other';
      const tKind = nodeByKey.get(ge.target)?.type.kind ?? 'other';
      if ((KIND_RANK[sKind] ?? 1) < levelThr || (KIND_RANK[tKind] ?? 1) < levelThr) continue;
    }
    const s = resolveEndpoint(ge.source), t = resolveEndpoint(ge.target);
    if (!s || !t || s === t) continue;
    const sTop = topMost(s), tTop = topMost(t);
    const sameBox = sTop === tTop;
    const S = sameBox ? s : sTop;
    const T = sameBox ? t : tTop;
    if (S === T) continue;
    const id = `${S}->${T}:${relKey}`;
    if (seen.has(id)) continue; seen.add(id);
    const colorVar = relationStyle(ge.relation).colorVar;
    edges.push({
      id, source: S, target: T, type: 'routed', // no inline label — the legend + edge popup carry the meaning
      data: { rel: relKey, label: ge.label ?? '', srcKey: ge.source, tgtKey: ge.target },
      style: { stroke: colorVar, strokeWidth: 2.2, opacity: 0.94, strokeDasharray: ge.directed ? undefined : '6 5' },
      markerEnd: ge.directed ? ({ type: 'arrowclosed', color: colorVar, width: 16, height: 16 } as Edge['markerEnd']) : undefined,
      zIndex: 2,
    });
  }
  // React Flow requires every parent node to appear before its children in the array
  // (for arbitrary nesting depth). Order by nesting depth: containers by their own
  // depth, members by their parent container's depth + 1. Array.sort is stable.
  const containerDepth = new Map(layout.containers.map((c) => [c.key, c.depth]));
  const orderKey = (n: Node): number =>
    n.type === 'container' ? (containerDepth.get(n.id) ?? 0) : (containerDepth.get(n.parentId ?? '') ?? 0) + 1;
  nodes.sort((a, b) => orderKey(a) - orderKey(b));

  return { nodes, edges };
}
