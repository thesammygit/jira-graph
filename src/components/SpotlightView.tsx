import type { Dispatch } from 'react';
import type { Graph, GraphNode } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { spotlightModel } from '../graph/spotlight';
import { relationStyle } from '../graph/relation-colors';
import { revealAction } from '../graph/reveal';
import './spotlight.css';

/* ── Mini-card: a compact related-ticket button ─────────────────────── */
function MiniCard({ node, accent, onOpen, onReveal }: { node: GraphNode; accent: string; onOpen: (k: string) => void; onReveal: (k: string) => void }) {
  const kindVar = `var(--kind-${node.type.kind})`;
  const statusVar = `var(--status-${node.status.category})`;
  return (
    <button
      className={`sp-card ${node.status.category === 'done' ? 'is-done' : ''}`}
      style={{ borderLeftColor: accent }}
      onClick={() => onOpen(node.key)}
      title={`${node.key}: ${node.summary}`}
    >
      <div className="sp-card-top">
        <span className="sp-card-k" style={{ color: kindVar }}>{node.key}</span>
        <span
          className="sp-card-reveal" role="button" tabIndex={-1} title="Show in Overview"
          onClick={(e) => { e.stopPropagation(); onReveal(node.key); }}
        >▦</span>
        <span className="sp-card-dot" style={{ background: statusVar }} title={node.status.name} />
      </div>
      <span className="sp-card-s">{node.summary}</span>
    </button>
  );
}

/* ── Lane: a labeled column of related mini-cards ───────────────────── */
function Lane({ label, accent, nodes, onOpen, onReveal }: {
  label: string;
  accent: string;
  nodes: GraphNode[];
  onOpen: (k: string) => void;
  onReveal: (k: string) => void;
}) {
  if (!nodes.length) return null;
  return (
    <div className="sp-lane">
      <div className="sp-lane-label" style={{ color: accent }}>{label}</div>
      {nodes.map((node) => (
        <MiniCard key={node.key} node={node} accent={accent} onOpen={onOpen} onReveal={onReveal} />
      ))}
    </div>
  );
}

/* ── Main SpotlightView ─────────────────────────────────────────────── */
export function SpotlightView({
  graph,
  state,
  dispatch,
}: {
  graph: Graph;
  state: GraphState;
  dispatch: Dispatch<Action>;
}) {
  const model = state.focusKey ? spotlightModel(graph, state.focusKey) : null;
  const open = (k: string) => dispatch({ type: 'openSpotlight', key: k });
  const reveal = (k: string) => {
    const action = revealAction(graph, k);
    if (action) dispatch(action);
  };

  /* No focus yet */
  if (!model) {
    return <div className="sp-empty">Click a ticket in Overview to spotlight it.</div>;
  }

  const h = model.hero;
  const kindVar = `var(--kind-${h.type.kind})`;
  const statusVar = `var(--status-${h.status.category})`;

  /* Breadcrumb trail: all history keys + current */
  const trail = [...state.focusHistory, h.key];

  /* Relationship colors */
  const blocksColor = relationStyle('blocks').colorVar;
  const relatesColor = relationStyle('relates').colorVar;
  const epicColor = 'var(--kind-epic)';
  const subtaskColor = 'var(--kind-subtask)';
  const otherColor = 'var(--rel-default)';

  /* Derive lane visibility for connector rendering */
  const hasTop = !!(model.epic || model.parent);
  const hasLeft = model.blockedBy.length > 0;
  const hasRight = model.blocks.length > 0;
  const hasBottom = model.children.length > 0;
  const hasExtra = model.relates.length > 0 || model.other.length > 0;
  const hasRelations = hasTop || hasLeft || hasRight || hasBottom || hasExtra;

  const epicParentNodes = [model.epic, model.parent].filter((n): n is GraphNode => !!n);

  return (
    <div className="spotlight">
      {/* ── Breadcrumb bar ────────────────────────────────────────── */}
      <div className="sp-crumbs">
        <button
          className="sp-crumb-btn"
          onClick={() => dispatch({ type: 'spotlightBack' })}
          title="Go back"
        >
          ← Back
        </button>
        <span className="sp-crumb-sep">|</span>
        <button
          className="sp-crumb-btn"
          onClick={() => dispatch({ type: 'setViewMode', viewMode: 'overview' })}
          title="Return to Overview board"
        >
          Overview
        </button>
        {trail.length > 0 && <span className="sp-crumb-sep">/</span>}
        <span className="sp-trail">
          {trail.map((k, i) => (
            <button
              key={k + i}
              className={`sp-trail-crumb${k === h.key ? ' on' : ''}`}
              onClick={() => open(k)}
              title={k}
            >
              {k}
            </button>
          ))}
        </span>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────── */}
      <div className="sp-body">
        <div className="sp-grid">

          {/* ── Top lane: Epic / Parent ─────────────────────────── */}
          <div className="sp-top">
            <Lane
              label="▲ Epic / Parent"
              accent={epicColor}
              nodes={epicParentNodes}
              onOpen={open}
              onReveal={reveal}
            />
            {hasTop && <div className="sp-top-connector" />}
          </div>

          {/* ── Left lane: Blocked by ───────────────────────────── */}
          <div className="sp-left">
            <Lane
              label="◄ Blocked by"
              accent={blocksColor}
              nodes={model.blockedBy}
              onOpen={open}
              onReveal={reveal}
            />
            {hasLeft && <div className="sp-left-connector" />}
          </div>

          {/* ── Hero card ────────────────────────────────────────── */}
          <div className="sp-hero">
            <div
              className={`sp-hero-card ${h.status.category === 'done' ? 'is-done' : ''}`}
              style={{ borderTopColor: kindVar }}
            >
              {/* Key + Epic badge */}
              <div className="sp-hero-head">
                <span className="sp-hero-k" style={{ color: kindVar }}>{h.key}</span>
                {h.epicKey && h.type.kind !== 'epic' && (
                  <span className="sp-epic-badge">▣ {h.epicKey}</span>
                )}
              </div>

              {/* Summary */}
              <h2 className="sp-hero-title">{h.summary}</h2>

              {/* Meta row: status pill, type·priority, points, assignee */}
              <div className="sp-hero-meta">
                <span
                  className="sp-pill"
                  style={{
                    background: `color-mix(in srgb, ${statusVar} 15%, transparent)`,
                    color: statusVar,
                  }}
                >
                  {h.status.name}
                </span>
                <span className="sp-meta-type">
                  {h.type.name}{h.priority ? ` · ${h.priority}` : ''}
                </span>
                {h.storyPoints != null && (
                  <span className="sp-pts">{h.storyPoints} pts</span>
                )}
                {h.assignee && (
                  <span className="sp-av" title={h.assignee.displayName}>
                    {h.assignee.initials}
                  </span>
                )}
              </div>

              {/* Description */}
              {h.description && (
                <p className="sp-hero-desc">{h.description}</p>
              )}

              {/* Footer: show in Overview + open in Jira */}
              <div className="sp-hero-foot">
                <button className="sp-open sp-reveal" onClick={() => reveal(h.key)}
                  title="Jump to Overview, zoomed on this ticket (adjusts Show level/filters if needed)">
                  ▦ Show in Overview
                </button>
                {/* scheme-guarded: only ever link plain http(s), never e.g.
                    javascript: URLs from a hostile dataset */}
                {/^https?:\/\//.test(h.url) && (
                  <a
                    className="sp-open"
                    href={h.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Open in Jira ↗
                  </a>
                )}
              </div>
            </div>

            {/* Empty state note when no relations */}
            {!hasRelations && (
              <p className="sp-no-relations">No linked tickets.</p>
            )}
          </div>

          {/* ── Right lane: Blocks ───────────────────────────────── */}
          <div className="sp-right">
            {hasRight && <div className="sp-right-connector" />}
            <Lane
              label="Blocks ►"
              accent={blocksColor}
              nodes={model.blocks}
              onOpen={open}
              onReveal={reveal}
            />
          </div>

          {/* ── Bottom lane: Subtasks / Children ─────────────────── */}
          <div className="sp-bottom">
            {hasBottom && <div className="sp-bottom-connector" />}
            <Lane
              label="▼ Subtasks"
              accent={subtaskColor}
              nodes={model.children}
              onOpen={open}
              onReveal={reveal}
            />
          </div>

          {/* ── Extra row: Relates + Other ───────────────────────── */}
          {hasExtra && (
            <div className="sp-extra">
              <Lane
                label="↔ Relates"
                accent={relatesColor}
                nodes={model.relates}
                onOpen={open}
              onReveal={reveal}
              />
              {model.other.length > 0 && (
                <Lane
                  label="Other"
                  accent={otherColor}
                  nodes={model.other.map((o) => o.node)}
                  onOpen={open}
              onReveal={reveal}
                />
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
