import type { Capabilities, Graph, GraphEdge, GraphNode } from './model';
import { hierarchyLevelFor, initialsFrom, kindFromIssuetype, statusCategoryFrom } from './jira-fields';

function hierarchyEdge(source: string, target: string, relation: string, raw: unknown): GraphEdge {
  const label = relation === 'subtask' ? 'subtask of' : relation === 'epic' ? 'epic' : 'parent';
  return { id: `hier:${relation}:${source}->${target}`, source, target, kind: 'hierarchy', relation, label, directed: true, raw };
}

function hierarchyEdges(raw: any, childKind: string, caps: Capabilities): GraphEdge[] {
  const f = raw.fields ?? {};
  if (f.parent?.key) {
    const parentKind = kindFromIssuetype(f.parent.fields?.issuetype);
    const relation = childKind === 'subtask' ? 'subtask' : parentKind === 'epic' ? 'epic' : 'parent';
    return [hierarchyEdge(f.parent.key, raw.key, relation, f.parent)];
  }
  if (caps.hasEpicLink && caps.epicLinkFieldId) {
    const epicKey = f[caps.epicLinkFieldId];
    if (typeof epicKey === 'string' && epicKey) return [hierarchyEdge(epicKey, raw.key, 'epic', { epicLink: epicKey })];
  }
  return [];
}

const UNDIRECTED = new Set(['relates', 'relate', 'relates to']);

function linkEdges(raw: any): GraphEdge[] {
  const out: GraphEdge[] = [];
  for (const l of raw.fields?.issuelinks ?? []) {
    const relation = (l.type?.name ?? 'relates').toLowerCase();
    const directed = !UNDIRECTED.has(relation);
    const label = l.type?.outward ?? relation;
    let source: string | undefined, target: string | undefined;
    if (l.outwardIssue) { source = raw.key; target = l.outwardIssue.key; }
    else if (l.inwardIssue) { source = l.inwardIssue.key; target = raw.key; }
    if (source && target) {
      out.push({ id: `link:${relation}:${source}->${target}`, source, target, kind: 'link', relation, label, directed, raw: l });
    }
  }
  return out;
}

export function normalizeIssue(raw: any, caps: Capabilities): { node: GraphNode; edges: GraphEdge[] } {
  const f = raw.fields ?? {};
  const kind = kindFromIssuetype(f.issuetype);
  const node: GraphNode = {
    id: raw.key,
    key: raw.key,
    summary: f.summary ?? '',
    type: { name: f.issuetype?.name ?? 'Unknown', kind },
    status: { name: f.status?.name ?? 'Unknown', category: statusCategoryFrom(f.status?.statusCategory?.key) },
    priority: f.priority?.name,
    assignee: f.assignee
      ? { displayName: f.assignee.displayName, initials: initialsFrom(f.assignee.displayName ?? ''), avatarUrl: f.assignee.avatarUrls?.['24x24'] }
      : undefined,
    storyPoints: caps.storyPointsFieldId ? f[caps.storyPointsFieldId] : undefined,
    startDate: caps.startDateFieldId ? f[caps.startDateFieldId] : undefined,
    dueDate: f.duedate ?? undefined,
    sprint: caps.sprintFieldId && Array.isArray(f[caps.sprintFieldId]) && f[caps.sprintFieldId].length
      ? f[caps.sprintFieldId][f[caps.sprintFieldId].length - 1]?.name
      : undefined,
    hierarchyLevel: hierarchyLevelFor(kind),
    url: `${caps.baseUrl}/browse/${raw.key}`,
    raw,
  };
  const edges: GraphEdge[] = [];
  edges.push(...hierarchyEdges(raw, kind, caps), ...linkEdges(raw));
  return { node, edges };
}

export function normalizeIssues(rawIssues: any[], caps: Capabilities): Graph {
  const nodes: GraphNode[] = [];
  const edgeMap = new Map<string, GraphEdge>();
  for (const raw of rawIssues) {
    const { node, edges } = normalizeIssue(raw, caps);
    nodes.push(node);
    for (const e of edges) edgeMap.set(e.id, e);
  }
  const keys = new Set(nodes.map((n) => n.key));
  const edges = [...edgeMap.values()].filter((e) => keys.has(e.source) && keys.has(e.target));
  return { nodes, edges };
}
