import { FamilyBranchLinks } from './TreeRenderComponents.jsx';
import { fullName, relationshipPath, relationshipLabel, partnerRelationship, linkLabelPoint } from './appHelpers.js';

export default function TreeConnections({
  layout, treePeople, visibleLinkTypes, highlightedLink, activeLinkNodeId,
  highlightedAncestorIds, onHighlight, byId, connectorNodePositions,
  connectorLabelPositions, treeBoardWidth, treeBoardHeight,
}) {
  return (
    <svg className="connector-svg" width={treeBoardWidth} height={treeBoardHeight} aria-label="Family relationships">
      <defs>
        <marker id="family-link-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--line)" />
        </marker>
        <marker id="partner-link-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--accent)" />
        </marker>
        <marker id="family-link-highlight-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 Z" fill="#f0a928" />
        </marker>
        <marker id="partner-link-highlight-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 Z" fill="#f0a928" />
        </marker>
        <marker id="smooth-link-dot" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="2.4" />
        </marker>
        <marker id="smooth-link-highlight-dot" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="3" fill="#f0a928" />
        </marker>
      </defs>
      {visibleLinkTypes.parent && (
        <FamilyBranchLinks
          branches={layout.familyBranches}
          people={treePeople}
          curved
          endpointDots
          highlightedLink={highlightedLink}
          highlightedNodeId={activeLinkNodeId}
          highlightedAncestorIds={highlightedAncestorIds}
          onHighlight={onHighlight}
        />
      )}
      {layout.edges
        .filter((edge) => edge.kind !== 'parent' && visibleLinkTypes[edge.kind] !== false)
        .map((edge, i) => {
          const d = relationshipPath(edge);
          const from = byId(edge.fromId),
            to = byId(edge.toId);
          const relation =
            edge.kind === 'parent'
              ? relationshipLabel('Parent', from, to)
              : edge.kind === 'sibling'
                ? 'Sibling'
                : edge.kind === 'custom'
                  ? edge.label
                  : relationshipLabel('Partner', from, to) || 'Partner';
          const reverseRelation =
            edge.kind === 'parent'
              ? relationshipLabel('Child', to, from)
              : edge.kind === 'sibling'
                ? 'Sibling'
                : edge.kind === 'custom'
                  ? edge.label
                  : relationshipLabel('Partner', to, from) || 'Partner';
          const description = `${fullName(from)} · ${relation} · ${fullName(to)}`;
          const linkId = `${edge.kind}-${edge.fromId}-${edge.toId}`;
          const nodeRelated =
            activeLinkNodeId === edge.fromId ||
            activeLinkNodeId === edge.toId ||
            ((edge.kind === 'parent' || edge.kind === 'partner') && highlightedAncestorIds.has(edge.fromId) && highlightedAncestorIds.has(edge.toId));
          const linkHighlighted = highlightedLink?.key === linkId;
          const storedPartnerRelation = edge.kind === 'partner' ? partnerRelationship(from, to?.id) || partnerRelationship(to, from?.id) : '';
          const genderedPartnerPair = (from?.gender === 'male' && to?.gender === 'female') || (from?.gender === 'female' && to?.gender === 'male');
          const usesDefaultPartnerRole = ['', 'Husband', 'Wife', 'Spouse'].includes(storedPartnerRelation);
          const visibleRelation =
            edge.kind === 'custom'
              ? edge.label
              : edge.kind === 'sibling'
                ? 'Sibling'
                : edge.kind === 'partner' && genderedPartnerPair && usesDefaultPartnerRole
                  ? 'Husband · Wife'
                  : storedPartnerRelation || `${relation} · ${reverseRelation}`;
          const relationLabelPoint = linkLabelPoint(edge, visibleRelation, connectorNodePositions, connectorLabelPositions, false);
          return (
            <g key={`${linkId}-${i}`} className={`relationship-link ${linkHighlighted ? 'is-highlighted' : ''} ${nodeRelated ? 'is-node-related' : ''}`}>
              <path
                className="connector-hit"
                d={d}
                tabIndex="0"
                aria-label={description}
                onPointerEnter={() => onHighlight({ key: linkId, ids: [edge.fromId, edge.toId] })}
                onPointerLeave={() => onHighlight(null)}
                onFocus={() => onHighlight({ key: linkId, ids: [edge.fromId, edge.toId] })}
                onBlur={() => onHighlight(null)}
              />
              <path
                className={`connector ${edge.kind}`}
                d={d}
                markerStart={`url(#${linkHighlighted || nodeRelated ? 'smooth-link-highlight-dot' : 'smooth-link-dot'})`}
                markerEnd={`url(#${linkHighlighted || nodeRelated ? 'smooth-link-highlight-dot' : 'smooth-link-dot'})`}
              />
              <text className="connector-relation" x={relationLabelPoint.x} y={relationLabelPoint.y} textAnchor="middle" dominantBaseline="central">
                <title>
                  {fullName(from)} · {visibleRelation} · {fullName(to)}
                </title>
                {visibleRelation}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
