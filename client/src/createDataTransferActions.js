import { allowTreeEdit } from './treeEditLock.js';
import { DATA_COLUMNS } from './dataColumns.js';
import { storageSet } from './appHelpers.js';
import { apiUrl } from './apiClient.js';
import { prepareBranchImport } from './branchImport.js';

export default function createDataTransferActions({
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
}) {
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
    if (!file || !allowTreeEdit(readOnly, notify)) return;
    try {
      const { readImportFile } = await import('./dataTransfer.js');
      const importedPeople = await readImportFile(file);
      if (!allowTreeEdit(readOnly, notify)) return;
      if (!importedPeople.length) throw Error('No people with a first name were found');
      setPendingImport({ id: Date.now(), filename: file.name, people: importedPeople });
      setSettingsOpen(false);
    } catch (error) {
      notify(error.message || 'Could not read this import file');
    }
  }

  async function confirmDataImport() {
    if (!allowTreeEdit(readOnly, notify)) return;
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
  async function confirmBranchImport(sourceAnchorId, targetId) {
    if (!allowTreeEdit(readOnly, notify)) return;
    if (!pendingImport || isImporting) return;
    const target = people.find((person) => String(person.id) === String(targetId));
    if (!target) return notify('Choose a person already in this tree to connect the branch to.');
    if (apiState === 'connected' && !target._id) return notify('Save the selected person to this tree before connecting a branch.');
    setIsImporting(true);
    let importedApiIds = [];
    try {
      const { people: branchPeople, sourceToImportId, anchorRelationships } = prepareBranchImport(pendingImport.people, sourceAnchorId, targetId, Date.now());
      let rows;
      if (apiState === 'connected') {
        let result = null;
        if (branchPeople.length) {
          const response = await apiFetch(apiUrl('/api/people/import'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ people: branchPeople }),
          });
          result = await response.json().catch(() => null);
          if (!response.ok) throw Error(result?.error || 'Could not import the family branch');
          importedApiIds = Object.values(result?.sourceIds || {});
        }
        const resolveId = (id) => {
          const importId = sourceToImportId[String(id)];
          if (!importId) return null;
          return importId === target.id ? target._id : result?.sourceIds?.[importId] || null;
        };
        const mergeIds = (current, incoming) => [...new Set([...(current || []), ...incoming.map(resolveId).filter(Boolean)])];
        const mergeLinks = (current, incoming, key) => {
          const links = [...(current || [])];
          incoming.map((link) => ({ ...link, [key]: resolveId(link[key]) })).filter((link) => link[key]).forEach((link) => {
            if (!links.some((item) => String(item[key]) === String(link[key]) && (key !== 'personId' || item.label === link.label))) links.push(link);
          });
          return links;
        };
        const updatedTarget = await apiFetch(apiUrl(`/api/people/${target._id}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentIds: [...new Set([...(target.parentIds || []), ...anchorRelationships.parentIds.map(resolveId).filter(Boolean)])].slice(0, 2),
            partnerIds: mergeIds(target.partnerIds, anchorRelationships.partnerIds),
            siblingIds: mergeIds(target.siblingIds, anchorRelationships.siblingIds),
            partnerRelationships: mergeLinks(target.partnerRelationships, anchorRelationships.partnerRelationships, 'partnerId'),
            relationshipLinks: mergeLinks(target.relationshipLinks, anchorRelationships.relationshipLinks, 'personId'),
          }),
        });
        if (!updatedTarget.ok) {
          if (importedApiIds.length) await apiFetch(apiUrl('/api/people/batch'), {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: importedApiIds }),
          }).catch(() => {});
          throw Error('Could not merge the family links. Imported people were rolled back; try again.');
        }
        rows = await refreshPeople();
        setPeople(rows);
      } else {
        const existingIds = new Set(people.map((person) => String(person.id)));
        const idMap = new Map(branchPeople.map((person, index) => [person.sourceId, `local-branch-${Date.now()}-${index}`]));
        const remap = (id) => idMap.get(String(id)) || (existingIds.has(String(id)) ? String(id) : null);
        const imported = branchPeople.map((person) => ({
          ...person,
          id: idMap.get(person.sourceId),
          _id: null,
          parentIds: person.parentIds.map(remap).filter(Boolean).slice(0, 2),
          partnerIds: person.partnerIds.map(remap).filter(Boolean),
          siblingIds: person.siblingIds.map(remap).filter(Boolean),
          partnerRelationships: person.partnerRelationships.map((link) => ({ ...link, partnerId: remap(link.partnerId) })).filter((link) => link.partnerId),
          relationshipLinks: person.relationshipLinks.map((link) => ({ ...link, personId: remap(link.personId) })).filter((link) => link.personId && link.label),
          treeX: null,
          treeY: null,
          color: ['sage', 'rose', 'blue', 'peach', 'lavender', 'yellow', 'mint', 'pink'][(people.length + index) % 8],
        }));
        const resolveId = (id) => {
          const importedId = sourceToImportId[String(id)];
          return idMap.get(importedId) || (importedId && importedId === target.id ? target.id : null);
        };
        const mergeIds = (current, incoming) => [...new Set([...(current || []), ...incoming.map(resolveId).filter(Boolean)])];
        const mergeLinks = (current, incoming, key) => {
          const links = [...(current || [])];
          incoming.map((link) => ({ ...link, [key]: resolveId(link[key]) })).filter((link) => link[key]).forEach((link) => {
            if (!links.some((item) => String(item[key]) === String(link[key]) && (key !== 'personId' || item.label === link.label))) links.push(link);
          });
          return links;
        };
        rows = people.map((person) => person.id === target.id ? {
          ...person,
          parentIds: [...new Set([...(person.parentIds || []), ...anchorRelationships.parentIds.map(resolveId).filter(Boolean)])].slice(0, 2),
          partnerIds: mergeIds(person.partnerIds, anchorRelationships.partnerIds),
          siblingIds: mergeIds(person.siblingIds, anchorRelationships.siblingIds),
          partnerRelationships: mergeLinks(person.partnerRelationships, anchorRelationships.partnerRelationships, 'partnerId'),
          relationshipLinks: mergeLinks(person.relationshipLinks, anchorRelationships.relationshipLinks, 'personId'),
        } : person).concat(imported);
        setPeople(rows);
      }
      setPendingImport(null);
      setSelectedId('');
      manualZoomTouched.current = false;
      autoFitSignature.current = '';
      notify(`Linked ${branchPeople.length + 1} family members and merged their relationships`);
    } catch (error) {
      notify(error.message || 'Could not connect this family branch');
    } finally {
      setIsImporting(false);
    }
  }
  return { updateExportColumns, exportCsv, exportExcel, exportSvg, handleImportFile, confirmDataImport, confirmBranchImport };
}

