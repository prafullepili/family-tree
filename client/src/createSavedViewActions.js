import { storageGet, storageSet } from './appHelpers.js';
import { apiUrl } from './apiClient.js';

export default function createSavedViewActions({
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
}) {
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
  return { saveNamedLayout, applyNamedLayout, removeNamedLayout };
}

