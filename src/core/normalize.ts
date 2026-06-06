import type { Capabilities, Graph, GraphEdge, GraphNode } from './model';
import { hierarchyLevelFor, initialsFrom, kindFromIssuetype, statusCategoryFrom } from './jira-fields';
import { adfToText } from './adf';

function hierarchyEdge(source: string, target: string, relation: string): GraphEdge {
  const label = relation === 'subtask' ? 'subtask of' : relation === 'epic' ? 'epic' : 'parent';
  return { id: `hier:${relation}:${source}->${target}`, source, target, kind: 'hierarchy', relation, label, directed: true, raw: null };
}

function hierarchyEdges(raw: any, childKind: string, caps: Capabilities): GraphEdge[] {
  const f = raw.fields ?? {};
  if (f.parent?.key) {
    const parentKind = kindFromIssuetype(f.parent.fields?.issuetype);
    const relation = childKind === 'subtask' ? 'subtask' : parentKind === 'epic' ? 'epic' : 'parent';
    return [hierarchyEdge(f.parent.key, raw.key, relation)];
  }
  if (caps.hasEpicLink && caps.epicLinkFieldId) {
    const epicKey = f[caps.epicLinkFieldId];
    if (typeof epicKey === 'string' && epicKey) return [hierarchyEdge(epicKey, raw.key, 'epic')];
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
      out.push({ id: `link:${relation}:${source}->${target}`, source, target, kind: 'link', relation, label, directed, raw: null });
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
    raw: null, // payload dropped after normalize — at thousands of tickets it dominates memory
    project: f.project ? { key: f.project.key, name: f.project.name ?? f.project.key }
                       : { key: String(raw.key).split('-')[0], name: String(raw.key).split('-')[0] },
    description: adfToText(f.description) || undefined,
    labels: Array.isArray(f.labels) ? f.labels.filter((l: any) => typeof l === 'string') : [],
    components: Array.isArray(f.components) ? f.components.map((c: any) => c?.name).filter(Boolean) : [],
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

  // Promote hierarchy-type ISSUE LINKS (e.g. Jira Server's WBSGantt
  // "Hierarchy link" — outward "contains") to real hierarchy edges so the
  // Overview nests them like parent/Epic Link. linkEdges() already orients
  // these parent→child for both outward and inward link records. A node only
  // ever gets ONE hierarchy parent: if it already has parent/Epic Link, the
  // plugin link stays a plain wire.
  const hierTargets = new Set(edges.filter((e) => e.kind === 'hierarchy').map((e) => e.target));
  for (const e of edges) {
    if (e.kind !== 'link' || !e.relation.includes('hierarchy')) continue;
    if (hierTargets.has(e.target) || e.source === e.target) continue;
    e.kind = 'hierarchy';
    e.relation = 'parent';
    e.label = 'contains';
    e.directed = true;
    hierTargets.add(e.target);
  }

  // Resolve each non-epic node's epic ancestor from hierarchy edges.
  const parentOf = new Map<string, string>();
  for (const e of edges) if (e.kind === 'hierarchy') parentOf.set(e.target, e.source);
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  for (const node of nodes) {
    if (node.type.kind === 'epic') continue;
    let cur: string | undefined = parentOf.get(node.key);
    let guard = 0;
    while (cur && guard++ < 20) {
      const p = byKey.get(cur);
      if (p && p.type.kind === 'epic') { node.epicKey = p.key; node.epicSummary = p.summary; break; }
      cur = parentOf.get(cur);
    }
  }

  return { nodes, edges };
}
