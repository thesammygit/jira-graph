import type { GraphNode, IssueKind, StatusCategory } from '../core/model';

export interface VisibilityFilters {
  hiddenTypes: Set<IssueKind>;
  hiddenStatuses: Set<StatusCategory>;
  hiddenProjects: Set<string>;
  hiddenAssignees: Set<string>;
  hiddenLabels: Set<string>;
  hiddenComponents: Set<string>;
  /** 'hide' removes Done tickets entirely; other modes only change styling. */
  doneDisplay: 'normal' | 'dim' | 'strike' | 'hide';
}

export function isNodeVisible(node: GraphNode, f: VisibilityFilters): boolean {
  if (f.hiddenTypes.has(node.type.kind)) return false;
  if (f.hiddenStatuses.has(node.status.category)) return false;
  if (f.hiddenProjects.has(node.project.key)) return false;
  const a = node.assignee?.displayName ?? '__unassigned__';
  if (f.hiddenAssignees.has(a)) return false;
  if (f.doneDisplay === 'hide' && node.status.category === 'done') return false;
  // Multi-valued filters: a ticket hides only when it HAS labels/components and
  // every one of them is toggled off (untagged tickets are unaffected).
  const labels = node.labels ?? [];
  if (labels.length > 0 && labels.every((l) => f.hiddenLabels.has(l))) return false;
  const components = node.components ?? [];
  if (components.length > 0 && components.every((c) => f.hiddenComponents.has(c))) return false;
  return true;
}
