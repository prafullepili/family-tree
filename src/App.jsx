import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  GitFork,
  UsersRound,
  Sun,
  Moon,
  X,
  MapPin,
  CalendarDays,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Lock,
  Unlock,
  Heart,
  Camera,
  RefreshCw,
  Info,
  Palette,
} from 'lucide-react';
import { initialPeople } from './demoFamily.js';
import { layoutTree, resolveNodeOverlaps } from './layoutTree.js';

const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Unnamed person';
function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Storage can be unavailable or full. */
  }
}
function storageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* Storage can be unavailable. */
  }
}
const initials = (p) => `${p?.firstName?.[0] || ''}${p?.lastName?.[0] || ''}`.toUpperCase() || '?';
const year = (date) => (date ? new Date(date).getUTCFullYear() : '—');
function formatLongDate(value) {
  if (!value) return 'Not added';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not added' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
function relationshipLabel(role, relative, person) {
  if (role === 'Parent') return relative?.gender === 'male' ? 'Father' : relative?.gender === 'female' ? 'Mother' : 'Parent';
  if (role === 'Child') return relative?.gender === 'male' ? 'Son' : relative?.gender === 'female' ? 'Daughter' : 'Child';
  if (role === 'Partner') {
    if (person?.gender === 'male' && relative?.gender === 'female') return 'Wife';
    if (person?.gender === 'female' && relative?.gender === 'male') return 'Husband';
  }
  return role;
}
function partnerRelationship(person, partnerId) {
  return (person?.partnerRelationships || []).find((link) => String(link.partnerId) === String(partnerId))?.label || '';
}
function partnerDisplayLabel(person, relative) {
  const stored = partnerRelationship(person, relative?.id);
  return ['', 'Husband', 'Wife', 'Spouse'].includes(stored) ? relationshipLabel('Partner', relative, person) || stored || 'Partner' : stored;
}
function descendantIds(people, personId) {
  const childrenByParent = new Map();
  people.forEach((person) =>
    (person.parentIds || []).forEach((parentId) => {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(person.id);
    }),
  );
  const found = new Set();
  const queue = [personId];
  while (queue.length) {
    const parentId = queue.shift();
    (childrenByParent.get(parentId) || []).forEach((childId) => {
      if (childId !== personId && !found.has(childId)) {
        found.add(childId);
        queue.push(childId);
      }
    });
  }
  return [...found];
}
function familyColorMap(people, focalId) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const colors = new Map();
  if (!byId.has(focalId)) return colors;
  colors.set(focalId, 'focal');

  const visitedAncestors = new Set([focalId]);
  function addAncestors(personId, branch, depth, path) {
    const person = byId.get(personId);
    (person?.parentIds || [])
      .filter((id) => byId.has(id))
      .forEach((parentId, index) => {
        if (path.has(parentId)) return;
        const parent = byId.get(parentId);
        const side = depth === 0 ? (parent.gender === 'male' ? 'paternal' : parent.gender === 'female' ? 'maternal' : index === 0 ? 'paternal' : 'maternal') : branch;
        const ancestorGender = parent.gender === 'female' || parent.gender === 'male' ? parent.gender : 'unknown';
        const color = depth === 0 ? (side === 'paternal' ? 'father' : 'mother') : `${side}-${ancestorGender}`;
        if (!colors.has(parentId)) colors.set(parentId, color);
        if (visitedAncestors.has(parentId)) return;
        visitedAncestors.add(parentId);
        addAncestors(parentId, side, depth + 1, new Set([...path, parentId]));
      });
  }
  addAncestors(focalId, '', 0, new Set([focalId]));

  const childrenByParent = new Map();
  people.forEach((person) =>
    (person.parentIds || []).forEach((parentId) => {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(person);
    }),
  );
  const visitedDescendants = new Set([focalId]);
  function addDescendants(personId) {
    (childrenByParent.get(personId) || []).forEach((child) => {
      if (visitedDescendants.has(child.id)) return;
      const gender = child.gender === 'female' || child.gender === 'male' ? child.gender : 'unknown';
      if (!colors.has(child.id)) colors.set(child.id, `descendant-${gender}`);
      visitedDescendants.add(child.id);
      addDescendants(child.id);
    });
  }
  addDescendants(focalId);
  return colors;
}
function linkLabelPoint(edge, label, positions, placedLabels, straight = false) {
  const halfWidth = Math.max(22, label.length * 3.1);
  const curveXs = [edge.x1, edge.x2, edge.c1x, edge.c2x].filter(Number.isFinite);
  const curveYs = [edge.y1, edge.y2, edge.c1y, edge.c2y].filter(Number.isFinite);
  const nearbyPositions = positions.filter(
    (position) =>
      position.x + position.w >= Math.min(...curveXs) - halfWidth - 6 &&
      position.x <= Math.max(...curveXs) + halfWidth + 6 &&
      position.y + position.h >= Math.min(...curveYs) - 100 &&
      position.y <= Math.max(...curveYs) + 100,
  );
  const candidates = [];
  for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
    const u = 1 - t;
    const x = straight ? edge.x1 + (edge.x2 - edge.x1) * t : u ** 3 * edge.x1 + 3 * u ** 2 * t * edge.c1x + 3 * u * t ** 2 * edge.c2x + t ** 3 * edge.x2;
    const curveY = straight ? edge.y1 + (edge.y2 - edge.y1) * t : u ** 3 * edge.y1 + 3 * u ** 2 * t * edge.c1y + 3 * u * t ** 2 * edge.c2y + t ** 3 * edge.y2;
    for (const offsetY of [0, -24, 24, -42, 42, -60, 60, -78, 78]) {
      const point = { x, y: curveY - 9 + offsetY };
      let collisions = 0;
      nearbyPositions.forEach((position) => {
        const nodeRight = position.x + position.w;
        const nodeBottom = position.y + position.h;
        if (point.x + halfWidth > position.x - 6 && point.x - halfWidth < nodeRight + 6 && point.y + 8 > position.y - 6 && point.y - 8 < nodeBottom + 6) collisions += 1;
      });
      placedLabels.forEach((placed) => {
        if (Math.abs(point.x - placed.x) < halfWidth + placed.halfWidth + 6 && Math.abs(point.y - placed.y) < 18) collisions += 1;
      });
      candidates.push({ ...point, halfWidth, score: collisions * 1000 + Math.abs(t - 0.5) * 10 + Math.abs(offsetY) * 0.1 });
    }
  }
  const best = candidates.sort((a, b) => a.score - b.score)[0] || { x: edge.labelX, y: edge.labelY, halfWidth };
  placedLabels.push({ x: best.x, y: best.y, halfWidth });
  return { x: best.x, y: best.y };
}
function applyDragPositions(people, drag) {
  if (!drag.familyPositions) return people.map((person) => (person.id === drag.id ? { ...person, treeX: drag.lastX, treeY: drag.lastY } : person));
  const dx = drag.lastX - drag.x,
    dy = drag.lastY - drag.y;
  const starts = new Map(drag.familyPositions.map((position) => [position.id, position]));
  return people.map((person) => {
    const start = starts.get(person.id);
    return start ? { ...person, treeX: start.x + dx, treeY: start.y + dy } : person;
  });
}
function getFamilyGroups(people) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const links = new Map(people.map((person) => [person.id, new Set()]));
  people.forEach((person) =>
    [...(person.parentIds || []), ...(person.partnerIds || []), ...(person.siblingIds || []), ...(person.relationshipLinks || []).map((link) => link.personId)].forEach((id) => {
      if (byId.has(id)) {
        links.get(person.id).add(id);
        links.get(id).add(person.id);
      }
    }),
  );
  const seen = new Set();
  const groups = [];
  people.forEach((person) => {
    if (seen.has(person.id)) return;
    const ids = [];
    const queue = [person.id];
    seen.add(person.id);
    while (queue.length) {
      const id = queue.shift();
      ids.push(id);
      (links.get(id) || []).forEach((next) => {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      });
    }
    const members = ids.map((id) => byId.get(id));
    const surnames = new Map();
    members.forEach((member) => {
      const name = member.lastName?.trim();
      if (name) surnames.set(name, (surnames.get(name) || 0) + 1);
    });
    const surname = [...surnames].sort((a, b) => b[1] - a[1])[0]?.[0] || members[0]?.firstName || 'Family';
    groups.push({ id: members[0]?.id, name: `${surname} family`, people: members });
  });
  return groups.sort((a, b) => a.name.localeCompare(b.name));
}
function fromApi(p) {
  return {
    ...p,
    id: String(p._id),
    parentIds: (p.parentIds || []).map((x) => String(x._id || x)),
    partnerIds: (p.partnerIds || []).map((x) => String(x._id || x)),
    siblingIds: (p.siblingIds || []).map((x) => String(x._id || x)),
    relationshipLinks: (p.relationshipLinks || []).map((link) => ({
      personId: String(link.personId?._id || link.personId),
      label: link.label || '',
    })),
    partnerRelationships: (p.partnerRelationships || []).map((link) => ({
      partnerId: String(link.partnerId?._id || link.partnerId),
      label: link.label || '',
    })),
    treeX: p.treeX,
    treeY: p.treeY,
    color: ['sage', 'rose', 'blue', 'peach', 'lavender', 'yellow', 'mint', 'pink'][(p.firstName?.charCodeAt(0) || 0) % 8],
  };
}
const mongoPeopleCacheKey = 'kinfolk-mongo-people-v1';
function readMongoPeopleCache() {
  try {
    const cached = JSON.parse(storageGet(mongoPeopleCacheKey));
    if (!Array.isArray(cached?.people)) return { people: [], hasSnapshot: false };
    return {
      people: cached.people.map((person) => fromApi({ ...person, _id: person._id || person.id })),
      hasSnapshot: true,
    };
  } catch {
    return { people: [], hasSnapshot: false };
  }
}
function PersonAvatar({ person, size = 'small' }) {
  return <div className={`person-avatar ${size} ${person?.color || 'sage'}`}>{person?.photoUrl ? <img src={person.photoUrl} alt="" /> : <span>{initials(person)}</span>}</div>;
}
function FamilyBranchLinks({ branches, people }) {
  const byId = new Map(people.map((person) => [person.id, person]));
  return (
    <g className="family-branch-links">
      {branches.map((branch, index) => {
        const bus = `M${branch.sourceX} ${branch.sourceY} V${branch.branchY}`;
        return (
          <g key={`family-branch-${index}`}>
            <path className="connector family-route" d={bus} />
            {branch.childXs.map((x, i) => {
              const child = byId.get(branch.children[i]);
              const label = child?.gender === 'male' ? 'Son' : child?.gender === 'female' ? 'Daughter' : 'Child';
              const childTop = branch.childTops[i];
              const curvesLeft = x < branch.sourceX;
              const curve = curvesLeft
                ? `M${x} ${childTop} C${x} ${childTop - 42} ${branch.sourceX} ${branch.branchY + 24} ${branch.sourceX} ${branch.branchY}`
                : `M${branch.sourceX} ${branch.branchY} C${branch.sourceX} ${branch.branchY + 24} ${x} ${childTop - 42} ${x} ${childTop}`;
              const labelX = (x + branch.sourceX) / 2;
              const labelY = (childTop + branch.branchY) / 2 - 7;
              return (
                <g key={branch.children[i]}>
                  <path
                    className="connector family-route family-drop"
                    d={curve}
                    markerStart={curvesLeft ? 'url(#family-link-arrow)' : undefined}
                    markerEnd={!curvesLeft ? 'url(#family-link-arrow)' : undefined}
                  />
                  <text className="connector-relation family-role" x={labelX} y={labelY} textAnchor="middle" dominantBaseline="central">
                    <title>{label}</title>
                    {label}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

export default function App() {
  const [isCompactViewport, setIsCompactViewport] = useState(() => window.innerWidth <= 1050);
  const [initialCache] = useState(readMongoPeopleCache);
  const [people, setPeople] = useState(() => initialCache.people);
  const [hasMongoSnapshot, setHasMongoSnapshot] = useState(initialCache.hasSnapshot);
  const memberList = useRef(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [familyPickerOpen, setFamilyPickerOpen] = useState(false);
  const [familyQuery, setFamilyQuery] = useState('');
  const [linkStyle, setLinkStyle] = useState(() => (['direct', 'classic'].includes(storageGet('kinfolk-link-style')) ? storageGet('kinfolk-link-style') : 'classic'));
  const [familyColorsEnabled, setFamilyColorsEnabled] = useState(() => storageGet('kinfolk-family-colors-v1') === 'true');
  const [selectedId, setSelectedId] = useState(() => initialCache.people[0]?.id || '');
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [aboutTooltipId, setAboutTooltipId] = useState('');
  const [dismissedAboutTooltipId, setDismissedAboutTooltipId] = useState('');
  const [movementLocked, setMovementLocked] = useState(() => storageGet('kinfolk-canvas-movement-locked-v2') === 'true');
  const [marqueeRect, setMarqueeRect] = useState(null);
  const [phoneLayoutPreview, setPhoneLayoutPreview] = useState({});
  const [theme, setTheme] = useState(() => storageGet('kinfolk-theme') || 'light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const canvasHelpRef = useRef(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [detailsWidth, setDetailsWidth] = useState(() => {
    const saved = Number(storageGet('kinfolk-details-width'));
    return Number.isFinite(saved) && saved >= 286 && saved <= 620 ? saved : 390;
  });
  const detailsResize = useRef(null);
  const [zoom, setZoom] = useState(() => {
    const saved = Number(storageGet(window.innerWidth <= 1050 ? 'kinfolk-phone-zoom-v1' : 'kinfolk-site-zoom-v1'));
    return Number.isFinite(saved) && saved >= 0.1 && saved <= 2 ? saved : 1;
  });
  const [treeViewportWidth, setTreeViewportWidth] = useState(0);
  const [treeViewportHeight, setTreeViewportHeight] = useState(0);
  const autoFitSignature = useRef('');
  const manualZoomTouched = useRef(false);
  const viewportMode = useRef(isCompactViewport);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [apiState, setApiState] = useState('checking');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteDescendants, setDeleteDescendants] = useState(() => storageGet('kinfolk-delete-descendants') === 'true');
  const drag = useRef(null);
  const spacePan = useRef(false);
  const pinch = useRef(null);
  const zoomFrame = useRef(0);
  const pendingZoom = useRef(null);
  const zoomValue = useRef(1);
  const pendingZoomAnchor = useRef(null);
  const treeScroll = useRef(null);
  const previousOrigin = useRef(null);
  const refreshDataRef = useRef(null);
  const families = useMemo(() => getFamilyGroups(people), [people]);
  const selectedFamily = selectedFamilyId === '__all__' ? null : families.find((group) => group.id === selectedFamilyId) || [...families].sort((a, b) => b.people.length - a.people.length)[0];
  const familyPeople = selectedFamilyId === '__all__' ? people : selectedFamily?.people || people;
  const familyColorFocusId = familyPeople.some((person) => person.id === selectedId) ? selectedId : familyPeople[0]?.id;
  const familyColors = useMemo(() => familyColorMap(familyPeople, familyColorFocusId), [familyPeople, familyColorFocusId]);
  const selected = people.find((p) => p.id === selectedId) || null;
  const byId = (id) => people.find((p) => p.id === id);
  const layoutPeople = useMemo(() => {
    if (!isCompactViewport || !Object.keys(phoneLayoutPreview).length) return familyPeople;
    return familyPeople.map((person) => {
      const preview = phoneLayoutPreview[person.id];
      return preview ? { ...person, treeX: preview.treeX, treeY: preview.treeY } : person;
    });
  }, [familyPeople, isCompactViewport, phoneLayoutPreview]);
  const layout = useMemo(() => layoutTree(layoutPeople), [layoutPeople]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const layoutPositions = [...layout.positions.values()];
  const minNodeX = layoutPositions.length ? Math.min(...layoutPositions.map((position) => position.x)) : 0;
  const minNodeY = layoutPositions.length ? Math.min(...layoutPositions.map((position) => position.y)) : 0;
  const maxNodeX = layoutPositions.length ? Math.max(...layoutPositions.map((position) => position.x + position.w)) : layout.width;
  const maxNodeY = layoutPositions.length ? Math.max(...layoutPositions.map((position) => position.y + position.h)) : layout.height;
  const treeBaseWidth = Math.max(800, ...layoutPositions.map((position) => position.automaticX + layout.originX + position.w + 60));
  const treeBaseHeight = Math.max(300, ...layoutPositions.map((position) => position.automaticY + layout.originY + position.h + 100));
  // Manual dragging can put nodes above/left of the automatic layout's origin.
  // Add canvas space for those coordinates so zooming never clips a moved node.
  const treeBoardOffsetX = Math.max(0, 60 - minNodeX);
  const treeBoardOffsetY = Math.max(0, 56 - minNodeY);
  const treePaddingX = treeViewportWidth / 2;
  const treePaddingY = treeViewportHeight / 2;
  const maxCanvasZoom = Math.max(0.1, Math.min(2, (treeViewportWidth - 24) / 196));
  const treeBoardWidth = Math.max(layout.width, maxNodeX) + treeBoardOffsetX;
  const treeBoardHeight = Math.max(layout.height, maxNodeY) + treeBoardOffsetY;
  const treeContentWidth = treeBoardWidth * zoom;
  // Keep the automatic layout's origin fixed as manually moved nodes expand
  // the canvas. Scroll padding cancels the changing origin so dragging keeps
  // tracking the pointer at every edge.
  const treeBoardLeft = treePaddingX + treeBoardOffsetX * zoom + Math.max(0, (treeViewportWidth - treeBaseWidth * zoom) / 2);
  const treeBoardTop = treePaddingY + treeBoardOffsetY * zoom + Math.max(0, (treeViewportHeight - treeBaseHeight * zoom) / 2);
  const treeExtraWidth = Math.max(0, (layout.originX - 60 + treeBoardOffsetX) * zoom, treePaddingX * 2 + treeBoardLeft + treeContentWidth - treeViewportWidth);
  const appliedTreeOffset = useRef({ x: treeBoardOffsetX, y: treeBoardOffsetY });
  const connectorNodePositions = [...layout.positions.values()];
  const connectorLabelPositions = [];
  const filtered = useMemo(() => {
    const matches = familyPeople.filter((p) => fullName(p).toLowerCase().includes(query.toLowerCase()));
    return matches;
  }, [query, familyPeople]);
  const selectedDescendants = selected ? descendantIds(people, selected.id) : [];
  const deleteShortcutState = useRef(null);
  deleteShortcutState.current = { selectedId, selectedNodeIds, confirmDelete, modal, familyPeople };
  useEffect(() => {
    document.getElementById('boot-screen')?.remove();
    document.documentElement.dataset.theme = theme;
    storageSet('kinfolk-theme', theme);
  }, [theme]);
  useEffect(() => {
    storageSet('kinfolk-canvas-movement-locked-v2', String(movementLocked));
  }, [movementLocked]);
  useEffect(() => {
    const updateViewportMode = () => setIsCompactViewport(window.innerWidth <= 1050);
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, []);
  useEffect(() => {
    if (viewportMode.current === isCompactViewport) return;
    viewportMode.current = isCompactViewport;
    manualZoomTouched.current = false;
    const saved = Number(storageGet(isCompactViewport ? 'kinfolk-phone-zoom-v1' : 'kinfolk-site-zoom-v1'));
    const nextZoom = Number.isFinite(saved) && saved >= 0.1 && saved <= 2 ? saved : 1;
    zoomValue.current = nextZoom;
    setZoom(nextZoom);
  }, [isCompactViewport]);
  useEffect(() => {
    storageSet('kinfolk-details-width', String(detailsWidth));
  }, [detailsWidth]);
  useEffect(() => {
    storageRemove('kinfolk-phone-tree-layout-v1');
  }, []);
  useEffect(() => {
    storageSet(isCompactViewport ? 'kinfolk-phone-zoom-v1' : 'kinfolk-site-zoom-v1', String(zoom));
  }, [isCompactViewport, zoom]);
  function beginDetailsResize(event) {
    if (window.innerWidth <= 1050) return;
    event.preventDefault();
    detailsResize.current = { startX: event.clientX, startWidth: detailsWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDetailsResize(event) {
    if (!detailsResize.current) return;
    setDetailsWidth(Math.max(286, Math.min(620, detailsResize.current.startWidth + detailsResize.current.startX - event.clientX)));
  }
  function endDetailsResize() {
    detailsResize.current = null;
  }
  function handleDetailsResizeKey(event) {
    const delta = event.key === 'ArrowLeft' ? 16 : event.key === 'ArrowRight' ? -16 : 0;
    if (delta) {
      event.preventDefault();
      setDetailsWidth((width) => Math.max(286, Math.min(620, width + delta)));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setDetailsWidth(event.key === 'Home' ? 286 : 620);
    }
  }
  useEffect(() => {
    storageSet('kinfolk-link-style', linkStyle);
  }, [linkStyle]);
  useEffect(() => {
    storageSet('kinfolk-family-colors-v1', String(familyColorsEnabled));
  }, [familyColorsEnabled]);
  useLayoutEffect(() => {
    zoomValue.current = zoom;
    const anchor = pendingZoomAnchor.current;
    if (!anchor) return;
    const viewport = treeScroll.current;
    pendingZoomAnchor.current = null;
    if (!viewport) return;
    // Measure the transformed board after React applies the new scale. Using
    // the board rect keeps the zoom anchor correct when the surface is centered
    // or scroll bounds change (especially with a single node).
    requestAnimationFrame(() => {
      const board = viewport.querySelector('.tree-board');
      if (!board) return;
      const boardRect = board.getBoundingClientRect();
      const pointX = boardRect.left + anchor.x * zoom;
      const pointY = boardRect.top + anchor.y * zoom;
      viewport.scrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + pointX - anchor.clientX));
      viewport.scrollTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + pointY - anchor.clientY));
    });
  }, [zoom, treeBoardLeft, treeBoardTop]);
  useLayoutEffect(() => {
    const viewport = treeScroll.current;
    if (!viewport) return;
    const nextOffset = treePaddingX + treeBoardOffsetX * zoom;
    const delta = nextOffset - appliedTreeOffset.current.x;
    appliedTreeOffset.current.x = nextOffset;
    if (delta) viewport.scrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + delta));
  }, [treeBoardOffsetX, treePaddingX, zoom]);
  useLayoutEffect(() => {
    const viewport = treeScroll.current;
    if (!viewport) return;
    const nextOffset = treePaddingY + treeBoardOffsetY * zoom;
    const delta = nextOffset - appliedTreeOffset.current.y;
    appliedTreeOffset.current.y = nextOffset;
    if (delta) viewport.scrollTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + delta));
  }, [treeBoardOffsetY, treePaddingY, zoom]);
  useLayoutEffect(() => {
    const viewport = treeScroll.current;
    if (!viewport) return;
    const updateSize = () => {
      setTreeViewportWidth(viewport.clientWidth);
      setTreeViewportHeight(viewport.clientHeight);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const viewport = treeScroll.current;
    if (!viewport) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      const baseZoom = pendingZoom.current?.nextZoom ?? zoomValue.current;
      zoomAround(e.clientX, e.clientY, Math.max(0.1, Math.min(maxCanvasZoom, baseZoom * Math.exp(-e.deltaY * 0.01))));
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [zoomAround]);
  useEffect(() => {
    if (!sidebarOpen || !selectedId) return;
    memberList.current?.querySelector('.member-list-item.active')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId, sidebarOpen]);
  useEffect(() => {
    if (!aboutTooltipId) return;
    const closeOnOutsidePointer = (event) => {
      if (!event.target?.closest?.('.tree-node-about-wrap.is-open')) {
        setDismissedAboutTooltipId(aboutTooltipId);
        setAboutTooltipId('');
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setDismissedAboutTooltipId(aboutTooltipId);
        setAboutTooltipId('');
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [aboutTooltipId]);
  useEffect(() => {
    setSelectedNodeIds([]);
  }, [selectedFamilyId]);
  useEffect(() => {
    storageSet('kinfolk-delete-descendants', String(deleteDescendants));
  }, [deleteDescendants]);
  useEffect(() => {
    setPeople((previous) => {
      const removed = new Set(previous.filter((person) => String(person.id).startsWith('stress-')).map((person) => person.id));
      if (!removed.size) return previous;
      return previous
        .filter((person) => !removed.has(person.id))
        .map((person) => ({
          ...person,
          parentIds: (person.parentIds || []).filter((id) => !removed.has(id)),
          partnerIds: (person.partnerIds || []).filter((id) => !removed.has(id)),
        }));
    });
  }, []);
  useLayoutEffect(() => {
    const previous = previousOrigin.current;
    if (treeScroll.current) {
      if (previous?.hasPeople && familyPeople.length) {
        treeScroll.current.scrollLeft += (layout.originX - previous.x) * zoom;
        treeScroll.current.scrollTop += (layout.originY - previous.y) * zoom;
      } else {
        treeScroll.current.scrollLeft = 0;
        treeScroll.current.scrollTop = 0;
      }
    }
    previousOrigin.current = { x: layout.originX, y: layout.originY, hasPeople: familyPeople.length > 0 };
  }, [layout.originX, layout.originY, zoom, familyPeople.length]);
  const layoutSignature = layoutPeople
    .map((person) => `${person.id}:${person.treeX ?? ''}:${person.treeY ?? ''}:${(person.parentIds || []).join(',')}:${(person.partnerIds || []).join(',')}`)
    .join('|');
  useLayoutEffect(() => {
    if (!familyPeople.length || apiState === 'checking' || manualZoomTouched.current) return;
    const viewport = treeScroll.current;
    if (!viewport || !treeViewportWidth || !treeViewportHeight) return;
    const signature = `${isCompactViewport ? 'compact' : 'wide'}:${layoutSignature}:${treeViewportWidth}x${treeViewportHeight}`;
    if (autoFitSignature.current === signature) return;
    autoFitSignature.current = signature;
    const contentWidth = Math.max(196, maxNodeX - minNodeX);
    const contentHeight = Math.max(76, maxNodeY - minNodeY);
    const fittedZoom = Math.max(0.1, Math.min(1, maxCanvasZoom, (viewport.clientWidth - 48) / contentWidth, (viewport.clientHeight - 48) / contentHeight));
    zoomValue.current = fittedZoom;
    setZoom(fittedZoom);
    requestAnimationFrame(() => {
      const boardRect = viewport.querySelector('.tree-board')?.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      if (!boardRect || !layoutPositions.length) return;
      const centerX = (minNodeX + maxNodeX) / 2;
      const centerY = (minNodeY + maxNodeY) / 2;
      const targetX = viewportRect.left + viewport.clientWidth / 2;
      const targetY = viewportRect.top + viewport.clientHeight / 2;
      viewport.scrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + boardRect.left + centerX * fittedZoom - targetX));
      viewport.scrollTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + boardRect.top + centerY * fittedZoom - targetY));
    });
  }, [apiState, familyPeople.length, isCompactViewport, layoutSignature, maxCanvasZoom, maxNodeX, maxNodeY, minNodeX, minNodeY, treeViewportHeight, treeViewportWidth]);
  useEffect(() => {
    if (apiState !== 'demo') return;
    const timer = setTimeout(() => storageSet('kinfolk-demo-people', JSON.stringify(people)), 250);
    return () => clearTimeout(timer);
  }, [people, apiState]);
  useEffect(() => {
    if (apiState !== 'connected' || !hasMongoSnapshot) return;
    try {
      storageSet(mongoPeopleCacheKey, JSON.stringify({ people, updatedAt: Date.now() }));
    } catch {
      // The live MongoDB data remains available even if browser storage is full or disabled.
    }
  }, [people, apiState, hasMongoSnapshot]);
  useEffect(() => {
    let active = true;
    (async () => {
      setIsRefreshing(true);
      try {
        let ready = false;
        for (let i = 0; i < 8; i++) {
          const h = await fetch('/api/health');
          if (!h.ok) throw Error();
          const state = await h.json();
          if (!state.configured) {
            if (active) {
              setPeople(initialPeople());
              setHasMongoSnapshot(false);
              setApiState('demo');
            }
            return;
          }
          if (state.database === 'connected') {
            ready = true;
            break;
          }
          if (i < 7) await new Promise((r) => setTimeout(r, 1000));
        }
        if (!ready) throw Error();
        const response = await fetch('/api/people');
        if (!response.ok) throw Error();
        const savedRows = await response.json();
        const rows = savedRows.map(fromApi);
        if (active) {
          storageRemove('kinfolk-demo-people');
          setHasMongoSnapshot(true);
          setPeople(rows);
          setSelectedId((selectedId) => (rows.some((person) => person.id === selectedId) ? selectedId : rows[0]?.id || ''));
          setApiState('connected');
          setRefreshFailed(false);
        }
      } catch {
        if (active) {
          setRefreshFailed(true);
          setApiState(initialCache.hasSnapshot ? 'connected' : 'error');
        }
      } finally {
        if (active) setIsRefreshing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  async function refreshFromDatabase() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshFailed(false);
    try {
      let ready = false;
      for (let i = 0; i < 8; i++) {
        const healthResponse = await fetch('/api/health', { cache: 'no-store' });
        if (!healthResponse.ok) throw Error();
        const health = await healthResponse.json();
        if (!health.configured) {
          setRefreshFailed(hasMongoSnapshot);
          if (!hasMongoSnapshot) setApiState('error');
          notify('MongoDB is not configured for this app');
          return;
        }
        if (health.database === 'connected') {
          ready = true;
          break;
        }
        if (i < 7) await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (!ready) throw Error();
      const response = await fetch('/api/people', { cache: 'no-store' });
      if (!response.ok) throw Error();
      const rows = (await response.json()).map(fromApi);
      storageRemove('kinfolk-demo-people');
      storageSet(mongoPeopleCacheKey, JSON.stringify({ people: rows, updatedAt: Date.now() }));
      setPeople(rows);
      setHasMongoSnapshot(true);
      setSelectedId((selectedId) => (rows.some((person) => person.id === selectedId) ? selectedId : rows[0]?.id || ''));
      setApiState('connected');
      setRefreshFailed(false);
      notify(`Synced ${rows.length} ${rows.length === 1 ? 'person' : 'people'} from MongoDB`);
    } catch {
      setRefreshFailed(true);
      if (!hasMongoSnapshot) setApiState('error');
      notify(hasMongoSnapshot ? 'Could not refresh from MongoDB. Showing the last saved data.' : 'Could not load family data from MongoDB.');
    } finally {
      setIsRefreshing(false);
    }
  }
  refreshDataRef.current = refreshFromDatabase;
  useEffect(() => {
    const handleRefreshShortcut = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'r') return;
      event.preventDefault();
      event.stopPropagation();
      refreshDataRef.current?.();
    };
    window.addEventListener('keydown', handleRefreshShortcut, true);
    return () => window.removeEventListener('keydown', handleRefreshShortcut, true);
  }, []);
  function notify(text) {
    setToast(text);
    setTimeout(() => setToast(''), 2600);
  }
  async function refreshPeople() {
    const r = await fetch('/api/people');
    if (!r.ok) throw Error('Could not reload your family tree');
    return (await r.json()).map(fromApi);
  }
  async function saveMember(values) {
    const prior = modal.person;
    const { childIds = [], ...memberValues } = values;
    const payload = {
      ...memberValues,
      parentIds: (values.parentIds || []).filter((id) => people.some((p) => p.id === id && p._id)),
      partnerIds: (values.partnerIds || []).filter((id) => people.some((p) => p.id === id && p._id)),
      siblingIds: (values.siblingIds || []).filter((id) => people.some((p) => p.id === id && p._id)),
      partnerRelationships: (values.partnerRelationships || []).filter((link) => (values.partnerIds || []).includes(link.partnerId) && people.some((p) => p.id === link.partnerId && p._id)),
      relationshipLinks: (values.relationshipLinks || []).filter((link) => link.label.trim() && people.some((p) => p.id === link.personId && p._id)),
    };
    if (apiState === 'connected') {
      try {
        const r = await fetch(prior ? `/api/people/${prior._id}` : '/api/people', {
          method: prior ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (!r.ok) throw Error(data.error || 'Could not save this person');
        const saved = fromApi(data);
        const nextChildIds = new Set(childIds.filter((id) => people.some((person) => person.id === id && person._id)));
        const currentChildren = prior ? people.filter((person) => (person.parentIds || []).includes(prior.id)) : [];
        const childUpdates = [...new Map([...currentChildren, ...people.filter((person) => nextChildIds.has(person.id))].map((person) => [person.id, person])).values()]
          .filter((child) => child._id && currentChildren.some((person) => person.id === child.id) !== nextChildIds.has(child.id))
          .map(async (child) => {
            const parentIds = nextChildIds.has(child.id) ? [...new Set([...(child.parentIds || []), saved.id])] : (child.parentIds || []).filter((id) => id !== saved.id);
            const response = await fetch(`/api/people/${child._id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ parentIds }),
            });
            if (!response.ok) throw Error('Person saved, but a child link could not be updated');
          });
        await Promise.all(childUpdates);
        const rows = await refreshPeople();
        setPeople(rows);
        setSelectedId(saved.id);
        setModal(null);
        setDetailsOpen(false);
        setMobileDetailsOpen(false);
        notify(prior ? 'Person updated' : 'Person added to the tree');
      } catch (e) {
        notify(e.message);
      }
      return;
    }
    const id = prior?.id || `local-${Date.now()}`;
    const newPerson = {
      ...prior,
      ...values,
      id,
      _id: null,
      color: prior?.color || ['sage', 'rose', 'blue', 'peach', 'lavender', 'yellow', 'mint', 'pink'][people.length % 8],
    };
    let rows = prior ? people.map((p) => (p.id === id ? newPerson : p)) : [...people, newPerson];
    const currentChildren = new Set(prior ? people.filter((person) => (person.parentIds || []).includes(prior.id)).map((person) => person.id) : []);
    const nextChildren = new Set(childIds);
    const currentPartners = new Set(prior?.partnerIds || []);
    const nextPartners = new Set(values.partnerIds || []);
    const currentSiblings = new Set(prior?.siblingIds || []);
    const nextSiblings = new Set(values.siblingIds || []);
    const nextCustom = new Map((values.relationshipLinks || []).map((link) => [link.personId, link.label.trim()]));
    rows = rows.map((p) => {
      if (p.id === id) return p;
      let updated = p;
      if (currentChildren.has(p.id) || nextChildren.has(p.id)) {
        updated = {
          ...updated,
          parentIds: nextChildren.has(p.id) ? [...new Set([...(updated.parentIds || []), id])] : (updated.parentIds || []).filter((parentId) => parentId !== id),
        };
      }
      const next = nextPartners.has(p.id);
      const relationship = (values.partnerRelationships || []).find((link) => link.partnerId === p.id)?.label;
      const partnerRelationships = (updated.partnerRelationships || []).filter((link) => link.partnerId !== id);
      updated = {
        ...updated,
        partnerIds: next ? [...new Set([...(updated.partnerIds || []), id])] : currentPartners.has(p.id) ? (updated.partnerIds || []).filter((x) => x !== id) : updated.partnerIds || [],
        partnerRelationships: next ? (relationship ? [...partnerRelationships, { partnerId: id, label: relationship }] : partnerRelationships) : partnerRelationships,
        siblingIds: nextSiblings.has(p.id)
          ? [...new Set([...(updated.siblingIds || []), id])]
          : currentSiblings.has(p.id)
            ? (updated.siblingIds || []).filter((x) => x !== id)
            : updated.siblingIds || [],
        relationshipLinks: (updated.relationshipLinks || []).filter((link) => link.personId !== id),
      };
      if (nextCustom.has(p.id)) updated.relationshipLinks = [...updated.relationshipLinks, { personId: id, label: nextCustom.get(p.id) }];
      return updated;
    });
    setPeople(rows);
    setSelectedId(id);
    setModal(null);
    setDetailsOpen(false);
    setMobileDetailsOpen(false);
    notify(prior ? 'Person updated for this browser' : 'Person added for this browser');
  }
  async function removePerson() {
    if (!selected) return;
    const isBulkSelection = selectedNodeIds.length > 1;
    try {
      const removalIds = new Set(isBulkSelection ? selectedNodeIds : [selected.id, ...(deleteDescendants ? selectedDescendants : [])]);
      const removedPeople = people.filter((person) => removalIds.has(person.id));
      const rows = people
        .filter((person) => !removalIds.has(person.id))
        .map((person) => {
          const position = layout.positions.get(person.id);
          return {
            ...person,
            parentIds: (person.parentIds || []).filter((id) => !removalIds.has(id)),
            partnerIds: (person.partnerIds || []).filter((id) => !removalIds.has(id)),
            siblingIds: (person.siblingIds || []).filter((id) => !removalIds.has(id)),
            partnerRelationships: (person.partnerRelationships || []).filter((link) => !removalIds.has(link.partnerId)),
            relationshipLinks: (person.relationshipLinks || []).filter((link) => !removalIds.has(link.personId)),
            treeX: position?.rawX ?? person.treeX,
            treeY: position?.rawY ?? person.treeY,
          };
        });
      if (apiState === 'connected') {
        const positions = rows.filter((person) => person._id).map((person) => ({ id: person._id, treeX: person.treeX, treeY: person.treeY }));
        const saved = await fetch('/api/people/layout/positions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions }),
        });
        if (!saved.ok) throw Error('Could not preserve the current tree layout');
        const ids = removedPeople.filter((person) => person._id).map((person) => person._id);
        if (ids.length) {
          const response = await fetch('/api/people/batch', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
          });
          if (!response.ok) throw Error('Could not delete the selected people');
        }
      }
      setPeople(rows);
      setSelectedId(rows[0]?.id || '');
      setSelectedNodeIds([]);
      setConfirmDelete(false);
      notify(`Removed ${removedPeople.length} ${removedPeople.length === 1 ? 'person' : 'people'}; others stayed in place`);
    } catch (error) {
      notify(error.message);
    }
  }
  useEffect(() => {
    if (!confirmDelete || !selected) return;
    const onKeyDown = (event) => {
      if (event.repeat) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        removePerson();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setConfirmDelete(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDelete, selectedId, selectedNodeIds, deleteDescendants, people, apiState, layout]);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) spacePan.current = true;
      const state = deleteShortcutState.current;
      if (!state || state.confirmDelete || state.modal || event.repeat || event.altKey) return;
      const target = event.target;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.closest?.('[contenteditable="true"]')) return;
      const key = String(event.key || '').toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'a') {
        if (!state.familyPeople.length) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const ids = state.familyPeople.map((person) => person.id);
        setSelectedNodeIds(ids);
        setSelectedId(ids[0] || '');
        setDetailsOpen(false);
        setMobileDetailsOpen(false);
        return;
      }
      const code = String(event.code || '').toLowerCase();
      if (!['delete', 'del', 'backspace'].includes(key) && !['delete', 'numpaddecimal'].includes(code) && event.keyCode !== 46) return;
      if (event.ctrlKey || event.metaKey || !state.selectedId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setConfirmDelete(true);
    };
    const onKeyUp = (event) => {
      if (event.code === 'Space') spacePan.current = false;
    };
    const onBlur = () => {
      spacePan.current = false;
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
  useEffect(() => {
    const onEscape = (event) => {
      if (event.key !== 'Escape' || confirmDelete) return;
      if (modal) {
        event.preventDefault();
        setModal(null);
        if (!selected) {
          setDetailsOpen(false);
          setMobileDetailsOpen(false);
        }
        return;
      }
      if (helpOpen) {
        event.preventDefault();
        setHelpOpen(false);
        return;
      }
      if (sidebarOpen) {
        event.preventDefault();
        setSidebarOpen(false);
        return;
      }
      if (mobileDetailsOpen || detailsOpen) {
        event.preventDefault();
        setMobileDetailsOpen(false);
        setDetailsOpen(false);
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [confirmDelete, detailsOpen, helpOpen, modal, mobileDetailsOpen, selected, sidebarOpen]);
  useEffect(() => {
    const closeHelpOutside = (event) => {
      if (!canvasHelpRef.current?.contains(event.target)) setHelpOpen(false);
    };
    document.addEventListener('pointerdown', closeHelpOutside);
    return () => document.removeEventListener('pointerdown', closeHelpOutside);
  }, []);
  function focusPersonInTree(id) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const viewport = treeScroll.current;
        if (!viewport) return;
        const node = [...viewport.querySelectorAll('.tree-person')].find((item) => item.dataset.personId === id);
        if (!node) return;
        const nodeRect = node.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        viewport.scrollTo({
          left: viewport.scrollLeft + nodeRect.left + nodeRect.width / 2 - viewportRect.left - viewport.clientWidth / 2,
          top: viewport.scrollTop + nodeRect.top + nodeRect.height / 2 - viewportRect.top - viewport.clientHeight / 2,
          behavior: 'smooth',
        });
      }),
    );
  }
  function zoomAround(clientX, clientY, nextZoom) {
    manualZoomTouched.current = true;
    pendingZoom.current = { clientX, clientY, nextZoom };
    if (zoomFrame.current) return;
    zoomFrame.current = requestAnimationFrame(() => {
      zoomFrame.current = 0;
      const request = pendingZoom.current;
      pendingZoom.current = null;
      if (!request || Math.abs(request.nextZoom - zoomValue.current) < 0.0001) return;
      const viewport = treeScroll.current;
      const board = viewport?.querySelector('.tree-board');
      if (viewport && board) {
        const boardRect = board.getBoundingClientRect();
        pendingZoomAnchor.current = {
          x: (request.clientX - boardRect.left) / zoomValue.current,
          y: (request.clientY - boardRect.top) / zoomValue.current,
          clientX: request.clientX,
          clientY: request.clientY,
        };
      }
      setZoom(request.nextZoom);
    });
  }
  function zoomTo(nextZoom) {
    nextZoom = Math.max(0.1, Math.min(maxCanvasZoom, nextZoom));
    const viewport = treeScroll.current;
    if (!viewport) {
      setZoom(nextZoom);
      return;
    }
    const board = viewport.querySelector('.tree-board');
    const boardRect = board?.getBoundingClientRect();
    if (boardRect && layout.positions.size) {
      const positions = [...layout.positions.values()];
      const minX = Math.min(...positions.map((position) => position.x));
      const maxX = Math.max(...positions.map((position) => position.x + position.w));
      const minY = Math.min(...positions.map((position) => position.y));
      const maxY = Math.max(...positions.map((position) => position.y + position.h));
      zoomAround(boardRect.left + ((minX + maxX) / 2) * zoomValue.current, boardRect.top + ((minY + maxY) / 2) * zoomValue.current, nextZoom);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    zoomAround(rect.left + rect.width / 2, rect.top + rect.height / 2, nextZoom);
  }
  function fitTreeToView() {
    manualZoomTouched.current = true;
    const viewport = treeScroll.current;
    if (!viewport) return;
    const availableWidth = Math.max(1, viewport.clientWidth - 48);
    const availableHeight = Math.max(1, viewport.clientHeight - 48);
    const contentWidth = Math.max(1, maxNodeX - minNodeX);
    const contentHeight = Math.max(1, maxNodeY - minNodeY);
    const fittedZoom = Math.max(0.1, Math.min(1, maxCanvasZoom, availableWidth / contentWidth, availableHeight / contentHeight));
    zoomValue.current = fittedZoom;
    setZoom(fittedZoom);
    requestAnimationFrame(() => {
      const board = viewport.querySelector('.tree-board');
      const boardRect = board?.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      if (!boardRect || !layoutPositions.length) return;
      const centerX = (minNodeX + maxNodeX) / 2;
      const centerY = (minNodeY + maxNodeY) / 2;
      const targetX = viewportRect.left + viewport.clientWidth / 2;
      const targetY = viewportRect.top + viewport.clientHeight / 2;
      viewport.scrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + boardRect.left + centerX * fittedZoom - targetX));
      viewport.scrollTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + boardRect.top + centerY * fittedZoom - targetY));
    });
  }
  function handleTouchStart(e) {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    drag.current = null;
    const [a, b] = e.touches;
    pinch.current = {
      distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      zoom: zoomValue.current,
    };
  }
  function handleTouchMove(e) {
    if (e.touches.length !== 2 || !pinch.current) return;
    e.preventDefault();
    const [a, b] = e.touches;
    const centerX = (a.clientX + b.clientX) / 2;
    const centerY = (a.clientY + b.clientY) / 2;
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    zoomAround(centerX, centerY, Math.max(0.1, Math.min(maxCanvasZoom, (pinch.current.zoom * distance) / pinch.current.distance)));
  }
  function handleTouchEnd(e) {
    if (e.touches.length < 2) pinch.current = null;
  }
  function selectPerson(personId) {
    setSelectedId(personId);
    setSelectedNodeIds([]);
  }
  function openAddPersonForm() {
    setModal({ inline: true });
    setDetailsOpen(true);
    if (window.innerWidth <= 1050) {
      setSidebarOpen(false);
      setMobileDetailsOpen(true);
    }
  }
  function openPersonDetails(personId) {
    selectPerson(personId);
    setDetailsOpen(true);
    if (window.innerWidth <= 1050) {
      setSidebarOpen(false);
      setMobileDetailsOpen(true);
    }
  }
  function openPersonEditor(person) {
    openPersonDetails(person.id);
    setModal({ person, inline: true });
  }
  function openLinkEditor() {
    if (selected) setModal({ person: selected, inline: true, focusLinks: true });
  }
  function clearSelection() {
    setSelectedId('');
    setSelectedNodeIds([]);
    setDetailsOpen(false);
    setMobileDetailsOpen(false);
  }
  function startDrag(e, p, pos) {
    if (e.button !== 0) return;
    if (e.target.closest('.tree-node-info,.tree-node-edit,.tree-node-delete,.tree-node-about,.tree-node-about-tooltip')) return;
    e.preventDefault();
    e.stopPropagation();
    if (movementLocked) {
      const gesture = { mode: 'select-only', id: p.id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, held: false };
      drag.current = gesture;
      gesture.holdTimer = window.setTimeout(() => {
        if (drag.current === gesture && !gesture.moved) gesture.held = true;
      }, 520);
      return;
    }
    const movingGroup = selectedNodeIds.length > 1 && selectedNodeIds.includes(p.id);
    const viewport = treeScroll.current;
    if (e.pointerId != null && e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    const gesture = {
      mode: 'person',
      id: p.id,
      personId: p._id,
      compactViewport: isCompactViewport,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: pos.rawX,
      y: pos.rawY,
      zoom,
      scrollLeft: viewport?.scrollLeft || 0,
      scrollTop: viewport?.scrollTop || 0,
      moved: false,
      held: false,
      frame: 0,
      holdTimer: 0,
      groupSelection: movingGroup,
      familyPositions: movingGroup
        ? familyPeople
            .filter((person) => selectedNodeIds.includes(person.id))
            .map((person) => {
              const position = layout.positions.get(person.id);
              return position ? { id: person.id, personId: person._id, x: position.rawX, y: position.rawY } : null;
            })
            .filter(Boolean)
        : null,
    };
    drag.current = gesture;
    gesture.holdTimer = window.setTimeout(() => {
      if (drag.current === gesture && !gesture.moved) gesture.held = true;
    }, 520);
  }
  function startPan(e) {
    if ((e.button !== 0 && e.button !== 1) || e.target.closest('.tree-person,.connector-hit,button,input,textarea,select,[role="button"]')) return;
    const viewport = treeScroll.current;
    if (!viewport) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const touchGesture = e.pointerType === 'touch';
    const shouldPan = e.button === 1 || spacePan.current;
    const bounds = viewport.getBoundingClientRect();
    drag.current = {
      mode: touchGesture ? 'touch-pending' : shouldPan ? 'pan' : 'marquee',
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      moved: false,
      additive: e.shiftKey,
      additiveIds: e.shiftKey ? [...new Set([...selectedNodeIds, ...(selectedId ? [selectedId] : [])])] : [],
      startLocalX: e.clientX - bounds.left + viewport.scrollLeft,
      startLocalY: e.clientY - bounds.top + viewport.scrollTop,
    };
    if (touchGesture) {
      const gesture = drag.current;
      gesture.holdTimer = window.setTimeout(() => {
        if (drag.current === gesture && !gesture.moved) gesture.readyForMarquee = true;
      }, 450);
    }
    setMarqueeRect(null);
  }
  useEffect(() => {
    function onMove(e) {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.startX,
        dy = e.clientY - d.startY;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
      d.moved = true;
      d.held = false;
      if (d.holdTimer) {
        clearTimeout(d.holdTimer);
        d.holdTimer = 0;
      }
      e.preventDefault();
      if (d.mode === 'select-only') return;
      if (d.mode === 'touch-pending') d.mode = d.readyForMarquee ? 'marquee' : 'pan';
      if (d.mode === 'select') d.mode = 'pan';
      if (d.mode === 'person' || d.mode === 'pan') manualZoomTouched.current = true;
      if (d.mode === 'marquee') {
        const viewport = treeScroll.current;
        if (!viewport) return;
        const bounds = viewport.getBoundingClientRect();
        const currentX = e.clientX - bounds.left + viewport.scrollLeft;
        const currentY = e.clientY - bounds.top + viewport.scrollTop;
        setMarqueeRect({
          left: Math.min(d.startLocalX, currentX),
          top: Math.min(d.startLocalY, currentY),
          width: Math.abs(currentX - d.startLocalX),
          height: Math.abs(currentY - d.startLocalY),
        });
        return;
      }
      if (d.mode === 'pan') {
        const viewport = treeScroll.current;
        if (viewport) {
          viewport.scrollLeft = d.scrollLeft - dx;
          viewport.scrollTop = d.scrollTop - dy;
        }
        return;
      }
      const moveX = dx / d.zoom,
        moveY = dy / d.zoom;
      d.lastX = d.x + moveX;
      d.lastY = d.y + moveY;
      if (!d.frame)
        d.frame = requestAnimationFrame(() => {
          d.frame = 0;
          if (d.compactViewport) {
            const deltaX = d.lastX - d.x;
            const deltaY = d.lastY - d.y;
            const nextPositions = d.familyPositions
              ? Object.fromEntries(d.familyPositions.map((position) => [position.id, { treeX: position.x + deltaX, treeY: position.y + deltaY }]))
              : { [d.id]: { treeX: d.lastX, treeY: d.lastY } };
            setPhoneLayoutPreview((previous) => ({ ...previous, ...nextPositions }));
          } else setPeople((prev) => applyDragPositions(prev, d));
        });
    }
    async function onUp(e) {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      drag.current = null;
      if (d.holdTimer) clearTimeout(d.holdTimer);
      if (d.frame) cancelAnimationFrame(d.frame);
      if (d.mode === 'select-only') {
        if (d.held && !d.moved) {
          openPersonDetails(d.id);
          return;
        }
        setSelectedId(d.id);
        setSelectedNodeIds([]);
        return;
      }
      if (d.mode === 'touch-pending') {
        if (!d.moved) clearSelection();
        return;
      }
      if (d.mode === 'pan') {
        if (d.held && !d.moved && d.id) {
          openPersonDetails(d.id);
        } else if (!d.moved && d.id) {
          setSelectedId(d.id);
          setSelectedNodeIds([]);
        } else if (!d.moved) clearSelection();
        return;
      }
      if (d.mode === 'marquee') {
        setMarqueeRect(null);
        if (!d.moved) {
          if (!d.additive) clearSelection();
          return;
        }
        const box = {
          left: Math.min(d.startX, e.clientX),
          right: Math.max(d.startX, e.clientX),
          top: Math.min(d.startY, e.clientY),
          bottom: Math.max(d.startY, e.clientY),
        };
        const hitIds = [...(treeScroll.current?.querySelectorAll('.tree-person') || [])]
          .filter((node) => {
            const bounds = node.getBoundingClientRect();
            return bounds.right >= box.left && bounds.left <= box.right && bounds.bottom >= box.top && bounds.top <= box.bottom;
          })
          .map((node) => node.dataset.personId);
        const ids = [...new Set([...(d.additiveIds || []), ...hitIds])];
        setSelectedId(ids[0] || '');
        setSelectedNodeIds(ids.length > 1 ? ids : []);
        setDetailsOpen(false);
        setMobileDetailsOpen(false);
        return;
      }
      if (d.held && !d.moved) {
        openPersonDetails(d.id);
        return;
      }
      if (d.mode === 'select' || !d.moved) {
        const card = [...(treeScroll.current?.querySelectorAll('.tree-person') || [])].find((node) => node.dataset.personId === d.id)?.querySelector('.tree-person-card');
        card?.focus({ preventScroll: true });
        setSelectedId(d.id);
        setSelectedNodeIds([]);
        return;
      }
      const moving = d.familyPositions
        ? d.familyPositions.map((position) => ({ id: position.id, x: position.x + (d.lastX - d.x), y: position.y + (d.lastY - d.y), w: 196, h: 82 }))
        : [{ id: d.id, x: d.lastX, y: d.lastY, w: 196, h: 82 }];
      const movingIds = new Set(moving.map((position) => position.id));
      const stationary = [...layoutRef.current.positions.values()]
        .filter((position) => !movingIds.has(position.person.id))
        .map((position) => ({ id: position.person.id, x: position.rawX, y: position.rawY, w: position.w, h: position.h }));
      const resolved = resolveNodeOverlaps(moving, stationary);
      const resolvedById = new Map(resolved.map((position) => [position.id, position]));
      setPeople((previous) =>
        previous.map((person) => {
          const position = resolvedById.get(person.id);
          return position ? { ...person, treeX: position.x, treeY: position.y } : person;
        }),
      );
      setSelectedId(d.id);
      if (!d.groupSelection) setSelectedNodeIds([]);
      if (d.compactViewport) {
        setPhoneLayoutPreview((previous) => {
          const next = { ...previous };
          movingIds.forEach((id) => delete next[id]);
          return next;
        });
      }
      const draggedPersonIds = new Map((d.familyPositions || [{ id: d.id, personId: d.personId }]).map((person) => [person.id, person.personId]));
      const databasePositions = moving
        .map((position) => {
          const resolvedPosition = resolvedById.get(position.id);
          const personId = draggedPersonIds.get(position.id);
          return resolvedPosition && personId ? { id: personId, treeX: resolvedPosition.x, treeY: resolvedPosition.y } : null;
        })
        .filter(Boolean);
      if (databasePositions.length) {
        try {
          const response = await fetch('/api/people/layout/positions', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ positions: databasePositions }),
          });
          if (!response.ok) throw Error();
          notify(d.familyPositions ? 'Selected positions saved' : 'Position saved');
        } catch {
          notify(d.familyPositions ? 'Moved for this session; positions could not be saved' : 'Moved for this session; the position could not be saved');
        }
      } else notify(d.familyPositions ? 'Positions saved on this device' : 'Position saved on this device');
    }
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (drag.current?.holdTimer) clearTimeout(drag.current.holdTimer);
      if (drag.current?.frame) cancelAnimationFrame(drag.current.frame);
    };
  }, []);
  const treeName = selectedFamilyId === '__all__' ? 'All families' : selectedFamily?.name || 'Your family';
  return (
    <div
      className={`family-app theme-${theme} ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${detailsOpen ? 'details-open' : 'details-closed'} ${modal?.inline ? 'editing-person' : ''}`}
      style={{ '--details-width': `${detailsWidth}px` }}
    >
      {sidebarOpen && (
        <>
          <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />
          <aside className="simple-sidebar">
            <div className="simple-brand">
              <div className="simple-brand-mark">
                <GitFork size={18} />
              </div>
              <span>kinfolk</span>
              <button className="plain-icon hide-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
                <PanelLeftClose size={17} />
              </button>
            </div>
            <div className="sidebar-family">
              <span className="sidebar-family-mark">{treeName[0] || 'F'}</span>
              <div>
                <strong>{treeName}</strong>
                <small>{apiState === 'checking' && (!hasMongoSnapshot || !people.length) ? 'Loading…' : `${familyPeople.length} ${familyPeople.length === 1 ? 'person' : 'people'}`}</small>
              </div>
            </div>
            {families.length > 1 && (
              <div className="family-picker-label">
                <span>FAMILY</span>
                <div
                  className="family-picker-control"
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setFamilyPickerOpen(false);
                  }}
                >
                  <label className="family-picker-search">
                    <Search size={13} />
                    <input
                      value={familyPickerOpen ? familyQuery : selectedFamilyId === '__all__' ? (families.length === 2 ? 'Both families' : 'All families') : selectedFamily?.name || ''}
                      placeholder="Search families"
                      onFocus={() => {
                        setFamilyPickerOpen(true);
                        setFamilyQuery('');
                      }}
                      onChange={(e) => {
                        setFamilyQuery(e.target.value);
                        setFamilyPickerOpen(true);
                      }}
                      aria-label="Search and select a family"
                      aria-expanded={familyPickerOpen}
                    />
                    {familyPickerOpen && familyQuery && (
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setFamilyQuery('')} aria-label="Clear family search">
                        <X size={12} />
                      </button>
                    )}
                  </label>
                  {familyPickerOpen && (
                    <div className="family-picker-options">
                      <button
                        type="button"
                        className={selectedFamilyId === '__all__' ? 'active' : ''}
                        onClick={() => {
                          setSelectedFamilyId('__all__');
                          setSelectedId('');
                          setFamilyPickerOpen(false);
                          setFamilyQuery('');
                          setDetailsOpen(false);
                          setMobileDetailsOpen(false);
                          if (treeScroll.current) {
                            treeScroll.current.scrollLeft = 0;
                            treeScroll.current.scrollTop = 0;
                          }
                        }}
                      >
                        {families.length === 2 ? 'Both families' : 'All families'} · {people.length}
                      </button>
                      {families
                        .filter((group) => group.name.toLowerCase().includes(familyQuery.toLowerCase()))
                        .map((group) => (
                          <button
                            type="button"
                            key={group.id}
                            className={selectedFamilyId === group.id || (!selectedFamilyId && selectedFamily?.id === group.id) ? 'active' : ''}
                            onClick={() => {
                              setSelectedFamilyId(group.id);
                              setSelectedId('');
                              setFamilyPickerOpen(false);
                              setFamilyQuery('');
                              setDetailsOpen(false);
                              setMobileDetailsOpen(false);
                              if (treeScroll.current) {
                                treeScroll.current.scrollLeft = 0;
                                treeScroll.current.scrollTop = 0;
                              }
                            }}
                          >
                            {group.name} · {group.people.length}
                          </button>
                        ))}
                      {!families.some((group) => group.name.toLowerCase().includes(familyQuery.toLowerCase())) && <span>No matching families</span>}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="side-caption">FAMILY MEMBERS</div>
            <label className="sidebar-search">
              <Search size={14} />
              <input placeholder="Find a person" value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && (
                <button onClick={() => setQuery('')}>
                  <X size={12} />
                </button>
              )}
            </label>
            <div className="member-list" ref={memberList}>
              {filtered.map((p) => (
                <button
                  key={p.id}
                  className={`member-list-item ${selectedId === p.id || selectedNodeIds.includes(p.id) ? 'active' : ''}`}
                  onClick={(e) => {
                    e.currentTarget.focus();
                    selectPerson(p.id);
                    setDetailsOpen(true);
                    if (window.innerWidth < 800) {
                      setSidebarOpen(false);
                      setMobileDetailsOpen(true);
                    }
                    focusPersonInTree(p.id);
                  }}
                >
                  <PersonAvatar person={p} />
                  <span>{fullName(p)}</span>
                </button>
              ))}
              {!filtered.length && (
                <div className="empty-list">
                  {apiState === 'checking' && (!hasMongoSnapshot || !people.length) ? 'Loading family members…' : apiState === 'error' ? 'Could not load family members' : 'No people yet'}
                </div>
              )}
            </div>
            <div className="sidebar-bottom">
              <div className="storage-status">
                <span className={`status-light ${refreshFailed ? 'error' : apiState}`} />
                <span>
                  {refreshFailed && hasMongoSnapshot
                    ? 'Offline · showing saved data'
                    : isRefreshing && hasMongoSnapshot
                      ? 'Refreshing data…'
                      : apiState === 'connected'
                        ? 'Saved to MongoDB'
                        : apiState === 'checking'
                          ? 'Connecting…'
                          : apiState === 'demo'
                            ? 'Saved in this browser'
                            : 'Database unavailable'}
                </span>
              </div>
              <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                <span>Switch to {theme === 'light' ? 'dark' : 'light'} mode</span>
              </button>
            </div>
          </aside>
        </>
      )}
      <main className="simple-main">
        <header className="simple-topbar">
          <div className="topbar-left">
            <button
              className="plain-icon open-sidebar"
              onClick={() => {
                const next = !sidebarOpen;
                setSidebarOpen(next);
                if (next && window.innerWidth <= 1050) setMobileDetailsOpen(false);
              }}
              aria-label={sidebarOpen ? 'Hide family members' : 'Show family members'}
              title={sidebarOpen ? 'Hide family members' : 'Show family members'}
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
            <div className="topbar-title">
              <span>FAMILY TREE</span>
              <h1>{treeName}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="top-theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle color mode">
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button
              className={`top-theme-toggle data-refresh-toggle ${isRefreshing ? 'is-refreshing' : ''}`}
              onClick={refreshFromDatabase}
              disabled={isRefreshing}
              aria-label={isRefreshing ? 'Refreshing family data' : 'Refresh family data'}
              title={isRefreshing ? 'Refreshing family data…' : 'Refresh family data'}
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="right-panel-toggle"
              onClick={() => {
                if (window.innerWidth <= 1050) {
                  setSidebarOpen(false);
                  setDetailsOpen(true);
                  setMobileDetailsOpen(!mobileDetailsOpen);
                } else setDetailsOpen(!detailsOpen);
              }}
              aria-label={(window.innerWidth <= 1050 ? mobileDetailsOpen : detailsOpen) ? 'Hide person details' : 'Show person details'}
            >
              {(window.innerWidth <= 1050 ? mobileDetailsOpen : detailsOpen) ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
            </button>
            <button className="add-person-button" onClick={() => openAddPersonForm()}>
              <Plus size={16} />
              <span>Add person</span>
            </button>
          </div>
        </header>
        <div className="tree-toolbar-simple">
          <div className="tree-toolbar-settings">
            <label className="link-style-toolbar-field">
              <span>LINK STYLE</span>
              <select className="link-style-select" value={linkStyle} onChange={(e) => setLinkStyle(e.target.value)}>
                <option value="direct">Direct links</option>
                <option value="classic">Classic branches</option>
              </select>
            </label>
            <button
              className={`family-color-toggle ${familyColorsEnabled ? 'active' : ''}`}
              type="button"
              aria-label={familyColorsEnabled ? 'Turn off family branch colors' : 'Turn on family branch colors'}
              aria-pressed={familyColorsEnabled}
              title="Color ancestors and descendants around the selected person"
              onClick={() => setFamilyColorsEnabled((enabled) => !enabled)}
            >
              <Palette size={14} />
              <span>Family colors</span>
            </button>
          </div>
          <div className="tree-count">
            <UsersRound size={15} />
            <span>{apiState === 'checking' && (!hasMongoSnapshot || !people.length) ? 'Loading family…' : `${familyPeople.length} ${familyPeople.length === 1 ? 'person' : 'people'}`}</span>
            {(apiState !== 'checking' || (hasMongoSnapshot && people.length > 0)) && (
              <>
                <span className="toolbar-dot">·</span>
                <span>{layout.generationCount} generations</span>
              </>
            )}
          </div>
          <div className="tree-toolbar-actions">
            <button
              className={`canvas-lock-button ${movementLocked ? 'locked' : 'unlocked'}`}
              onClick={() => setMovementLocked((locked) => !locked)}
              aria-pressed={movementLocked}
              aria-label={movementLocked ? 'Unlock node movement' : 'Lock node movement'}
              title={movementLocked ? 'Node movement is locked. Unlock to move people.' : 'Node movement is unlocked. Lock to prevent moving people.'}
            >
              {movementLocked ? <Lock size={14} /> : <Unlock size={14} />}
              <span>{movementLocked ? 'Locked' : 'Unlocked'}</span>
            </button>
            <div className="zoom-tools">
              <button onClick={() => zoomTo(Math.max(0.1, +(zoomValue.current - 0.1).toFixed(2)))} aria-label="Zoom out">
                <ZoomOut size={16} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => zoomTo(Math.min(maxCanvasZoom, +(zoomValue.current + 0.1).toFixed(2)))} aria-label="Zoom in">
                <ZoomIn size={16} />
              </button>
              <i />
              <button onClick={fitTreeToView} aria-label="Fit tree to view">
                <Maximize2 size={15} />
              </button>
            </div>
          </div>
        </div>
        <section className="simple-canvas">
          <div className={`canvas-help ${helpOpen ? 'open' : ''}`} ref={canvasHelpRef}>
            <button
              className="canvas-help-button"
              aria-label="Canvas help"
              aria-expanded={helpOpen}
              aria-controls="canvas-help-tooltip"
              title="Canvas help"
              onClick={() => setHelpOpen((open) => !open)}
            >
              <Info size={17} />
            </button>
            <div id="canvas-help-tooltip" className="canvas-help-tooltip" role="tooltip">
              <p>
                <strong>Select and move:</strong> Drag any person to move them. Click or tap to select; selected people move together. Use the lock button to prevent accidental moves.
              </p>
              <p>
                <strong>Select a group:</strong> On laptop, drag empty canvas. On phone, hold empty canvas briefly, then drag to draw a rectangle.
              </p>
              <p>
                <strong>Move the canvas:</strong> On phone, drag empty space. On laptop, hold Space while dragging or use the middle mouse button.
              </p>
              <p>
                <strong>More:</strong> Hold a person for details. Use the eye icon to show details on laptop. Ctrl + mouse wheel or trackpad pinch zooms. Ctrl+A selects this family; Delete removes the
                selection. Use the + on a node to add a family member.
              </p>
            </div>
          </div>
          {selectedNodeIds.length > 1 && (
            <div className="selection-toolbar" aria-live="polite">
              <span>{selectedNodeIds.length} selected</span>
              <button onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> Remove selected
              </button>
              <button className="selection-clear-button" aria-label="Clear selection" title="Clear selection" onClick={clearSelection}>
                <X size={14} />
              </button>
            </div>
          )}
          <div
            className="tree-scroll"
            ref={treeScroll}
            onPointerDown={startPan}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <div
              className="tree-zoom-surface"
              style={{
                width: `calc(100% + ${treeExtraWidth}px)`,
                minWidth: treeContentWidth,
                height: Math.max(treeBoardHeight * zoom, treeViewportHeight + treePaddingY * 2 + treeBoardOffsetY * zoom, treeBoardTop + treeBoardHeight * zoom + treePaddingY),
              }}
            >
              <div
                className="tree-board"
                style={{
                  width: treeBoardWidth,
                  height: treeBoardHeight,
                  left: treeBoardLeft,
                  top: treeBoardTop,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
              >
                <svg className="connector-svg" width={treeBoardWidth} height={treeBoardHeight} aria-label="Family relationships">
                  <defs>
                    <marker id="family-link-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                      <path d="M0 0 L8 4 L0 8 Z" fill="var(--line)" />
                    </marker>
                    <marker id="partner-link-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                      <path d="M0 0 L8 4 L0 8 Z" fill="var(--accent)" />
                    </marker>
                  </defs>
                  {linkStyle !== 'direct' && <FamilyBranchLinks branches={layout.familyBranches} people={familyPeople} />}
                  {layout.edges
                    .filter((edge) => linkStyle === 'direct' || edge.kind !== 'parent')
                    .map((edge, i) => {
                      const d =
                        edge.path ||
                        (linkStyle === 'classic' && (edge.kind === 'partner' || edge.kind === 'sibling')
                          ? `M${edge.x1} ${edge.y1} L${edge.x2} ${edge.y2}`
                          : `M${edge.x1} ${edge.y1} C${edge.c1x} ${edge.c1y} ${edge.c2x} ${edge.c2y} ${edge.x2} ${edge.y2}`);
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
                      const relationLabelPoint = linkLabelPoint(
                        edge,
                        visibleRelation,
                        connectorNodePositions,
                        connectorLabelPositions,
                        linkStyle === 'classic' && (edge.kind === 'partner' || edge.kind === 'sibling'),
                      );
                      return (
                        <g key={`${linkId}-${i}`}>
                          <path
                            className={`connector ${edge.kind}`}
                            d={d}
                            markerStart={`url(#${edge.kind === 'partner' ? 'partner-link-arrow' : 'family-link-arrow'})`}
                            markerEnd={`url(#${edge.kind === 'partner' ? 'partner-link-arrow' : 'family-link-arrow'})`}
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
                {familyPeople.map((person) => {
                  const pos = layout.positions.get(person.id);
                  const isDetailsVisible = detailsOpen && selectedId === person.id;
                  return (
                    <div
                      key={person.id}
                      data-person-id={person.id}
                      className={`tree-person ${selectedId === person.id || selectedNodeIds.includes(person.id) ? 'selected' : ''} ${familyColorsEnabled && familyColors.has(person.id) ? `family-colored family-color-${familyColors.get(person.id)}` : ''}`}
                      style={{ left: pos.x, top: pos.y }}
                      onPointerDown={(e) => {
                        if (e.pointerType === 'touch') startDrag(e, person, pos);
                      }}
                      onMouseDown={(e) => startDrag(e, person, pos)}
                    >
                      <button
                        className="tree-person-card"
                        aria-label={`Select ${fullName(person)}; drag to move; press and hold to open details`}
                        onContextMenu={(e) => e.preventDefault()}
                        onClick={(e) => {
                          if (e.detail === 0) openPersonDetails(person.id);
                        }}
                      >
                        <PersonAvatar person={person} size="large" />
                        <span className="tree-person-copy">
                          <strong>{fullName(person)}</strong>
                          <small>
                            {year(person.birthDate)}
                            {person.deathDate ? ` — ${year(person.deathDate)}` : ' —'}
                          </small>
                        </span>
                        <span className="drag-grip">⠿</span>
                      </button>
                      <button
                        className="tree-node-edit"
                        title={`Edit ${fullName(person)}`}
                        aria-label={`Edit ${fullName(person)}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          openPersonEditor(person);
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="tree-node-info"
                        title={isDetailsVisible ? `Hide ${fullName(person)} details` : `View ${fullName(person)} details`}
                        aria-label={isDetailsVisible ? `Hide ${fullName(person)} details` : `View ${fullName(person)} details`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isDetailsVisible) {
                            setDetailsOpen(false);
                            setMobileDetailsOpen(false);
                          } else openPersonDetails(person.id);
                        }}
                      >
                        {isDetailsVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <div
                        className={`tree-node-about-wrap ${aboutTooltipId === person.id ? 'is-open' : ''} ${dismissedAboutTooltipId === person.id ? 'is-dismissed' : ''}`}
                        onPointerEnter={(event) => {
                          if (event.pointerType !== 'touch' && dismissedAboutTooltipId === person.id) {
                            setDismissedAboutTooltipId('');
                          }
                        }}
                      >
                        <button
                          className="tree-node-about"
                          aria-label={`Information about ${fullName(person)}`}
                          aria-describedby={`tree-person-tooltip-${person.id}`}
                          aria-expanded={aboutTooltipId === person.id}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (aboutTooltipId === person.id) {
                              setDismissedAboutTooltipId(person.id);
                              setAboutTooltipId('');
                            } else {
                              setDismissedAboutTooltipId('');
                              setAboutTooltipId(person.id);
                            }
                          }}
                        >
                          <Info size={13} />
                        </button>
                        <div
                          id={`tree-person-tooltip-${person.id}`}
                          className="tree-node-about-tooltip"
                          role="tooltip"
                          onPointerDown={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="tree-node-about-heading">
                            <span>PERSON DETAILS</span>
                            <strong>{fullName(person)}</strong>
                          </div>
                          <div className="tree-node-about-facts">
                            <div className="tree-node-about-fact">
                              <span>Gender</span>
                              <strong>{person.gender && person.gender !== 'unspecified' ? `${person.gender[0].toUpperCase()}${person.gender.slice(1)}` : 'Not specified'}</strong>
                            </div>
                            <div className="tree-node-about-fact">
                              <span>Born</span>
                              <strong>{person.birthDate ? year(person.birthDate) : 'Not added'}</strong>
                            </div>
                            {person.birthPlace && (
                              <div className="tree-node-about-fact">
                                <span>Birthplace</span>
                                <strong>{person.birthPlace}</strong>
                              </div>
                            )}
                            {person.occupation && (
                              <div className="tree-node-about-fact">
                                <span>Occupation</span>
                                <strong>{person.occupation}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        className="tree-node-delete"
                        title={`Delete ${fullName(person)}`}
                        aria-label={`Delete ${fullName(person)}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(person.id);
                          setSelectedNodeIds([]);
                          setConfirmDelete(true);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            {marqueeRect && <div className="marquee-selection" style={{ left: marqueeRect.left, top: marqueeRect.top, width: marqueeRect.width, height: marqueeRect.height }} aria-hidden="true" />}
          </div>
          {apiState === 'checking' && (!hasMongoSnapshot || !people.length) ? (
            <div className="tree-loading" role="status" aria-live="polite">
              <span className="loading-spinner" />
              <span>Loading your family tree…</span>
            </div>
          ) : (
            !familyPeople.length && (
              <div className="tree-empty">
                <div className="tree-empty-icon">
                  <GitFork size={26} />
                </div>
                {apiState === 'error' ? (
                  <>
                    <h2>Couldn’t load your family tree</h2>
                    <p>Check that the API and MongoDB are running, then try again.</p>
                    <button className="add-person-button" onClick={refreshFromDatabase} disabled={isRefreshing}>
                      {isRefreshing ? 'Refreshing…' : 'Try again'}
                    </button>
                  </>
                ) : (
                  <>
                    <h2>Start your family tree</h2>
                    <p>Add a person, then link parents and partners to build the branches.</p>
                    <button className="add-person-button" onClick={() => openAddPersonForm()}>
                      <Plus size={16} />
                      Add first person
                    </button>
                  </>
                )}
              </div>
            )
          )}
          <div className="canvas-zoom-controls">
            <button onClick={() => zoomTo(Math.min(maxCanvasZoom, +(zoomValue.current + 0.1).toFixed(2)))} aria-label="Zoom in">
              <Plus size={17} />
            </button>
            <button onClick={() => zoomTo(Math.max(0.1, +(zoomValue.current - 0.1).toFixed(2)))} aria-label="Zoom out">
              <span>−</span>
            </button>
          </div>
        </section>
      </main>
      {mobileDetailsOpen && <button className="details-scrim" onClick={clearSelection} aria-label="Close person details and clear selection" />}
      {detailsOpen && (
        <aside className={`simple-details ${mobileDetailsOpen ? 'show-mobile' : ''} ${modal?.inline ? 'editing-person' : ''}`}>
          <div
            className="details-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize details panel"
            aria-valuenow={detailsWidth}
            tabIndex={0}
            onKeyDown={handleDetailsResizeKey}
            onPointerDown={beginDetailsResize}
            onPointerMove={moveDetailsResize}
            onPointerUp={endDetailsResize}
            onPointerCancel={endDetailsResize}
          />
          {modal?.inline && (!modal.person || modal.person.id === selected?.id) ? (
            <PersonModal
              key={modal.person?.id || modal.kind || 'new'}
              modal={modal}
              people={people}
              onClose={() => {
                setModal(null);
                if (!selected) {
                  setDetailsOpen(false);
                  setMobileDetailsOpen(false);
                }
              }}
              onSave={saveMember}
            />
          ) : selected ? (
            <>
              <div className="details-heading">
                <span>PERSON DETAILS</span>
                <div>
                  <button className="family-links-edit-button" onClick={() => setModal({ person: selected, inline: true })} aria-label="Edit person" title="Edit person">
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
              <div className="selected-profile">
                <PersonAvatar person={selected} size="profile" />
                <h2>{fullName(selected)}</h2>
                <span className="person-years">
                  {year(selected.birthDate)}
                  {selected.deathDate ? ` — ${year(selected.deathDate)}` : ' —'}
                </span>
              </div>
              <div className="details-fields">
                <div className="detail-field">
                  <CalendarDays size={15} />
                  <span>
                    <small>Born</small>
                    <strong>{formatLongDate(selected.birthDate)}</strong>
                  </span>
                </div>
                <div className="detail-field">
                  <MapPin size={15} />
                  <span>
                    <small>Birthplace</small>
                    <strong>{selected.birthPlace || 'Not added'}</strong>
                  </span>
                </div>
                {selected.deathDate && (
                  <div className="detail-field">
                    <CalendarDays size={15} />
                    <span>
                      <small>Died</small>
                      <strong>
                        {new Date(`${selected.deathDate}T00:00:00`).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </strong>
                    </span>
                  </div>
                )}
                {selected.occupation && (
                  <div className="detail-field">
                    <Heart size={15} />
                    <span>
                      <small>Occupation</small>
                      <strong>{selected.occupation}</strong>
                    </span>
                  </div>
                )}
              </div>
              <div className="details-bio">
                <label>ABOUT</label>
                <p>{selected.bio || 'Add a short story or memory about this person.'}</p>
              </div>
              <div className="details-links">
                <div className="details-links-heading">
                  <label>FAMILY LINKS</label>
                  <button className="family-links-edit-button" onClick={openLinkEditor} aria-label="Edit family links" title="Edit family links">
                    <Pencil size={13} />
                  </button>
                </div>
                {[
                  ...(selected.parentIds || []).map((id) => ({ id, role: 'Parent' })),
                  ...(selected.partnerIds || []).map((id) => ({
                    id,
                    role: 'Partner',
                    label: partnerDisplayLabel(selected, byId(id)),
                  })),
                  ...people.filter((p) => (p.parentIds || []).includes(selected.id)).map((p) => ({ id: p.id, role: 'Child' })),
                  ...people
                    .filter((p) => p.id !== selected.id && ((p.siblingIds || []).includes(selected.id) || (p.parentIds || []).some((parentId) => (selected.parentIds || []).includes(parentId))))
                    .map((p) => ({ id: p.id, role: 'Sibling' })),
                  ...(selected.relationshipLinks || []).map((link) => ({ id: link.personId, role: link.label || 'Related' })),
                ].map(
                  (link, i) =>
                    byId(link.id) && (
                      <button className="details-link-row" key={`${link.role}-${link.id}-${i}`} onClick={() => openPersonDetails(link.id)}>
                        <PersonAvatar person={byId(link.id)} />
                        <span className="details-link-person">
                          <strong>{fullName(byId(link.id))}</strong>
                        </span>
                        <small className="details-link-role">{link.label || relationshipLabel(link.role, byId(link.id), selected)}</small>
                      </button>
                    ),
                )}
                <div className="details-actions-row">
                  <button
                    className="details-cancel-button"
                    onClick={() => {
                      setModal(null);
                      setDetailsOpen(false);
                      setMobileDetailsOpen(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button className="remove-person-button" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={14} /> Remove person
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="details-empty">
              <UsersRound size={23} />
              <p>Select a person in the tree to see details.</p>
            </div>
          )}
        </aside>
      )}
      {modal && !modal.inline && <PersonModal key={modal.person?.id || modal.kind || 'new'} modal={modal} people={people} onClose={() => setModal(null)} onSave={saveMember} />}
      {confirmDelete && selected && (
        <div className="simple-modal-backdrop">
          <div className="delete-dialog">
            <h2>{selectedNodeIds.length > 1 ? `Remove ${selectedNodeIds.length} selected people?` : `Remove ${fullName(selected)}?`}</h2>
            <p>
              {selectedNodeIds.length > 1
                ? 'This will permanently remove the selected family members and their links.'
                : deleteDescendants
                  ? `This will also delete ${selectedDescendants.length} descendant${selectedDescendants.length === 1 ? '' : 's'} and their links.`
                  : 'This also removes their links from the tree.'}
            </p>
            {selectedNodeIds.length <= 1 && (
              <label className="delete-descendants-option">
                <input type="checkbox" checked={deleteDescendants} onChange={(e) => setDeleteDescendants(e.target.checked)} />
                <span>Also delete all descendants ({selectedDescendants.length})</span>
              </label>
            )}
            <div>
              <button onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="danger-action" onClick={removePerson}>
                Remove {selectedNodeIds.length > 1 ? 'selected people' : 'person'}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="simple-toast">{toast}</div>}
    </div>
  );
}

const relationshipOptions = [
  'Father',
  'Mother',
  'Parent',
  'Son',
  'Daughter',
  'Child',
  'Husband',
  'Wife',
  'Boyfriend',
  'Girlfriend',
  'Fiancé',
  'Fiancée',
  'Partner',
  'Spouse',
  'Former spouse',
  'Former partner',
  'Brother',
  'Sister',
  'Sibling',
  'Other',
];
function defaultPartnerLabel(gender) {
  return gender === 'male' ? 'Husband' : gender === 'female' ? 'Wife' : 'Spouse';
}
function RelationshipEditor({ people, relationships, onChange, excludeId }) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const selectedIds = relationships.map((link) => link.personId);
  const results = people.filter((person) => person.id !== excludeId && !selectedIds.includes(person.id) && fullName(person).toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6);
  function add(id) {
    onChange([...relationships, { personId: id, role: '', customLabel: '' }]);
    setQuery('');
  }
  function update(index, changes) {
    if (changes.role && ['Father', 'Mother', 'Parent'].includes(changes.role)) {
      const parentCount = relationships.filter((link, rowIndex) => rowIndex !== index && ['Father', 'Mother', 'Parent'].includes(link.role)).length;
      if (parentCount >= 2) {
        setError('A person can have at most two parents.');
        return;
      }
    }
    if (changes.role && ['Son', 'Daughter', 'Child'].includes(changes.role)) {
      const relatedPerson = people.find((person) => person.id === relationships[index]?.personId);
      if (relatedPerson && relatedPerson.parentIds?.length >= 2 && !relatedPerson.parentIds.includes(excludeId)) {
        setError('This person already has two parents.');
        return;
      }
    }
    setError('');
    onChange(relationships.map((link, rowIndex) => (rowIndex === index ? { ...link, ...changes } : link)));
  }
  return (
    <div className="relationship-editor">
      {relationships.length > 0 && (
        <div className="relationship-list">
          {relationships.map((link, index) => {
            const person = people.find((item) => item.id === link.personId);
            if (!person) return null;
            return (
              <div className="relationship-row" key={`${link.personId}-${index}`}>
                <strong title={fullName(person)}>{fullName(person)}</strong>
                <select
                  aria-label={`Relationship with ${fullName(person)}`}
                  value={link.role}
                  required
                  onChange={(e) => update(index, { role: e.target.value, customLabel: e.target.value === 'Other' ? link.customLabel : '' })}
                >
                  <option value="" disabled>
                    Select relationship
                  </option>
                  {relationshipOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'Other' ? 'Custom…' : option}
                    </option>
                  ))}
                </select>
                {link.role === 'Other' && (
                  <input
                    className="custom-relationship-input"
                    aria-label={`Custom relationship with ${fullName(person)}`}
                    value={link.customLabel}
                    onChange={(e) => update(index, { customLabel: e.target.value })}
                    placeholder="Describe relationship"
                    required
                  />
                )}
                <button
                  type="button"
                  className="remove-link-button"
                  onClick={() => onChange(relationships.filter((_, rowIndex) => rowIndex !== index))}
                  aria-label={`Remove relationship with ${fullName(person)}`}
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <label className="link-search relationship-search">
        <Search size={13} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search and add a family relationship" />
      </label>
      {query && (
        <div className="link-search-results">
          {results.map((person) => (
            <button type="button" key={person.id} onClick={() => add(person.id)}>
              {fullName(person)}
            </button>
          ))}
          {!results.length && <span>No matching people</span>}
        </div>
      )}
      {error && (
        <small className="relationship-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

function PersonModal({ modal, people, onClose, onSave }) {
  const p = modal.person;
  const familyLinksRef = useRef(null);
  const [form, setForm] = useState({
    firstName: p?.firstName || '',
    lastName: p?.lastName || '',
    gender: p?.gender || 'unspecified',
    birthDate: p?.birthDate?.slice(0, 10) || '',
    deathDate: p?.deathDate?.slice(0, 10) || '',
    birthPlace: p?.birthPlace || '',
    photoUrl: p?.photoUrl || '',
    occupation: p?.occupation || '',
    bio: p?.bio || '',
    notes: p?.notes || '',
  });
  const [relationships, setRelationships] = useState(() => {
    if (!p) return [];
    const rows = [];
    const add = (personId, role, customLabel = '') => {
      if (personId !== p.id && people.some((person) => person.id === personId) && !rows.some((link) => link.personId === personId)) rows.push({ personId, role, customLabel });
    };
    (p.parentIds || []).forEach((id) => {
      const parent = people.find((person) => person.id === id);
      add(id, parent?.gender === 'male' ? 'Father' : parent?.gender === 'female' ? 'Mother' : 'Parent');
    });
    people.filter((person) => (person.parentIds || []).includes(p.id)).forEach((child) => add(child.id, child.gender === 'male' ? 'Son' : child.gender === 'female' ? 'Daughter' : 'Child'));
    (p.partnerIds || []).forEach((id) => {
      const stored = partnerRelationship(p, id);
      const fallback = defaultPartnerLabel(people.find((person) => person.id === id)?.gender);
      const role = relationshipOptions.includes(stored) ? stored : relationshipOptions.includes(fallback) ? fallback : 'Spouse';
      add(id, stored && !relationshipOptions.includes(stored) ? 'Other' : role, stored && !relationshipOptions.includes(stored) ? stored : '');
    });
    const relatedSiblings = new Set(p.siblingIds || []);
    people.filter((person) => person.id !== p.id && (person.parentIds || []).some((parentId) => (p.parentIds || []).includes(parentId))).forEach((person) => relatedSiblings.add(person.id));
    relatedSiblings.forEach((id) => add(id, 'Sibling'));
    (p.relationshipLinks || []).forEach((link) => add(link.personId, 'Other', link.label));
    return rows;
  });
  useEffect(() => {
    if (!modal.focusLinks) return;
    const frame = requestAnimationFrame(() => familyLinksRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [modal.focusLinks]);
  const change = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  function submit(e) {
    e.preventDefault();
    const byRole = (roles) => relationships.filter((link) => roles.includes(link.role)).map((link) => link.personId);
    const partnerIds = byRole(['Husband', 'Wife', 'Boyfriend', 'Girlfriend', 'Fiancé', 'Fiancée', 'Partner', 'Spouse', 'Former spouse', 'Former partner']);
    const partnerRelationships = relationships.filter((link) => partnerIds.includes(link.personId)).map((link) => ({ partnerId: link.personId, label: link.role }));
    const relationshipLinks = relationships.filter((link) => link.role === 'Other' && link.customLabel.trim()).map((link) => ({ personId: link.personId, label: link.customLabel.trim() }));
    onSave({
      ...form,
      parentIds: byRole(['Father', 'Mother', 'Parent']),
      partnerIds,
      partnerRelationships,
      siblingIds: byRole(['Brother', 'Sister', 'Sibling']),
      relationshipLinks,
      childIds: byRole(['Son', 'Daughter', 'Child']),
    });
  }
  const title = p ? 'Edit person' : 'Add a person';
  const editor = (
    <form className={modal.inline ? 'inline-person-editor' : 'simple-person-modal'} onSubmit={submit}>
      <header>
        <div>
          <small>FAMILY MEMBER</small>
          <h2>{title}</h2>
        </div>
        <button type="button" className="plain-icon" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="person-form-body">
        <label className="photo-url">
          <Camera size={15} />
          <span>Photo URL</span>
          <input value={form.photoUrl} onChange={(e) => change('photoUrl', e.target.value)} placeholder="https://…" />
        </label>
        <div className="simple-form-grid person-basic-grid">
          <div className="person-form-row two-field-row">
            <label>
              First name *
              <input required value={form.firstName} onChange={(e) => change('firstName', e.target.value)} placeholder="First name" />
            </label>
            <label>
              Last name
              <input value={form.lastName} onChange={(e) => change('lastName', e.target.value)} placeholder="Last name" />
            </label>
          </div>
          <div className="person-form-row three-field-row">
            <label>
              Born
              <input type="date" value={form.birthDate} onChange={(e) => change('birthDate', e.target.value)} />
            </label>
            <label>
              Died
              <input type="date" value={form.deathDate} onChange={(e) => change('deathDate', e.target.value)} />
            </label>
            <label>
              Gender
              <select value={form.gender} onChange={(e) => change('gender', e.target.value)}>
                <option value="unspecified">Not specified</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="nonbinary">Nonbinary</option>
              </select>
            </label>
          </div>
          <div className="person-form-row two-field-row">
            <label>
              Birthplace
              <input value={form.birthPlace} onChange={(e) => change('birthPlace', e.target.value)} placeholder="City, country" />
            </label>
            <label>
              Occupation
              <input value={form.occupation} onChange={(e) => change('occupation', e.target.value)} placeholder="Occupation" />
            </label>
          </div>
        </div>
        <div className="simple-link-fields" ref={familyLinksRef}>
          <div className="simple-link-field relationship-field">
            <strong>Relationships</strong>
            <p className="relationship-help">Add a person, then choose how they are related.</p>
            <RelationshipEditor people={people} relationships={relationships} onChange={setRelationships} excludeId={p?.id} />
          </div>
        </div>
        <div className="simple-form-grid person-story-grid">
          <label className="wide-form-field">
            About
            <textarea rows="2" value={form.bio} onChange={(e) => change('bio', e.target.value)} placeholder="A little about this person" />
          </label>
          <label className="wide-form-field">
            Family notes
            <textarea rows="2" value={form.notes} onChange={(e) => change('notes', e.target.value)} placeholder="Notes for the family archive" />
          </label>
        </div>
      </div>
      <footer>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="save-person-button">
          {p ? 'Save changes' : 'Add person'}
        </button>
      </footer>
    </form>
  );
  return modal.inline ? (
    editor
  ) : (
    <div
      className="simple-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {editor}
    </div>
  );
}
