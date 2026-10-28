import { curveBumpY, curveLinear, line as d3Line } from 'd3-shape';

const straightRelationshipLine = d3Line().curve(curveLinear);
const verticalRelationshipLine = d3Line().curve(curveBumpY);
const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Unnamed person';
const initials = (person) => `${person?.firstName?.[0] || ''}${person?.lastName?.[0] || ''}`.toUpperCase() || '?';

export function PersonAvatar({ person, size = 'small' }) {
  return <div className={`person-avatar ${size} ${person?.color || 'sage'}`}>{person?.photoUrl ? <img src={person.photoUrl} alt="" /> : <span>{initials(person)}</span>}</div>;
}
export function FamilyBranchLinks({ branches, people, orthogonal = false, curved = false, endpointDots = false, highlightedLink, highlightedNodeId, highlightedAncestorIds, onHighlight }) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const highlightAtPointer = (event, link) => {
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) {
      onHighlight(link);
      return;
    }
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const localPoint = point.matrixTransform(matrix.inverse());
    onHighlight({ ...link, point: { x: localPoint.x, y: localPoint.y } });
  };
  return (
    <g className="family-branch-links">
      {branches.map((branch, index) => {
        const bus = straightRelationshipLine([
          [branch.sourceX, branch.sourceY],
          [branch.sourceX, branch.branchY],
        ]);
        const busMinX = Math.min(branch.sourceX, ...branch.childXs);
        const busMaxX = Math.max(branch.sourceX, ...branch.childXs);
        const busRail = straightRelationshipLine([
          [busMinX, branch.branchY],
          [busMaxX, branch.branchY],
        ]);
        const branchKey = `family-${index}`;
        const branchHighlighted = highlightedLink?.key?.startsWith(`${branchKey}-`);
        const branchNodeRelated = branch.children.some(
          (childId) =>
            branch.parentIds.includes(highlightedNodeId) ||
            childId === highlightedNodeId ||
            (highlightedAncestorIds.has(childId) && branch.parentIds.some((parentId) => highlightedAncestorIds.has(parentId))),
        );
        const curvedGuides = ['above', 'below']
          .map((side) => {
            const indices = branch.childTops
              .map((childTop, childIndex) => ({ childIndex, below: childTop >= branch.sourceY }))
              .filter(({ below }) => below === (side === 'below'))
              .map(({ childIndex }) => childIndex);
            if (!indices.length) return null;
            const direction = side === 'below' ? 1 : -1;
            // A two-parent family branches from the connector joining the parents.
            // A single-parent family starts at that parent's nearest card edge.
            const sourceY = branch.parentIds.length > 1 ? branch.sourceY : side === 'below' ? branch.sourceBottomY : branch.sourceTopY;
            const railY = sourceY + direction * 22;
            const railWidth = Math.min(96, Math.max(26, (indices.length - 1) * 20));
            const railStartX = branch.sourceX - railWidth / 2;
            const sourceXs = new Map(indices.map((childIndex, rank) => [childIndex, indices.length === 1 ? branch.sourceX : railStartX + (railWidth * rank) / (indices.length - 1)]));
            return { side, indices, sourceY, railY, railStartX, railWidth, sourceXs };
          })
          .filter(Boolean);
        return (
          <g key={`family-branch-${index}`}>
            {!curved && (
              <>
                <path
                  className={`connector family-route family-trunk ${branchHighlighted ? 'is-highlighted' : ''} ${branchNodeRelated ? 'is-node-related' : ''}`}
                  d={bus}
                  markerStart={endpointDots ? `url(#${branchHighlighted || branchNodeRelated ? 'smooth-link-highlight-dot' : 'smooth-link-dot'})` : undefined}
                />
                <path className={`connector family-route family-rail ${branchHighlighted ? 'is-highlighted' : ''} ${branchNodeRelated ? 'is-node-related' : ''}`} d={busRail} />
              </>
            )}
            {curvedGuides.map((guide) => (
              <g key={guide.side}>
                <path
                  className={`connector family-route family-trunk ${branchHighlighted ? 'is-highlighted' : ''} ${branchNodeRelated ? 'is-node-related' : ''}`}
                  d={straightRelationshipLine([
                    [branch.sourceX, guide.sourceY],
                    [branch.sourceX, guide.railY],
                  ])}
                />
                {guide.indices.length > 1 && (
                  <path
                    className={`connector family-route family-rail ${branchHighlighted ? 'is-highlighted' : ''} ${branchNodeRelated ? 'is-node-related' : ''}`}
                    d={straightRelationshipLine([
                      [guide.railStartX, guide.railY],
                      [guide.railStartX + guide.railWidth, guide.railY],
                    ])}
                  />
                )}
                <circle className="family-junction" cx={branch.sourceX} cy={guide.railY} r="3.2" />
              </g>
            ))}
            {branch.childXs.map((x, i) => {
              const child = byId.get(branch.children[i]);
              const label = child?.gender === 'male' ? 'Son' : child?.gender === 'female' ? 'Daughter' : 'Child';
              const childTop = branch.childTops[i];
              const childBottom = branch.childBottoms[i];
              const childIsBelow = childTop >= branch.sourceY;
              const guide = curvedGuides.find((item) => item.indices.includes(i));
              const routeSourceX = curved ? guide.sourceXs.get(i) : x;
              const routeSourceY = curved ? guide.railY : branch.branchY;
              const routeTargetY = childIsBelow ? childTop : childBottom;
              const d3Route = curved
                ? verticalRelationshipLine([
                    [routeSourceX, routeSourceY],
                    [x, routeTargetY],
                  ])
                : null;
              const curve = d3Route
                ? d3Route
                : orthogonal
                  ? straightRelationshipLine([
                      [x, branch.branchY],
                      [x, childTop],
                    ])
                  : verticalRelationshipLine([
                      [x, branch.branchY],
                      [x, childTop],
                    ]);
              const labelX = d3Route ? (x + routeSourceX) / 2 : x;
              const labelY = (d3Route ? (routeSourceY + routeTargetY) / 2 : (childTop + branch.branchY) / 2) + (childIsBelow ? -7 : 7);
              const linkKey = `${branchKey}-${branch.children[i]}`;
              const linkHighlighted = highlightedLink?.key === linkKey;
              const nodeRelated =
                branch.parentIds.includes(highlightedNodeId) ||
                branch.children[i] === highlightedNodeId ||
                (highlightedAncestorIds.has(branch.children[i]) && branch.parentIds.some((parentId) => highlightedAncestorIds.has(parentId)));
              const markerId = linkHighlighted || nodeRelated ? 'family-link-highlight-arrow' : 'family-link-arrow';
              const linkedIds = [...branch.parentIds, branch.children[i]];
              const parentNames = branch.parentIds.map((id) => fullName(byId.get(id))).join(' and ');
              const childName = fullName(child);
              const childNameWidth = Math.max(54, Math.min(150, childName.length * 6.4 + 18));
              const hoverPoint = linkHighlighted && highlightedLink?.point ? highlightedLink.point : { x: labelX, y: labelY - 22 };
              return (
                <g key={branch.children[i]} className={`relationship-link ${linkHighlighted ? 'is-highlighted' : ''} ${nodeRelated ? 'is-node-related' : ''}`}>
                  <path
                    className="connector-hit"
                    d={curve}
                    tabIndex="0"
                    aria-label={`${parentNames} to ${fullName(child)} · ${label}`}
                    onPointerEnter={(event) => highlightAtPointer(event, { key: linkKey, ids: linkedIds })}
                    onPointerMove={(event) => highlightAtPointer(event, { key: linkKey, ids: linkedIds })}
                    onPointerLeave={() => onHighlight(null)}
                    onFocus={() => onHighlight({ key: linkKey, ids: linkedIds })}
                    onBlur={() => onHighlight(null)}
                  />
                  <path
                    className="connector family-route family-drop"
                    d={curve}
                    markerStart={endpointDots ? `url(#${linkHighlighted || nodeRelated ? 'smooth-link-highlight-dot' : 'smooth-link-dot'})` : undefined}
                    markerEnd={endpointDots ? `url(#${linkHighlighted || nodeRelated ? 'smooth-link-highlight-dot' : 'smooth-link-dot'})` : !orthogonal ? `url(#${markerId})` : undefined}
                  />
                  <text className="connector-relation family-role" x={labelX} y={labelY} textAnchor="middle" dominantBaseline="central">
                    <title>{label}</title>
                    {label}
                  </text>
                  <g className="connector-child-name" transform={`translate(${hoverPoint.x} ${hoverPoint.y - 16})`} aria-hidden="true">
                    <rect x={-childNameWidth / 2} y="-10" width={childNameWidth} height="20" rx="6" />
                    <text textAnchor="middle" dominantBaseline="central">
                      {childName}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

