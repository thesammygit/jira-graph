import type { GraphNode, IssueKind, StatusCategory } from '../core/model';

export interface VisibilityFilters {
  /** Opt-in selections: EMPTY = no filtering; non-empty = show only matches. */
  onlyTypes: Set<IssueKind>;
  hiddenStatuses: Set<StatusCategory>;
  onlyProjects: Set<string>;
  onlyAssignees: Set<string>;
  onlyLabels: Set<string>;
  onlyComponents: Set<string>;
  /** 'hide' removes Done tickets entirely; other modes only change styling. */
  doneDisplay: 'normal' | 'dim' | 'strike' | 'hide';
}

export function isNodeVisible(node: GraphNode, f: VisibilityFilters): boolean {
  if (f.onlyTypes.size > 0 && !f.onlyTypes.has(node.type.kind)) return false;
  if (f.hiddenStatuses.has(node.status.category)) return false;
  if (f.onlyProjects.size > 0 && !f.onlyProjects.has(node.project.key)) return false;
  const a = node.assignee?.displayName ?? '__unassigned__';
  if (f.onlyAssignees.size > 0 && !f.onlyAssignees.has(a)) return false;
  if (f.doneDisplay === 'hide' && node.status.category === 'done') return false;
  // Multi-valued selections: a ticket matches when ANY of its tags is
  // selected; untagged tickets can't match an active tag selection.
  const labels = node.labels ?? [];
  if (f.onlyLabels.size > 0 && !labels.some((l) => f.onlyLabels.has(l))) return false;
  const components = node.components ?? [];
  if (f.onlyComponents.size > 0 && !components.some((c) => f.onlyComponents.has(c))) return false;
  return true;
}
