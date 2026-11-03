import useDetailsPanelResize from './useDetailsPanelResize.js';
import createPersonNavigation from './createPersonNavigation.js';
import createPersonActions from './createPersonActions.js';
import useTreeCanvasLayout from './useTreeCanvasLayout.js';
import createCanvasNavigation from './createCanvasNavigation.js';
import createDataTransferActions from './createDataTransferActions.js';
import createSavedViewActions from './createSavedViewActions.js';
import useTreeHighlights from './useTreeHighlights.js';
import useFamilyLinkGroups from './useFamilyLinkGroups.js';
import useFamilyMemberSearch from './useFamilyMemberSearch.js';
import useCanvasFullscreen from './useCanvasFullscreen.js';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Minimize2,
  Fullscreen,
} from 'lucide-react';
import { initialPeople } from './demoFamily.js';
import { layoutTree, resolveNodeOverlaps } from './layoutTree.js';
import { CanvasHelp, SelectionToolbar, TreeStatus } from './CanvasSupport.jsx';
import TreeToolbar from './TreeToolbar.jsx';
import TreeSettingsControls, { DATA_COLUMNS } from './TreeSettingsControls.jsx';
import { AppHeader, FamilySidebar } from './AppNavigation.jsx';
import AppDialogs from './AppDialogs.jsx';
import PersonDetailsPanel, { PersonModalDialog } from './PersonDetailsPanel.jsx';
import TreeNodeLayer from './TreeNodeLayer.jsx';
import { apiFetch as sharedApiFetch, apiUrl, loadInitialFamilyData, loadRemoteFamilyData } from './apiClient.js';
import TreeConnections from './TreeConnections.jsx';
import {
  applyDragPositions,
  compactDashboardPositions,
  descendantIds,
  fromApi,
  fullName,
  getFamilyGroups,
  mongoPeopleCacheKey,
  readMongoPeopleCache,
  storageGet,
  storageRemove,
  storageSet,
  year,
} from './appHelpers.js';

export default function App({ authUser, onLogout, workspaceActions }) {
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
  const [theme, setTheme] = useState(() => storageGet('kinfolk-theme') === 'light' ? 'light' : 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const canvasHelpRef = useRef(null);
  const canvasRef = useRef(null);
  const { isCanvasFullscreen, fullscreenFallback, toggleCanvasFullscreen } = useCanvasFullscreen(canvasRef);
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
  const { detailsWidth, beginDetailsResize, moveDetailsResize, endDetailsResize, handleDetailsResizeKey } = useDetailsPanelResize();
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
  const treeName = selectedFamilyId === '__all__' ? 'All families' : selectedFamily?.name || 'Your family';
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
  const { activeLinkNodeId, highlightedAncestorIds, highlightedNetworkIds, familyColors } = useTreeHighlights(treePeople, highlightedNodeId, selectedId);
  const selected = people.find((p) => p.id === selectedId) || null;
  const byId = (id) => people.find((p) => p.id === id);
  const { familyLinkGroups } = useFamilyLinkGroups(people, selected);
  const {
    layoutPeople,
    cardWidth,
    cardHeight,
    layout,
    layoutRef,
    layoutPositions,
    minNodeX,
    minNodeY,
    maxNodeX,
    maxNodeY,
    treeBoardOffsetX,
    treeBoardOffsetY,
    treePaddingX,
    treePaddingY,
    maxCanvasZoom,
    treeBoardWidth,
    treeBoardHeight,
    treeContentWidth,
    treeBoardLeft,
    treeBoardTop,
    treeExtraWidth,
    appliedTreeOffset,
    connectorNodePositions,
    connectorLabelPositions,
  } = useTreeCanvasLayout({ treePeople, isCompactViewport, phoneLayoutPreview, treeViewportWidth, treeViewportHeight, zoom });
  const { focusPersonInTree, zoomAround, zoomTo, stepZoom, fitTreeToView } = createCanvasNavigation({
    treeScroll,
    manualZoomTouched,
    pendingZoom,
    zoomFrame,
    zoomValue,
    pendingZoomAnchor,
    setZoom,
    maxCanvasZoom,
    layoutPositions,
    minNodeX,
    maxNodeX,
    minNodeY,
    maxNodeY,
  });
  const { memberFamilyOptions, filtered, sidebarMemberGroups } = useFamilyMemberSearch(familyPeople, query, memberFamilyFilter);
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
  const { saveMember, removePerson } = createPersonActions({
    readOnly,
    notify,
    modal,
    people,
    layout,
    apiState,
    apiFetch,
    refreshPeople,
    setPeople,
    setSelectedId,
    setModal,
    setDetailsOpen,
    setMobileDetailsOpen,
    selected,
    selectedNodeIds,
    deleteDescendants,
    selectedDescendants,
    setSelectedNodeIds,
    setConfirmDelete,
  });
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
    storageRemove('kinfolk-phone-tree-layout-v1');
  }, []);
  useEffect(() => {
    storageSet(isCompactViewport ? 'kinfolk-phone-zoom-v1' : 'kinfolk-site-zoom-v1', String(zoom));
  }, [isCompactViewport, zoom]);
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
  const { updateExportColumns, exportCsv, exportExcel, exportSvg, handleImportFile, confirmDataImport } = createDataTransferActions({
    setExportColumns,
    exportColumns,
    notify,
    people,
    setSettingsOpen,
    treeScroll,
    treePeople,
    treeName,
    theme,
    deceasedRibbon,
    setPendingImport,
    readOnly,
    pendingImport,
    isImporting,
    setIsImporting,
    apiState,
    apiFetch,
    refreshPeople,
    setPeople,
    setSelectedId,
    manualZoomTouched,
    autoFitSignature,
  });
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
  const { saveNamedLayout, applyNamedLayout, removeNamedLayout } = createSavedViewActions({
    readOnly,
    notify,
    layoutName,
    treePeople,
    isSavingLayout,
    setIsSavingLayout,
    layout,
    apiState,
    apiFetch,
    layoutScopeId,
    selectedFamily,
    setSavedLayouts,
    setLayoutName,
    applyingLayoutId,
    setApplyingLayoutId,
    people,
    setPeople,
    setPhoneLayoutPreview,
    setSelectedNodeIds,
    setSavedLayoutsOpen,
    manualZoomTouched,
    autoFitSignature,
    deletingLayoutId,
    setDeletingLayoutId,
    setConfirmLayoutDeleteId,
  });
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
  const { selectPerson, openAddPersonForm, openQuickAdd, openPersonDetails, openPersonEditor, openLinkEditor, clearSelection } = createPersonNavigation({
    setSelectedId,
    setSelectedNodeIds,
    readOnly,
    notify,
    setModal,
    setDetailsOpen,
    setSidebarOpen,
    setMobileDetailsOpen,
    people,
    setQuickAddForId,
    selected,
    setHighlightedNodeId,
  });
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
          workspaceActions={workspaceActions}
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
                <TreeConnections
                  layout={layout}
                  treePeople={treePeople}
                  visibleLinkTypes={visibleLinkTypes}
                  highlightedLink={highlightedLink}
                  activeLinkNodeId={activeLinkNodeId}
                  highlightedAncestorIds={highlightedAncestorIds}
                  onHighlight={setHighlightedLink}
                  byId={byId}
                  connectorNodePositions={connectorNodePositions}
                  connectorLabelPositions={connectorLabelPositions}
                  treeBoardWidth={treeBoardWidth}
                  treeBoardHeight={treeBoardHeight}
                />
                <TreeNodeLayer
                  treePeople={treePeople}
                  layout={layout}
                  detailsOpen={detailsOpen}
                  selectedId={selectedId}
                  selectedNodeIds={selectedNodeIds}
                  highlightedLink={highlightedLink}
                  highlightedNetworkIds={highlightedNetworkIds}
                  familyColorsEnabled={familyColorsEnabled}
                  familyColors={familyColors}
                  quickAddForId={quickAddForId}
                  aboutTooltipId={aboutTooltipId}
                  dismissedAboutTooltipId={dismissedAboutTooltipId}
                  setHighlightedNodeId={setHighlightedNodeId}
                  startDrag={startDrag}
                  drag={drag}
                  openPersonDetails={openPersonDetails}
                  setQuickAddForId={setQuickAddForId}
                  openQuickAdd={openQuickAdd}
                  openPersonEditor={openPersonEditor}
                  setDetailsOpen={setDetailsOpen}
                  setMobileDetailsOpen={setMobileDetailsOpen}
                  setDismissedAboutTooltipId={setDismissedAboutTooltipId}
                  setAboutTooltipId={setAboutTooltipId}
                  setSelectedId={setSelectedId}
                  setSelectedNodeIds={setSelectedNodeIds}
                  setConfirmDelete={setConfirmDelete}
                />
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
