import { Check, Download, FileSpreadsheet, Network, Settings, Upload, X } from 'lucide-react';

export const DATA_COLUMNS = [
  'First Name',
  'Last Name',
  'Maiden Name',
  'Gender',
  'Born',
  'Died',
  'Birthplace',
  'Occupation',
  'About',
  'Family Notes',
  'Photo URL',
  'Parents',
  'Partners',
  'Siblings',
  'Other Relationships',
  'Tree X',
  'Tree Y',
];

const RELATIONSHIP_OPTIONS = [
  ['parent', 'Parents and children'],
  ['partner', 'Partners and spouses'],
  ['sibling', 'Siblings'],
  ['custom', 'Other relationships'],
];

const TREE_STYLES = [
  ['dashboard', 'Dashboard cards'],
  ['classic', 'Classic cards'],
  ['atlas', 'Family atlas'],
];

export default function TreeSettingsControls({
  settingsOpen,
  settingsControlRef,
  onSettingsOpenChange,
  visibleLinkTypes,
  onVisibleLinkTypesChange,
  deceasedRibbon,
  onDeceasedRibbonChange,
  exportFieldsOpen,
  onExportFieldsOpenChange,
  exportColumns,
  onExportColumnsChange,
  onExportCsv,
  onExportExcel,
  onExportSvg,
  importFileRef,
  onImportFile,
  treeStyleMenuOpen,
  treeStyleControlRef,
  onTreeStyleMenuOpenChange,
  treeVisualStyle,
  onTreeVisualStyleChange,
}) {
  return (
    <>
      <div className={`canvas-settings-control ${settingsOpen ? 'is-open' : ''}`} ref={settingsControlRef}>
        {settingsOpen && (
          <>
            <button type="button" className="tree-settings-scrim" aria-label="Close tree settings" onClick={() => onSettingsOpenChange(false)} />
            <div className="tree-settings-menu" role="dialog" aria-label="Tree settings">
              <div className="tree-settings-heading">
                <span>
                  <strong>Tree settings</strong>
                  <small>Customize relationships, markers, and family data</small>
                </span>
                <button type="button" aria-label="Close tree settings" onClick={() => onSettingsOpenChange(false)}>
                  <X size={17} />
                </button>
              </div>
              <div className="tree-settings-section-heading">
                <strong>Visible relationships</strong>
                <small>Choose which relationships appear in the tree</small>
              </div>
              {RELATIONSHIP_OPTIONS.map(([type, label]) => (
                <label className="link-visibility-option" key={type}>
                  <input
                    type="checkbox"
                    checked={visibleLinkTypes[type]}
                    onChange={(event) => onVisibleLinkTypesChange((current) => ({ ...current, [type]: event.target.checked }))}
                  />
                  <span className="link-visibility-check" aria-hidden="true">
                    {visibleLinkTypes[type] && <Check size={12} />}
                  </span>
                  <span>{label}</span>
                </label>
              ))}
              <label className="deceased-ribbon-setting">
                <span>
                  <strong>Deceased marker</strong>
                  <small>Show a corner ribbon when a death date is recorded</small>
                </span>
                <select value={deceasedRibbon} onChange={(event) => onDeceasedRibbonChange(event.target.value)} aria-label="Deceased person ribbon">
                  <option value="off">Off</option>
                  <option value="black">Black ribbon</option>
                  <option value="red">Red ribbon</option>
                </select>
              </label>
              <div className="tree-data-settings">
                <span>
                  <strong>Family data</strong>
                  <small>Export tree data or download the complete canvas</small>
                </span>
                <button type="button" className="export-fields-toggle" onClick={() => onExportFieldsOpenChange((open) => !open)} aria-expanded={exportFieldsOpen}>
                  <span>Fields to export</span>
                  <strong>
                    {exportColumns.length} of {DATA_COLUMNS.length}
                  </strong>
                </button>
                {exportFieldsOpen && (
                  <div className="export-fields-panel">
                    <div className="export-fields-actions">
                      <button type="button" onClick={() => onExportColumnsChange(DATA_COLUMNS)}>
                        Select all
                      </button>
                      <button type="button" onClick={() => onExportColumnsChange([])}>
                        Clear
                      </button>
                    </div>
                    <div className="export-fields-grid">
                      {DATA_COLUMNS.map((column) => {
                        const checked = exportColumns.includes(column);
                        return (
                          <label key={column}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onExportColumnsChange(checked ? exportColumns.filter((item) => item !== column) : [...exportColumns, column])}
                            />
                            <span className="link-visibility-check" aria-hidden="true">
                              {checked && <Check size={11} />}
                            </span>
                            <span>{column}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="tree-data-actions">
                  <button type="button" onClick={onExportCsv} title="Export CSV">
                    <Download size={13} /> CSV
                  </button>
                  <button type="button" onClick={onExportExcel} title="Export Excel workbook">
                    <FileSpreadsheet size={13} /> Excel
                  </button>
                  <button type="button" onClick={onExportSvg} title="Download the entire family tree as an SVG image">
                    <Download size={13} /> SVG
                  </button>
                  <button type="button" onClick={() => importFileRef.current?.click()} title="Import CSV or Excel">
                    <Upload size={13} /> Import
                  </button>
                </div>
                <input
                  ref={importFileRef}
                  className="tree-data-file-input"
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={onImportFile}
                />
              </div>
            </div>
          </>
        )}
        <button
          type="button"
          className="tree-style-fab"
          aria-label="Tree settings"
          aria-expanded={settingsOpen}
          title="Tree settings"
          onClick={() => {
            onTreeStyleMenuOpenChange(false);
            onSettingsOpenChange((open) => !open);
          }}
        >
          <Settings size={18} />
        </button>
      </div>
      <div className={`mobile-tree-style-control ${treeStyleMenuOpen ? 'is-open' : ''}`} ref={treeStyleControlRef}>
        {treeStyleMenuOpen && (
          <div className="tree-style-selection" role="menu" aria-label="Select tree style">
            {TREE_STYLES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={treeVisualStyle === value}
                className={treeVisualStyle === value ? 'active' : ''}
                onClick={() => {
                  onTreeVisualStyleChange(value);
                  onTreeStyleMenuOpenChange(false);
                }}
              >
                <i aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="tree-style-fab"
          aria-label="Choose tree style"
          aria-expanded={treeStyleMenuOpen}
          title="Tree style"
          onClick={() => {
            onSettingsOpenChange(false);
            onTreeStyleMenuOpenChange((open) => !open);
          }}
        >
          <Network size={18} />
        </button>
      </div>
    </>
  );
}
