import { DATA_COLUMNS } from './TreeSettingsControls.jsx';
import { storageSet } from './appHelpers.js';
import { apiUrl } from './apiClient.js';

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
  return { updateExportColumns, exportCsv, exportExcel, exportSvg, handleImportFile, confirmDataImport };
}

