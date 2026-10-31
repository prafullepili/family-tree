import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Minimize2,
  Fullscreen,
} from 'lucide-react';
import { initialPeople } from './demoFamily.js';
import { layoutTree, resolveNodeOverlaps } from './layoutTree.js';
import { relationshipPlacement } from './relationshipPlacement.js';
import { CanvasHelp, SelectionToolbar, TreeStatus } from './CanvasSupport.jsx';
import TreeToolbar from './TreeToolbar.jsx';
import TreeSettingsControls, { DATA_COLUMNS } from './TreeSettingsControls.jsx';
import { AppHeader, FamilySidebar } from './AppNavigation.jsx';
import AppDialogs from './AppDialogs.jsx';
import PersonDetailsPanel, { PersonModalDialog } from './PersonDetailsPanel.jsx';
import TreePersonNode from './TreePersonNode.jsx';
import { apiFetch as sharedApiFetch, apiUrl, loadInitialFamilyData, loadRemoteFamilyData } from './apiClient.js';
import { FamilyBranchLinks, PersonAvatar } from './TreeRenderComponents.jsx';
import { stepCanvasZoom } from './zoomMath.js';
import {
  applyDragPositions,
  compactDashboardPositions,
  descendantIds,
  familyColorMap,
  fromApi,
  fullName,
  getFamilyGroups,
  linkLabelPoint,
  mongoPeopleCacheKey,
  partnerDisplayLabel,
  partnerRelationship,
  readMongoPeopleCache,
  relationshipLabel,
  relationshipPath,
  storageGet,
  storageRemove,
  storageSet,
  year,
} from './appHelpers.js';

export default function App({ authUser, onLogout }) {
  const [isCompactViewport, setIsCompactViewport] = useState(() => window.innerWidth <= 1050);
  const workspaceKey = `${authUser?.id}:${authUser?.treeId}`;
  const readOnly = authUser?.treeRole === 'viewer';
  const apiFetch = (input, options = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set('X-Tree-Id', authUser.treeId);
    return sharedApiFetch(input, { ...options, headers });
  };
  const cacheKey = mongoPeopleCacheKey(workspaceKey);
  const [initialCache] = useState(() => readMongoPeopleCache(workspaceKey));
  const [people, setPeople] = useState(() => initialCache.people);
  const [hasMongoSnapshot, setHasMongoSnapshot] = useState(initialCache.hasSnapshot);
  const memberList = useRef(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [familyPickerOpen, setFamilyPickerOpen] = useState(false);
  const [familyQuery, setFamilyQuery] = useState('');
  const [visibleLinkTypes, setVisibleLinkTypes] = useState(() => {
    try {
      return {
        parent: true,
        partner: true,
        sibling: true,
        custom: true,
        ...JSON.parse(storageGet('kinfolk-visible-link-types-v1') || '{}'),
      };
    } catch {
      return { parent: true, partner: true, sibling: true, custom: true };
    }
  });
  const [deceasedRibbon, setDeceasedRibbon] = useState(() => {
    const saved = storageGet('kinfolk-deceased-ribbon-v1');
    return ['black', 'red'].includes(saved) ? saved : 'off';
  });
  const [treeVisualStyle, setTreeVisualStyle] = useState(() => {
    const savedStyle = storageGet('kinfolk-tree-visual-style-v2');
    return ['dashboard', 'classic', 'atlas'].includes(savedStyle) ? savedStyle : 'dashboard';
  });
  const [familyColorsEnabled, setFamilyColorsEnabled] = useState(() => storageGet('kinfolk-family-colors-v1') === 'true');
  const [selectedId, setSelectedId] = useState('');
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [aboutTooltipId, setAboutTooltipId] = useState('');
  const [quickAddForId, setQuickAddForId] = useState('');
  const [highlightedLink, setHighlightedLink] = useState(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState('');
  const [dismissedAboutTooltipId, setDismissedAboutTooltipId] = useState('');
  const [movementUnlockedSetting, setMovementLocked] = useState(() => storageGet('kinfolk-canvas-movement-locked-v2') === 'true');
  const movementLocked = readOnly || movementUnlockedSetting;
  const [marqueeRect, setMarqueeRect] = useState(null);
  const [phoneLayoutPreview, setPhoneLayoutPreview] = useState({});
  const [theme, setTheme] = useState(() => storageGet('kinfolk-theme') || 'light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const canvasHelpRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);
  const [fullscreenFallback, setFullscreenFallback] = useState(false);
  const [treeStyleMenuOpen, setTreeStyleMenuOpen] = useState(false);
  const treeStyleControlRef = useRef(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportFieldsOpen, setExportFieldsOpen] = useState(false);
  const [exportColumns, setExportColumns] = useState(() => {
    try {
      const saved = JSON.parse(storageGet('kinfolk-export-columns-v2') || 'null');
      const valid = Array.isArray(saved) ? saved.filter((column) => DATA_COLUMNS.includes(column)) : [];
      return valid.length ? valid : DATA_COLUMNS;
    } catch {
      return DATA_COLUMNS;
    }
  });
  const settingsControlRef = useRef(null);
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
  const [memberFamilyFilter, setMemberFamilyFilter] = useState('__all__');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [apiState, setApiState] = useState('checking');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [confirmArrange, setConfirmArrange] = useState(false);
  const [isArranging, setIsArranging] = useState(false);
  const [savedLayouts, setSavedLayouts] = useState([]);
  const [savedLayoutsOpen, setSavedLayoutsOpen] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [applyingLayoutId, setApplyingLayoutId] = useState('');
  const [confirmLayoutDeleteId, setConfirmLayoutDeleteId] = useState('');
  const [deletingLayoutId, setDeletingLayoutId] = useState('');
  const [pendingImport, setPendingImport] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteDescendants, setDeleteDescendants] = useState(() => storageGet('kinfolk-delete-descendants') === 'true');
  const drag = useRef(null);
  const pendingPositionSaves = useRef(new Map());
  const positionSaveTimer = useRef(0);
  const positionSaveMessage = useRef({ success: 'Position saved', failure: 'Moved for this session; the position could not be saved' });
  const spacePan = useRef(false);
  const pinch = useRef(null);
  const zoomFrame = useRef(0);
  const pendingZoom = useRef(null);
  const zoomValue = useRef(1);
  const pendingZoomAnchor = useRef(null);
  const treeScroll = useRef(null);
  const previousOrigin = useRef(null);
  const refreshDataRef = useRef(null);
  const refreshInFlight = useRef(null);
  const importFileRef = useRef(null);
  const families = useMemo(() => getFamilyGroups(people), [people]);
  const selectedFamily = selectedFamilyId === '__all__' ? null : families.find((group) => group.id === selectedFamilyId) || [...families].sort((a, b) => b.people.length - a.people.length)[0];
  const familyPeople = selectedFamilyId === '__all__' ? people : selectedFamily?.people || people;
  const familyPeopleIdentity = familyPeople
    .map((person) => String(person._id || person.id))
    .sort()
    .join('|');
  const layoutScopeId = selectedFamilyId === '__all__' ? '__all__' : selectedFamily?.id || familyPeople[0]?.id || '__all__';
  const treePeople = useMemo(
    () => (memberFamilyFilter === '__all__' ? familyPeople : familyPeople.filter((person) => (person.lastName?.trim().toLocaleLowerCase() || '__other__') === memberFamilyFilter)),
    [familyPeople, memberFamilyFilter],
  );
  const activeLinkNodeId = treePeople.some((person) => person.id === (highlightedNodeId || selectedId)) ? highlightedNodeId || selectedId : '';
  const highlightedAncestorIds = useMemo(() => {
    const byId = new Map(treePeople.map((person) => [person.id, person]));
    const ids = new Set();
    const visit = (id) => {
      if (!id || ids.has(id) || !byId.has(id)) return;
      ids.add(id);
      (byId.get(id).parentIds || []).forEach(visit);
    };
    visit(activeLinkNodeId);
    return ids;
  }, [activeLinkNodeId, treePeople]);
  const highlightedNetworkIds = useMemo(() => {
    const ids = new Set(highlightedAncestorIds);
    if (!activeLinkNodeId) return ids;
    treePeople.forEach((person) => {
      const references = [...(person.parentIds || []), ...(person.partnerIds || []), ...(person.siblingIds || []), ...(person.relationshipLinks || []).map((link) => link.personId)];
      if (person.id === activeLinkNodeId) references.forEach((id) => ids.add(id));
      if (references.includes(activeLinkNodeId)) ids.add(person.id);
    });
    ids.add(activeLinkNodeId);
    return ids;
  }, [activeLinkNodeId, treePeople, highlightedAncestorIds]);
  const familyColorFocusId = treePeople.some((person) => person.id === selectedId) ? selectedId : null;
  const familyColors = useMemo(() => familyColorMap(treePeople, familyColorFocusId), [treePeople, familyColorFocusId]);
  const selected = people.find((p) => p.id === selectedId) || null;
  const byId = (id) => people.find((p) => p.id === id);
  const familyLinkGroups = useMemo(() => {
    if (!selected) return [];
    const peopleById = new Map(people.map((person) => [person.id, person]));
    const seen = new Set();
    const makeGroup = (key, label, links) => ({
      key,
      label,
      links: links.filter((link) => {
        if (!peopleById.has(link.id) || seen.has(link.id)) return false;
        seen.add(link.id);
        return true;
      }),
    });
    const siblings = people
      .filter((person) => person.id !== selected.id && ((person.siblingIds || []).includes(selected.id) || (person.parentIds || []).some((parentId) => (selected.parentIds || []).includes(parentId))))
      .map((person) => ({ id: person.id, role: 'Sibling' }));
    return [
      makeGroup(
        'parents',
        'Parents',
        (selected.parentIds || []).map((id) => ({ id, role: 'Parent' })),
      ),
      makeGroup(
        'partners',
        'Partners',
        (selected.partnerIds || []).map((id) => ({ id, role: 'Partner', label: partnerDisplayLabel(selected, peopleById.get(id)) })),
      ),
      makeGroup(
        'children',
        'Children',
        people.filter((person) => (person.parentIds || []).includes(selected.id)).map((person) => ({ id: person.id, role: 'Child' })),
      ),
      makeGroup('siblings', 'Siblings', siblings),
      makeGroup(
        'other',
        'Other relationships',
        (selected.relationshipLinks || []).map((link) => ({ id: link.personId, role: link.label || 'Related' })),
      ),
    ].filter((group) => group.links.length);
  }, [people, selected]);
  const layoutPeople = useMemo(() => {
    if (!isCompactViewport || !Object.keys(phoneLayoutPreview).length) return treePeople;
    return treePeople.map((person) => {
      const preview = phoneLayoutPreview[person.id];
      return preview ? { ...person, treeX: preview.treeX, treeY: preview.treeY } : person;
    });
  }, [treePeople, isCompactViewport, phoneLayoutPreview]);
  const cardWidth = 196;
  const cardHeight = 76;
  const layout = useMemo(() => layoutTree(layoutPeople, { nodeWidth: cardWidth, nodeHeight: cardHeight }), [layoutPeople, cardWidth, cardHeight]);
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
  const maxCanvasZoom = Math.max(0.1, Math.min(2, (treeViewportWidth - 24) / cardWidth));
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
  const memberFamilyOptions = useMemo(() => {
    const groups = new Map();
    familyPeople.forEach((person) => {
      const surname = person.lastName?.trim();
      const key = surname?.toLocaleLowerCase() || '__other__';
      if (!groups.has(key)) groups.set(key, { key, name: surname ? `${surname} family` : 'Other family members', count: 0 });
      groups.get(key).count += 1;
    });
    return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [familyPeople]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return familyPeople.filter((person) => {
      const surnameKey = person.lastName?.trim().toLocaleLowerCase() || '__other__';
      const matchesGroup = memberFamilyFilter === '__all__' || surnameKey === memberFamilyFilter;
      const matchesName = !normalizedQuery || fullName(person).toLocaleLowerCase().includes(normalizedQuery);
      return matchesGroup && matchesName;
    });
  }, [query, familyPeople, memberFamilyFilter]);
  const sidebarMemberGroups = useMemo(() => {
    const groups = new Map();
    filtered.forEach((person) => {
      const surname = person.lastName?.trim();
      const key = surname?.toLocaleLowerCase() || '__other__';
      if (!groups.has(key)) groups.set(key, { name: surname ? `${surname} family` : 'Other family members', people: [] });
      groups.get(key).people.push(person);
    });
    return [...groups.values()]
      .map((group) => ({ ...group, people: [...group.people].sort((a, b) => fullName(a).localeCompare(fullName(b))) }))
      .sort((a, b) => b.people.length - a.people.length || a.name.localeCompare(b.name));
  }, [filtered]);
  useEffect(() => {
    setSelectedNodeIds([]);
    setHighlightedNodeId('');
    setHighlightedLink(null);
    setSelectedId((current) => (current && !treePeople.some((person) => person.id === current) ? '' : current));
    setDetailsOpen(false);
    setMobileDetailsOpen(false);
    manualZoomTouched.current = false;
    autoFitSignature.current = '';
  }, [memberFamilyFilter]);
  const selectedDescendants = selected ? descendantIds(people, selected.id) : [];
  const deleteShortcutState = useRef(null);
  deleteShortcutState.current = { selectedId, selectedNodeIds, confirmDelete, modal, familyPeople: treePeople };
  useEffect(() => {
    document.getElementById('boot-screen')?.remove();
    document.documentElement.dataset.theme = theme;
    storageSet('kinfolk-theme', theme);
  }, [theme]);
  useEffect(() => {
    storageSet('kinfolk-canvas-movement-locked-v2', String(movementLocked));
  }, [movementLocked]);
  useEffect(() => {
    storageSet('kinfolk-tree-visual-style-v2', treeVisualStyle);
  }, [treeVisualStyle]);
  useEffect(() => {
    if (!treeStyleMenuOpen && !settingsOpen) return;
    const closeMenu = (event) => {
      if (!treeStyleControlRef.current?.contains(event.target)) setTreeStyleMenuOpen(false);
      if (!settingsControlRef.current?.contains(event.target)) setSettingsOpen(false);
    };
    window.addEventListener('pointerdown', closeMenu);
    return () => window.removeEventListener('pointerdown', closeMenu);
  }, [treeStyleMenuOpen, settingsOpen]);

  useEffect(() => {
    if (!quickAddForId) return;
    const closeQuickAdd = (event) => {
      if (!event.target.closest('.tree-node-quick-add')) setQuickAddForId('');
    };
    window.addEventListener('pointerdown', closeQuickAdd);
    return () => window.removeEventListener('pointerdown', closeQuickAdd);
  }, [quickAddForId]);
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
    storageSet('kinfolk-visible-link-types-v1', JSON.stringify(visibleLinkTypes));
    storageRemove('kinfolk-link-style');
  }, [visibleLinkTypes]);
  useEffect(() => {
    storageSet('kinfolk-deceased-ribbon-v1', deceasedRibbon);
  }, [deceasedRibbon]);
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
      if (previous?.hasPeople && treePeople.length) {
        treeScroll.current.scrollLeft += (layout.originX - previous.x) * zoom;
        treeScroll.current.scrollTop += (layout.originY - previous.y) * zoom;
      } else {
        treeScroll.current.scrollLeft = 0;
        treeScroll.current.scrollTop = 0;
      }
    }
    previousOrigin.current = { x: layout.originX, y: layout.originY, hasPeople: treePeople.length > 0 };
  }, [layout.originX, layout.originY, zoom, treePeople.length]);
  const layoutSignature = layoutPeople
    .map((person) => `${person.id}:${person.treeX ?? ''}:${person.treeY ?? ''}:${(person.parentIds || []).join(',')}:${(person.partnerIds || []).join(',')}`)
    .join('|');
  useLayoutEffect(() => {
    if (!treePeople.length || apiState === 'checking' || manualZoomTouched.current) return;
    const viewport = treeScroll.current;
    if (!viewport || !treeViewportWidth || !treeViewportHeight) return;
    const signature = `${isCompactViewport ? 'compact' : 'wide'}:${layoutSignature}:${treeViewportWidth}x${treeViewportHeight}`;
    if (autoFitSignature.current === signature) return;
    autoFitSignature.current = signature;
    const contentWidth = Math.max(cardWidth, maxNodeX - minNodeX);
    const contentHeight = Math.max(cardHeight, maxNodeY - minNodeY);
    const minimumReadableZoom = 0.1;
    const fittedZoom = Math.max(minimumReadableZoom, Math.min(1, maxCanvasZoom, (viewport.clientWidth - 48) / contentWidth, (viewport.clientHeight - 48) / contentHeight));
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
  }, [
    apiState,
    treePeople.length,
    isCompactViewport,
    layoutSignature,
    maxCanvasZoom,
    maxNodeX,
    maxNodeY,
    minNodeX,
    minNodeY,
    treeViewportHeight,
    treeViewportWidth,
    treeVisualStyle,
    cardWidth,
    cardHeight,
  ]);
  useEffect(() => {
    if (apiState !== 'demo') return;
    const timer = setTimeout(() => storageSet('kinfolk-demo-people', JSON.stringify(people)), 250);
    return () => clearTimeout(timer);
  }, [people, apiState]);
  useEffect(() => {
    let active = true;
    if (!familyPeople.length || !['connected', 'demo'].includes(apiState)) {
      setSavedLayouts([]);
      return undefined;
    }
    if (apiState === 'demo') {
      try {
        const layouts = JSON.parse(storageGet('kinfolk-saved-layouts-v1') || '[]');
        const familyPersonIds = new Set(familyPeople.map((person) => String(person.id)));
        setSavedLayouts(
          Array.isArray(layouts)
            ? layouts.filter((item) => item.familyId === layoutScopeId || (layoutScopeId !== '__all__' && (item.positions || []).some((position) => familyPersonIds.has(String(position.personId)))))
            : [],
        );
      } catch {
        setSavedLayouts([]);
      }
      return undefined;
    }
    const layoutQuery = new URLSearchParams({ familyId: layoutScopeId });
    if (layoutScopeId !== '__all__')
      layoutQuery.set(
        'personIds',
        familyPeople
          .map((person) => person._id)
          .filter(Boolean)
          .join(','),
      );
    apiFetch(apiUrl(`/api/layouts?${layoutQuery}`), { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw Error();
        return response.json();
      })
      .then((layouts) => {
        if (active) setSavedLayouts(layouts);
      })
      .catch(() => {
        if (active) setSavedLayouts([]);
      });
    return () => {
      active = false;
    };
  }, [apiState, familyPeopleIdentity, layoutScopeId]);
  useEffect(() => {
    if (!['connected', 'offline'].includes(apiState) || !hasMongoSnapshot) return;
    try {
      storageSet(cacheKey, JSON.stringify({ people, updatedAt: Date.now() }));
    } catch {
      // The live MongoDB data remains available even if browser storage is full or disabled.
    }
  }, [people, apiState, hasMongoSnapshot, cacheKey]);
  useEffect(() => {
    let active = true;
    (async () => {
      setIsRefreshing(true);
      try {
        const result = await loadInitialFamilyData(workspaceKey);
        if (result.mode === 'demo') {
          if (active) {
            setPeople(initialPeople());
            setHasMongoSnapshot(false);
            setApiState('demo');
          }
          return;
        }
        const rows = result.rows.map(fromApi);
        if (active) {
          storageRemove('kinfolk-demo-people');
          setHasMongoSnapshot(true);
          setPeople(rows);
          setSelectedId((selectedId) => (rows.some((person) => person.id === selectedId) ? selectedId : ''));
          setApiState('connected');
          setRefreshFailed(false);
        }
      } catch {
        if (active) {
          setRefreshFailed(true);
          setApiState(initialCache.hasSnapshot ? 'offline' : 'error');
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
    if (refreshInFlight.current) return refreshInFlight.current;
    const request = (async () => {
      setIsRefreshing(true);
      setRefreshFailed(false);
      try {
        const rows = (await loadRemoteFamilyData()).map(fromApi);
        storageRemove('kinfolk-demo-people');
        storageSet(cacheKey, JSON.stringify({ people: rows, updatedAt: Date.now() }));
        setPeople(rows);
        setHasMongoSnapshot(true);
        setSelectedId((selectedId) => (rows.some((person) => person.id === selectedId) ? selectedId : ''));
        setApiState('connected');
        setRefreshFailed(false);
        notify(`Synced ${rows.length} ${rows.length === 1 ? 'person' : 'people'} from MongoDB`);
      } catch (error) {
        setRefreshFailed(true);
        setApiState(hasMongoSnapshot ? 'offline' : 'error');
        notify(error.message || (hasMongoSnapshot ? 'Could not refresh from MongoDB. Showing the last saved data.' : 'Could not load family data from MongoDB.'));
      } finally {
        setIsRefreshing(false);
      }
    })();
    refreshInFlight.current = request;
    try {
      return await request;
    } finally {
      if (refreshInFlight.current === request) refreshInFlight.current = null;
    }
  }
  refreshDataRef.current = refreshFromDatabase;
  function updateExportColumns(nextColumns) {
    const ordered = DATA_COLUMNS.filter((column) => nextColumns.includes(column));
    setExportColumns(ordered);
    storageSet('kinfolk-export-columns-v2', JSON.stringify(ordered));
  }
  async function exportCsv() {
    if (!exportColumns.length) {
      notify('Select at least one field to export');
      return;
    }
    try {
      const { exportCsvFile } = await import('./dataTransfer.js');
      exportCsvFile(people, exportColumns);
      setSettingsOpen(false);
      notify(`Exported ${people.length} people as CSV`);
    } catch {
      notify('Could not create the CSV file');
    }
  }
  async function exportExcel() {
    if (!exportColumns.length) {
      notify('Select at least one field to export');
      return;
    }
    try {
      const { exportExcelFile } = await import('./dataTransfer.js');
      await exportExcelFile(people, exportColumns);
      setSettingsOpen(false);
      notify(`Exported ${people.length} people as Excel`);
    } catch {
      notify('Could not create the Excel file');
    }
  }
  async function exportSvg() {
    try {
      const board = treeScroll.current?.querySelector('.tree-board');
      const { exportTreeSvg } = await import('./svgExport.js');
      const result = exportTreeSvg({ board, people: treePeople, treeName, theme, deceasedRibbon });
      setSettingsOpen(false);
      notify(`Exported the full tree as SVG · ${result.peopleCount} people`);
    } catch (error) {
      notify(error.message || 'Could not create the SVG image');
    }
  }
  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const { readImportFile } = await import('./dataTransfer.js');
      const importedPeople = await readImportFile(file);
      if (!importedPeople.length) throw Error('No people with a first name were found');
      setPendingImport({ filename: file.name, people: importedPeople });
      setSettingsOpen(false);
    } catch (error) {
      notify(error.message || 'Could not read this import file');
    }
  }
  async function confirmDataImport() {
    if (readOnly) return notify('This tree is read-only.');
    if (!pendingImport || isImporting) return;
    setIsImporting(true);
    try {
      if (apiState === 'connected') {
        const response = await apiFetch(apiUrl('/api/people/import'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ people: pendingImport.people }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw Error(result?.error || 'Could not import the family data');
        const rows = await refreshPeople();
        setPeople(rows);
      } else {
        const existingIds = new Set(people.map((person) => person.id));
        const idMap = new Map(pendingImport.people.map((person, index) => [person.sourceId, existingIds.has(person.sourceId) ? person.sourceId : `local-import-${Date.now()}-${index}`]));
        const imported = pendingImport.people.map((person, index) => {
          const remap = (id) => idMap.get(String(id)) || (existingIds.has(String(id)) ? String(id) : null);
          return {
            ...person,
            id: idMap.get(person.sourceId),
            _id: null,
            parentIds: person.parentIds.map(remap).filter(Boolean).slice(0, 2),
            partnerIds: person.partnerIds.map(remap).filter(Boolean),
            siblingIds: person.siblingIds.map(remap).filter(Boolean),
            partnerRelationships: person.partnerRelationships.map((link) => ({ ...link, partnerId: remap(link.partnerId) })).filter((link) => link.partnerId),
            relationshipLinks: person.relationshipLinks.map((link) => ({ ...link, personId: remap(link.personId) })).filter((link) => link.personId && link.label),
            treeX: Number.isFinite(person.treeX) ? person.treeX : null,
            treeY: Number.isFinite(person.treeY) ? person.treeY : null,
            color: ['sage', 'rose', 'blue', 'peach', 'lavender', 'yellow', 'mint', 'pink'][(people.length + index) % 8],
          };
        });
        const importedById = new Map(imported.map((person) => [person.id, person]));
        setPeople((current) => [...current.map((person) => importedById.get(person.id) || person), ...imported.filter((person) => !existingIds.has(person.id))]);
      }
      const count = pendingImport.people.length;
      setPendingImport(null);
      setSelectedId('');
      manualZoomTouched.current = false;
      autoFitSignature.current = '';
      notify(`Imported ${count} ${count === 1 ? 'person' : 'people'}`);
    } catch (error) {
      notify(error.message || 'Could not import the family data');
    } finally {
      setIsImporting(false);
    }
  }
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
    const r = await apiFetch(apiUrl('/api/people'));
    if (!r.ok) throw Error('Could not reload your family tree');
    return (await r.json()).map(fromApi);
  }
  async function saveMember(values) {
    if (readOnly) return notify('This tree is read-only.');
    const prior = modal.person;
    const { childIds = [], childRelationships = [], ...memberValues } = values;
    const childRoleById = new Map(childRelationships.map((link) => [link.personId, link.role]));
    const currentPositions = new Map([...layoutTree(people).positions, ...layout.positions]);
    const placement = relationshipPlacement(people, values, prior, currentPositions);
    const anchoredPeople = placement
      ? people.map((person) => {
          const position = currentPositions.get(person.id);
          return position ? { ...person, treeX: position.rawX, treeY: position.rawY } : person;
        })
      : people;
    const payload = {
      ...memberValues,
      ...placement,
      parentIds: (values.parentIds || []).filter((id) => people.some((p) => p.id === id && p._id)),
      partnerIds: (values.partnerIds || []).filter((id) => people.some((p) => p.id === id && p._id)),
      siblingIds: (values.siblingIds || []).filter((id) => people.some((p) => p.id === id && p._id)),
      partnerRelationships: (values.partnerRelationships || []).filter((link) => (values.partnerIds || []).includes(link.partnerId) && people.some((p) => p.id === link.partnerId && p._id)),
      relationshipLinks: (values.relationshipLinks || []).filter((link) => link.label.trim() && people.some((p) => p.id === link.personId && p._id)),
    };
    if (apiState === 'connected') {
      try {
        if (placement) {
          const positions = anchoredPeople
            .filter(
              (person) =>
                person._id &&
                person.id !== prior?.id &&
                (!Number.isFinite(people.find((item) => item.id === person.id)?.treeX) || !Number.isFinite(people.find((item) => item.id === person.id)?.treeY)),
            )
            .map((person) => ({ id: person._id, treeX: person.treeX, treeY: person.treeY }));
          if (positions.length) {
            const response = await apiFetch(apiUrl('/api/people/layout/positions'), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ positions }),
            });
            if (!response.ok) throw Error('Could not preserve the family positions');
          }
        }
        const r = await apiFetch(apiUrl(prior ? `/api/people/${prior._id}` : '/api/people'), {
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
          .filter((child) => {
            const role = childRoleById.get(child.id);
            const requestedGender = role === 'Son' ? 'male' : role === 'Daughter' ? 'female' : null;
            const linkChanged = currentChildren.some((person) => person.id === child.id) !== nextChildIds.has(child.id);
            return child._id && (linkChanged || (requestedGender && child.gender !== requestedGender));
          })
          .map(async (child) => {
            const parentIds = nextChildIds.has(child.id) ? [...new Set([...(child.parentIds || []), saved.id])] : (child.parentIds || []).filter((id) => id !== saved.id);
            const role = childRoleById.get(child.id);
            const requestedGender = role === 'Son' ? 'male' : role === 'Daughter' ? 'female' : null;
            const response = await apiFetch(apiUrl(`/api/people/${child._id}`), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ parentIds, ...(requestedGender ? { gender: requestedGender } : {}) }),
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
      ...placement,
      id,
      _id: null,
      color: prior?.color || ['sage', 'rose', 'blue', 'peach', 'lavender', 'yellow', 'mint', 'pink'][people.length % 8],
    };
    let rows = prior ? anchoredPeople.map((p) => (p.id === id ? newPerson : p)) : [...anchoredPeople, newPerson];
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
        const childRole = childRoleById.get(p.id);
        const requestedGender = childRole === 'Son' ? 'male' : childRole === 'Daughter' ? 'female' : null;
        updated = {
          ...updated,
          parentIds: nextChildren.has(p.id) ? [...new Set([...(updated.parentIds || []), id])] : (updated.parentIds || []).filter((parentId) => parentId !== id),
          ...(requestedGender ? { gender: requestedGender } : {}),
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
    if (readOnly) return notify('This tree is read-only.');
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
        const saved = await apiFetch(apiUrl('/api/people/layout/positions'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions }),
        });
        if (!saved.ok) throw Error('Could not preserve the current tree layout');
        const ids = removedPeople.filter((person) => person._id).map((person) => person._id);
        if (ids.length) {
          const response = await apiFetch(apiUrl('/api/people/batch'), {
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
      if (readOnly) return;
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
  useEffect(() => {
    const syncFullscreenState = () => {
      const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
      if (fullscreenElement) {
        setIsCanvasFullscreen(fullscreenElement === canvasRef.current);
        setFullscreenFallback(false);
      } else if (!fullscreenFallback) setIsCanvasFullscreen(false);
    };
    const closeFallbackOnEscape = (event) => {
      if (event.key === 'Escape' && fullscreenFallback) {
        setFullscreenFallback(false);
        setIsCanvasFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState);
    window.addEventListener('keydown', closeFallbackOnEscape);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
      window.removeEventListener('keydown', closeFallbackOnEscape);
    };
  }, [fullscreenFallback]);
  async function toggleCanvasFullscreen() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (fullscreenFallback) {
      setFullscreenFallback(false);
      setIsCanvasFullscreen(false);
      return;
    }
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    if (fullscreenElement) {
      const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
      if (exitFullscreen) await exitFullscreen.call(document);
      return;
    }
    const requestFullscreen = canvas.requestFullscreen || canvas.webkitRequestFullscreen;
    if (requestFullscreen) {
      try {
        await requestFullscreen.call(canvas);
        return;
      } catch {
        // Browsers may block the native API; the fixed canvas fallback still provides the mode.
      }
    }
    setFullscreenFallback(true);
    setIsCanvasFullscreen(true);
  }
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
    const rect = viewport.getBoundingClientRect();
    zoomAround(rect.left + viewport.clientWidth / 2, rect.top + viewport.clientHeight / 2, nextZoom);
  }
  function stepZoom(direction) {
    const currentZoom = pendingZoom.current?.nextZoom ?? zoomValue.current;
    zoomTo(stepCanvasZoom(currentZoom, direction, maxCanvasZoom));
  }
  function fitTreeToView() {
    manualZoomTouched.current = true;
    const viewport = treeScroll.current;
    if (!viewport) return;
    const fittedZoom = Math.min(1, maxCanvasZoom);
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
  async function arrangeFamily() {
    if (readOnly) return notify('This tree is read-only.');
    if (!treePeople.length || isArranging) return;
    setIsArranging(true);
    try {
      const arrangedPositions =
        treeVisualStyle === 'dashboard' || treeVisualStyle === 'atlas'
          ? compactDashboardPositions(treePeople)
          : (() => {
              const automaticLayout = layoutTree(treePeople.map((person) => ({ ...person, treeX: null, treeY: null })));
              return treePeople.map((person) => {
                const position = automaticLayout.positions.get(person.id);
                return { id: person.id, treeX: position.rawX, treeY: position.rawY };
              });
            })();
      if (apiState === 'connected') {
        const databasePositions = arrangedPositions.map((position) => ({ ...position, id: people.find((person) => person.id === position.id)?._id })).filter((position) => position.id);
        const response = await apiFetch(apiUrl('/api/people/layout/positions'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions: databasePositions }),
        });
        if (!response.ok) throw Error('Could not save the arranged family');
      }
      const positionById = new Map(arrangedPositions.map((position) => [position.id, position]));
      setPeople((current) =>
        current.map((person) => {
          const position = positionById.get(person.id);
          return position ? { ...person, treeX: position.treeX, treeY: position.treeY } : person;
        }),
      );
      setPhoneLayoutPreview({});
      setSelectedNodeIds([]);
      setConfirmArrange(false);
      manualZoomTouched.current = false;
      autoFitSignature.current = '';
      notify(apiState === 'connected' ? 'Family arranged and saved' : 'Family arranged for this browser');
    } catch (error) {
      notify(error.message || 'Could not arrange the family');
    } finally {
      setIsArranging(false);
    }
  }
  async function saveNamedLayout(event) {
    if (readOnly) { event?.preventDefault(); return notify('This tree is read-only.'); }
    event.preventDefault();
    const name = layoutName.trim();
    if (!name || !treePeople.length || isSavingLayout) return;
    setIsSavingLayout(true);
    try {
      const positions = treePeople
        .map((person) => {
          const position = layout.positions.get(person.id);
          if (!position) return null;
          return { personId: apiState === 'connected' ? person._id : person.id, treeX: position.rawX, treeY: position.rawY };
        })
        .filter((position) => position?.personId);
      let saved;
      if (apiState === 'connected') {
        const response = await apiFetch(apiUrl('/api/layouts'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, familyId: layoutScopeId, familyName: selectedFamily?.name || 'All families', positions }),
        });
        if (!response.ok) throw Error((await response.json().catch(() => null))?.error || 'Could not save this tree view');
        saved = await response.json();
      } else {
        const allLayouts = (() => {
          try {
            const parsed = JSON.parse(storageGet('kinfolk-saved-layouts-v1') || '[]');
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })();
        const normalizedName = name.toLocaleLowerCase();
        const currentPersonIds = new Set(positions.map((position) => String(position.personId)));
        const existing = allLayouts.find(
          (item) => item.normalizedName === normalizedName && (item.familyId === layoutScopeId || (item.positions || []).some((position) => currentPersonIds.has(String(position.personId)))),
        );
        saved = {
          _id: existing?._id || `local-${Date.now()}`,
          name,
          normalizedName,
          familyId: layoutScopeId,
          positions,
          updatedAt: new Date().toISOString(),
        };
        const next = [saved, ...allLayouts.filter((item) => item._id !== saved._id)];
        storageSet('kinfolk-saved-layouts-v1', JSON.stringify(next));
      }
      setSavedLayouts((current) => [saved, ...current.filter((item) => item._id !== saved._id && item.normalizedName !== saved.normalizedName)]);
      setLayoutName('');
      notify(`Saved “${name}”`);
    } catch (error) {
      notify(error.message || 'Could not save this tree view');
    } finally {
      setIsSavingLayout(false);
    }
  }
  async function applyNamedLayout(savedLayout) {
    if (readOnly) return notify('This tree is read-only.');
    if (applyingLayoutId) return;
    setApplyingLayoutId(savedLayout._id);
    try {
      const positions = (savedLayout.positions || [])
        .map((position) => ({
          id: String(position.personId),
          treeX: Number(position.treeX),
          treeY: Number(position.treeY),
        }))
        .filter((position) => Number.isFinite(position.treeX) && Number.isFinite(position.treeY));
      const currentIds = new Set(people.map((person) => String(person._id || person.id)));
      const availablePositions = positions.filter((position) => currentIds.has(position.id));
      if (!availablePositions.length) throw Error('No matching people remain in this saved view');
      if (apiState === 'connected') {
        const response = await apiFetch(apiUrl('/api/people/layout/positions'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions: availablePositions }),
        });
        if (!response.ok) throw Error('Could not restore this tree view');
      }
      const byPersonId = new Map(availablePositions.map((position) => [position.id, position]));
      setPeople((current) =>
        current.map((person) => {
          const position = byPersonId.get(String(person._id || person.id));
          return position ? { ...person, treeX: position.treeX, treeY: position.treeY } : person;
        }),
      );
      setPhoneLayoutPreview({});
      setSelectedNodeIds([]);
      setSavedLayoutsOpen(false);
      manualZoomTouched.current = false;
      autoFitSignature.current = '';
      notify(`Restored “${savedLayout.name}”`);
    } catch (error) {
      notify(error.message || 'Could not restore this tree view');
    } finally {
      setApplyingLayoutId('');
    }
  }
  async function removeNamedLayout(savedLayout) {
    if (readOnly) return notify('This tree is read-only.');
    if (deletingLayoutId) return;
    setDeletingLayoutId(savedLayout._id);
    try {
      if (apiState === 'connected') {
        const response = await apiFetch(apiUrl(`/api/layouts/${savedLayout._id}`), { method: 'DELETE' });
        if (!response.ok) throw Error((await response.json().catch(() => null))?.error || 'Could not remove this saved view');
      } else {
        let allLayouts = [];
        try {
          const parsed = JSON.parse(storageGet('kinfolk-saved-layouts-v1') || '[]');
          if (Array.isArray(parsed)) allLayouts = parsed;
        } catch {
          // Replace unreadable local layout data with the remaining valid views.
        }
        storageSet('kinfolk-saved-layouts-v1', JSON.stringify(allLayouts.filter((item) => item._id !== savedLayout._id)));
      }
      setSavedLayouts((current) => current.filter((item) => item._id !== savedLayout._id));
      setConfirmLayoutDeleteId('');
      notify(`Removed “${savedLayout.name}”`);
    } catch (error) {
      notify(error.message || 'Could not remove this saved view');
    } finally {
      setDeletingLayoutId('');
    }
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
    if (readOnly) return notify('This tree is read-only.');
    setModal({ inline: true });
    setDetailsOpen(true);
    if (window.innerWidth <= 1050) {
      setSidebarOpen(false);
      setMobileDetailsOpen(true);
    }
  }
  function openQuickAdd(person, kind) {
    if (readOnly) return notify('This tree is read-only.');
    const childRole = person.gender === 'male' ? 'Son' : person.gender === 'female' ? 'Daughter' : 'Child';
    const parentRole = person.gender === 'male' ? 'Father' : person.gender === 'female' ? 'Mother' : 'Parent';
    const partnerRole = person.gender === 'male' ? 'Husband' : person.gender === 'female' ? 'Wife' : 'Partner';
    const presets = {
      father: { gender: 'male', lastName: person.lastName || '', role: childRole },
      mother: { gender: 'female', lastName: person.lastName || '', role: childRole },
      brother: { gender: 'male', lastName: person.lastName || '', role: 'Sibling' },
      sister: { gender: 'female', lastName: person.lastName || '', role: 'Sibling' },
      son: { gender: 'male', lastName: person.lastName || '', role: parentRole },
      daughter: { gender: 'female', lastName: person.lastName || '', role: parentRole },
      partner: {
        gender: person.gender === 'male' ? 'female' : person.gender === 'female' ? 'male' : 'unspecified',
        lastName: '',
        role: partnerRole,
      },
    };
    const preset = presets[kind];
    const initialRelationships = [];
    const addInitialRelationship = (personId, role) => {
      if (!personId || initialRelationships.some((link) => link.personId === personId)) return;
      initialRelationships.push({ personId, role, customLabel: '' });
    };
    addInitialRelationship(person.id, preset.role);
    if (kind === 'son' || kind === 'daughter') {
      const otherParent = (person.partnerIds || []).map((id) => people.find((candidate) => candidate.id === id)).find(Boolean);
      if (otherParent) {
        addInitialRelationship(otherParent.id, otherParent.gender === 'male' ? 'Father' : otherParent.gender === 'female' ? 'Mother' : 'Parent');
      }
      const parentIds = new Set([person.id, otherParent?.id].filter(Boolean));
      people
        .filter((candidate) => candidate.id !== person.id && (candidate.parentIds || []).some((parentId) => parentIds.has(parentId)))
        .forEach((sibling) => addInitialRelationship(sibling.id, sibling.gender === 'male' ? 'Brother' : sibling.gender === 'female' ? 'Sister' : 'Sibling'));
    }
    if (kind === 'brother' || kind === 'sister') {
      (person.parentIds || [])
        .map((id) => people.find((candidate) => candidate.id === id))
        .filter(Boolean)
        .forEach((parent) => addInitialRelationship(parent.id, parent.gender === 'male' ? 'Father' : parent.gender === 'female' ? 'Mother' : 'Parent'));
      const sharedParentIds = new Set(person.parentIds || []);
      people
        .filter((candidate) => candidate.id !== person.id && ((person.siblingIds || []).includes(candidate.id) || (candidate.parentIds || []).some((parentId) => sharedParentIds.has(parentId))))
        .forEach((sibling) => addInitialRelationship(sibling.id, sibling.gender === 'male' ? 'Brother' : sibling.gender === 'female' ? 'Sister' : 'Sibling'));
    }
    setQuickAddForId('');
    setSelectedId(person.id);
    setSelectedNodeIds([]);
    setModal({
      inline: true,
      defaults: { gender: preset.gender, lastName: preset.lastName },
      initialRelationships,
    });
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
    if (readOnly) return;
    openPersonDetails(person.id);
    setModal({ person, inline: true });
  }
  function openLinkEditor() {
    if (readOnly) return;
    if (selected) setModal({ person: selected, inline: true, focusLinks: true });
  }
  function clearSelection() {
    setSelectedId('');
    setSelectedNodeIds([]);
    setHighlightedNodeId('');
    setDetailsOpen(false);
    setMobileDetailsOpen(false);
  }
  async function flushPositionSaves({ silent = false, keepalive = false } = {}) {
    if (readOnly) return;
    if (positionSaveTimer.current) {
      clearTimeout(positionSaveTimer.current);
      positionSaveTimer.current = 0;
    }
    const positions = [...pendingPositionSaves.current.values()];
    if (!positions.length) return;
    pendingPositionSaves.current.clear();
    const message = positionSaveMessage.current;
    try {
      const response = await apiFetch(apiUrl('/api/people/layout/positions'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tree-Id': authUser.treeId },
        body: JSON.stringify({ positions }),
        keepalive,
      });
      if (!response.ok) throw Error();
      if (!silent) notify(message.success);
    } catch {
      positions.forEach((position) => {
        if (!pendingPositionSaves.current.has(position.id)) pendingPositionSaves.current.set(position.id, position);
      });
      if (!silent) notify(message.failure);
    }
  }
  function queuePositionSave(positions, message) {
    positions.forEach((position) => pendingPositionSaves.current.set(position.id, position));
    positionSaveMessage.current = message;
    if (positionSaveTimer.current) clearTimeout(positionSaveTimer.current);
    positionSaveTimer.current = window.setTimeout(() => flushPositionSaves(), 650);
  }
  function startDrag(e, p, pos) {
    if (e.button !== 0) return;
    if (e.target.closest('.tree-node-info,.tree-node-edit,.tree-node-delete,.tree-node-about,.tree-node-about-tooltip,.tree-node-quick-add')) return;
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
        ? treePeople
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
        ? d.familyPositions.map((position) => {
            const current = layoutRef.current.positions.get(position.id);
            return { id: position.id, x: position.x + (d.lastX - d.x), y: position.y + (d.lastY - d.y), w: current?.w || 196, h: current?.h || 76 };
          })
        : [{ id: d.id, x: d.lastX, y: d.lastY, w: layoutRef.current.positions.get(d.id)?.w || 196, h: layoutRef.current.positions.get(d.id)?.h || 76 }];
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
        queuePositionSave(databasePositions, {
          success: d.familyPositions ? 'Selected positions saved' : 'Position saved',
          failure: d.familyPositions ? 'Moved for this session; positions could not be saved' : 'Moved for this session; the position could not be saved',
        });
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
      if (pendingPositionSaves.current.size) flushPositionSaves({ silent: true, keepalive: true });
    };
  }, []);
  const treeName = selectedFamilyId === '__all__' ? 'All families' : selectedFamily?.name || 'Your family';
  return (
    <div
      className={`family-app theme-${theme} tree-style-${treeVisualStyle} link-style-smooth deceased-ribbon-${deceasedRibbon} ${activeLinkNodeId ? 'has-link-focus' : ''} ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${detailsOpen ? 'details-open' : 'details-closed'} ${modal?.inline ? 'editing-person' : ''}`}
      style={{ '--details-width': `${detailsWidth}px` }}
    >
      {sidebarOpen && (
        <FamilySidebar
          treeName={treeName}
          apiState={apiState}
          hasMongoSnapshot={hasMongoSnapshot}
          peopleCount={people.length}
          familyPeopleCount={familyPeople.length}
          families={families}
          selectedFamilyId={selectedFamilyId}
          selectedFamily={selectedFamily}
          familyPickerOpen={familyPickerOpen}
          familyQuery={familyQuery}
          onFamilyPickerOpenChange={setFamilyPickerOpen}
          onFamilyQueryChange={setFamilyQuery}
          onSelectFamily={(familyId) => {
            setSelectedFamilyId(familyId);
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
          memberFamilyFilter={memberFamilyFilter}
          memberFamilyOptions={memberFamilyOptions}
          onMemberFamilyFilterChange={setMemberFamilyFilter}
          query={query}
          onQueryChange={setQuery}
          memberListRef={memberList}
          sidebarMemberGroups={sidebarMemberGroups}
          selectedId={selectedId}
          selectedNodeIds={selectedNodeIds}
          onSelectMember={(personId, target) => {
            target.focus();
            selectPerson(personId);
            setDetailsOpen(true);
            if (window.innerWidth < 800) {
              setSidebarOpen(false);
              setMobileDetailsOpen(true);
            }
            focusPersonInTree(personId);
          }}
          filteredCount={filtered.length}
          refreshFailed={refreshFailed}
          isRefreshing={isRefreshing}
          theme={theme}
          onThemeChange={setTheme}
          onClose={() => setSidebarOpen(false)}
        />
      )}
      <main className="simple-main">
        <AppHeader
          sidebarOpen={sidebarOpen}
          onSidebarOpenChange={(open) => {
            setSidebarOpen(open);
            if (open && window.innerWidth <= 1050) setMobileDetailsOpen(false);
          }}
          treeName={treeName}
          memberFamilyFilter={memberFamilyFilter}
          memberFamilyOptions={memberFamilyOptions}
          onMemberFamilyFilterChange={setMemberFamilyFilter}
          query={query}
          onQueryChange={(value) => {
            setQuery(value);
            if (value) {
              setSidebarOpen(true);
              if (window.innerWidth <= 1050) setMobileDetailsOpen(false);
            }
          }}
          onSearchFocus={() => {
            setSidebarOpen(true);
            if (window.innerWidth <= 1050) setMobileDetailsOpen(false);
          }}
          theme={theme}
          onThemeChange={setTheme}
          isRefreshing={isRefreshing}
          onRefresh={refreshFromDatabase}
          detailsVisible={window.innerWidth <= 1050 ? mobileDetailsOpen : detailsOpen}
          authUser={authUser}
          onLogout={onLogout}
          onToggleDetails={() => {
            if (window.innerWidth <= 1050) {
              setSidebarOpen(false);
              setDetailsOpen(true);
              setMobileDetailsOpen(!mobileDetailsOpen);
            } else setDetailsOpen(!detailsOpen);
          }}
          onAddPerson={() => openAddPersonForm()}
        />
        <TreeToolbar
          visualStyle={treeVisualStyle}
          onVisualStyleChange={setTreeVisualStyle}
          familyColorsEnabled={familyColorsEnabled}
          onToggleFamilyColors={() => setFamilyColorsEnabled((enabled) => !enabled)}
          loading={apiState === 'checking' && (!hasMongoSnapshot || !people.length)}
          peopleCount={treePeople.length}
          generationCount={layout.generationCount}
          onOpenSavedViews={() => setSavedLayoutsOpen(true)}
          onArrange={() => setConfirmArrange(true)}
          arranging={isArranging}
          movementLocked={movementLocked}
          onToggleMovement={() => setMovementLocked((locked) => !locked)}
          zoom={zoom}
          onZoomOut={() => stepZoom(-1)}
          onZoomIn={() => stepZoom(1)}
          onFit={fitTreeToView}
        />
        <section ref={canvasRef} className={`simple-canvas ${fullscreenFallback ? 'is-fullscreen-fallback' : ''}`}>
          <CanvasHelp open={helpOpen} controlRef={canvasHelpRef} onToggle={() => setHelpOpen((open) => !open)} />
          <SelectionToolbar count={selectedNodeIds.length} onRemove={() => setConfirmDelete(true)} onClear={clearSelection} />
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
                      onHighlight={setHighlightedLink}
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
                            onPointerEnter={() => setHighlightedLink({ key: linkId, ids: [edge.fromId, edge.toId] })}
                            onPointerLeave={() => setHighlightedLink(null)}
                            onFocus={() => setHighlightedLink({ key: linkId, ids: [edge.fromId, edge.toId] })}
                            onBlur={() => setHighlightedLink(null)}
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
                {treePeople.map((person) => {
                  const pos = layout.positions.get(person.id);
                  const isDetailsVisible = detailsOpen && selectedId === person.id;
                  return (
                    <TreePersonNode
                      key={person.id}
                      person={person}
                      position={pos}
                      detailsVisible={isDetailsVisible}
                      linkHighlighted={highlightedLink?.ids?.includes(person.id)}
                      networkHighlighted={highlightedNetworkIds.has(person.id)}
                      selected={selectedId === person.id || selectedNodeIds.includes(person.id)}
                      familyColorIndex={familyColorsEnabled && familyColors.has(person.id) ? familyColors.get(person.id) : null}
                      quickAddOpen={quickAddForId === person.id}
                      aboutOpen={aboutTooltipId === person.id}
                      aboutDismissed={dismissedAboutTooltipId === person.id}
                      onHoverStart={() => setHighlightedNodeId(person.id)}
                      onHoverEnd={() => setHighlightedNodeId((current) => (current === person.id ? '' : current))}
                      onTouchDragStart={(event) => startDrag(event, person, pos)}
                      onTouchPointerUp={() => {
                        if (drag.current?.id === person.id && !drag.current.moved) {
                          setHighlightedNodeId((current) => (current === person.id ? '' : person.id));
                        }
                      }}
                      onMouseDragStart={(event) => startDrag(event, person, pos)}
                      onOpenFromKeyboard={() => openPersonDetails(person.id)}
                      onToggleQuickAdd={() => setQuickAddForId((current) => (current === person.id ? '' : person.id))}
                      onQuickAdd={(kind) => openQuickAdd(person, kind)}
                      onEdit={() => openPersonEditor(person)}
                      onToggleDetails={() => {
                        if (isDetailsVisible) {
                          setDetailsOpen(false);
                          setMobileDetailsOpen(false);
                        } else openPersonDetails(person.id);
                      }}
                      onRestoreAboutHover={() => setDismissedAboutTooltipId('')}
                      onToggleAbout={() => {
                        if (aboutTooltipId === person.id) {
                          setDismissedAboutTooltipId(person.id);
                          setAboutTooltipId('');
                        } else {
                          setDismissedAboutTooltipId('');
                          setAboutTooltipId(person.id);
                        }
                      }}
                      onDelete={() => {
                        setSelectedId(person.id);
                        setSelectedNodeIds([]);
                        setConfirmDelete(true);
                      }}
                    />
                  );
                })}
              </div>
            </div>
            {marqueeRect && <div className="marquee-selection" style={{ left: marqueeRect.left, top: marqueeRect.top, width: marqueeRect.width, height: marqueeRect.height }} aria-hidden="true" />}
          </div>
          <TreeStatus
            apiState={apiState}
            hasSnapshot={hasMongoSnapshot}
            peopleCount={people.length}
            treePeopleCount={treePeople.length}
            refreshing={isRefreshing}
            onRefresh={refreshFromDatabase}
            onAdd={() => openAddPersonForm()}
          />
          <div className="canvas-zoom-controls">
            <button
              type="button"
              onClick={toggleCanvasFullscreen}
              aria-label={isCanvasFullscreen ? 'Exit full screen' : 'Enter full screen'}
              title={isCanvasFullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {isCanvasFullscreen ? <Minimize2 size={16} /> : <Fullscreen size={17} />}
            </button>
          </div>
          <TreeSettingsControls
            settingsOpen={settingsOpen}
            settingsControlRef={settingsControlRef}
            onSettingsOpenChange={setSettingsOpen}
            visibleLinkTypes={visibleLinkTypes}
            onVisibleLinkTypesChange={setVisibleLinkTypes}
            deceasedRibbon={deceasedRibbon}
            onDeceasedRibbonChange={setDeceasedRibbon}
            exportFieldsOpen={exportFieldsOpen}
            onExportFieldsOpenChange={setExportFieldsOpen}
            exportColumns={exportColumns}
            onExportColumnsChange={updateExportColumns}
            onExportCsv={exportCsv}
            onExportExcel={exportExcel}
            onExportSvg={exportSvg}
            importFileRef={importFileRef}
            onImportFile={handleImportFile}
            treeStyleMenuOpen={treeStyleMenuOpen}
            treeStyleControlRef={treeStyleControlRef}
            onTreeStyleMenuOpenChange={setTreeStyleMenuOpen}
            treeVisualStyle={treeVisualStyle}
            onTreeVisualStyleChange={setTreeVisualStyle}
          />
        </section>
      </main>
      <PersonDetailsPanel
        open={detailsOpen}
        mobileOpen={mobileDetailsOpen}
        editingModal={modal}
        selected={selected}
        people={people}
        detailsWidth={detailsWidth}
        onResizeKeyDown={handleDetailsResizeKey}
        onResizePointerDown={beginDetailsResize}
        onResizePointerMove={moveDetailsResize}
        onResizePointerUp={endDetailsResize}
        onClearSelection={clearSelection}
        onCloseEditor={() => {
          setModal(null);
          if (!selected) {
            setDetailsOpen(false);
            setMobileDetailsOpen(false);
          }
        }}
        onSavePerson={saveMember}
        onEditPerson={() => { if (!readOnly) setModal({ person: selected, inline: true }); }}
        familyLinkGroups={familyLinkGroups}
        getPersonById={byId}
        onEditLinks={openLinkEditor}
        onOpenLinkedPerson={(personId) => {
          openPersonDetails(personId);
          focusPersonInTree(personId);
        }}
        onClosePanel={() => {
          setModal(null);
          setDetailsOpen(false);
          setMobileDetailsOpen(false);
        }}
        onRequestDelete={() => setConfirmDelete(true)}
      />
      <PersonModalDialog modal={modal} people={people} onClose={() => setModal(null)} onSave={saveMember} />
      <AppDialogs
        pendingImport={pendingImport}
        isImporting={isImporting}
        onCancelImport={() => setPendingImport(null)}
        onConfirmImport={confirmDataImport}
        confirmDelete={confirmDelete}
        selected={selected}
        selectedNodeIds={selectedNodeIds}
        deleteDescendants={deleteDescendants}
        selectedDescendants={selectedDescendants}
        onDeleteDescendantsChange={setDeleteDescendants}
        onCancelDelete={() => setConfirmDelete(false)}
        onRemovePerson={removePerson}
        confirmArrange={confirmArrange}
        isArranging={isArranging}
        onCancelArrange={() => setConfirmArrange(false)}
        onArrange={arrangeFamily}
        savedLayoutsOpen={savedLayoutsOpen}
        onSavedLayoutsOpenChange={setSavedLayoutsOpen}
        isSavingLayout={isSavingLayout}
        applyingLayoutId={applyingLayoutId}
        layoutName={layoutName}
        onLayoutNameChange={setLayoutName}
        onSaveLayout={saveNamedLayout}
        savedLayouts={savedLayouts}
        confirmLayoutDeleteId={confirmLayoutDeleteId}
        onConfirmLayoutDeleteIdChange={setConfirmLayoutDeleteId}
        deletingLayoutId={deletingLayoutId}
        onRemoveLayout={removeNamedLayout}
        onApplyLayout={applyNamedLayout}
      />
      {toast && <div className="simple-toast">{toast}</div>}
    </div>
  );
}
