export type StatusCategory = 'todo' | 'inprogress' | 'done';
export type IssueKind = 'epic' | 'story' | 'task' | 'subtask' | 'bug' | 'other';
export type EdgeKind = 'hierarchy' | 'link';

export interface GraphNode {
  id: string;
  key: string;
  summary: string;
  type: { name: string; kind: IssueKind };
  status: { name: string; category: StatusCategory };
  priority?: string;
  assignee?: { displayName: string; initials: string; avatarUrl?: string };
  storyPoints?: number;
  startDate?: string;
  dueDate?: string;
  sprint?: string;
  hierarchyLevel: number;
  url: string;
  raw: unknown;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  relation: string;
  label: string;
  directed: boolean;
  raw: unknown;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Capabilities {
  apiVersion: 2 | 3;
  baseUrl: string;
  hasEpicLink: boolean;
  epicLinkFieldId?: string;
  storyPointsFieldId?: string;
  startDateFieldId?: string;
  sprintFieldId?: string;
}
