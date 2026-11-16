import { useMemo } from 'react';
import { familyGroupBounds } from './familyGroupBounds.js';

export default function FamilyGroupBorders({ layout, width, height, selectedId, selectedNodeIds = [] }) {
  const groups = useMemo(() => familyGroupBounds(layout), [layout]);
  const selected = new Set([selectedId, ...selectedNodeIds]);
  return <svg className="family-group-borders" width={width} height={height} aria-hidden="true">
    {groups.map((group) => <rect key={group.key} className={group.primaryIds.some((id) => selected.has(id)) ? 'is-selected' : undefined} x={group.x} y={group.y} width={group.width} height={group.height} rx="18" />)}
  </svg>;
}
