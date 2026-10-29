import { Bookmark, FolderOpen, GitFork, Save, Trash2, Upload, X } from 'lucide-react';
import { fullName } from './appHelpers.js';

export default function AppDialogs({
  pendingImport,
  isImporting,
  onCancelImport,
  onConfirmImport,
  confirmDelete,
  selected,
  selectedNodeIds,
  deleteDescendants,
  selectedDescendants,
  onDeleteDescendantsChange,
  onCancelDelete,
  onRemovePerson,
  confirmArrange,
  isArranging,
  onCancelArrange,
  onArrange,
  savedLayoutsOpen,
  onSavedLayoutsOpenChange,
  isSavingLayout,
  applyingLayoutId,
  layoutName,
  onLayoutNameChange,
  onSaveLayout,
  savedLayouts,
  confirmLayoutDeleteId,
  onConfirmLayoutDeleteIdChange,
  deletingLayoutId,
  onRemoveLayout,
  onApplyLayout,
}) {
  return (
    <>
      {pendingImport && (
        <div className="simple-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !isImporting && onCancelImport()}>
          <div className="delete-dialog import-data-dialog" role="dialog" aria-modal="true" aria-labelledby="import-data-title">
            <div className="arrange-dialog-icon" aria-hidden="true">
              <Upload size={20} />
            </div>
            <h2 id="import-data-title">Import family data?</h2>
            <p>
              <strong>{pendingImport.filename}</strong> contains {pendingImport.people.length} {pendingImport.people.length === 1 ? 'person' : 'people'}.
            </p>
            <p>Matching IDs will be updated. New IDs will be added. Existing people missing from the file will remain in the tree.</p>
            <div>
              <button type="button" onClick={onCancelImport} disabled={isImporting}>
                Cancel
              </button>
              <button type="button" className="arrange-action" onClick={onConfirmImport} disabled={isImporting}>
                {isImporting ? 'Importing…' : 'Import data'}
              </button>
            </div>
          </div>
        </div>
      )}
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
                <input type="checkbox" checked={deleteDescendants} onChange={(event) => onDeleteDescendantsChange(event.target.checked)} />
                <span>Also delete all descendants ({selectedDescendants.length})</span>
              </label>
            )}
            <div>
              <button onClick={onCancelDelete}>Cancel</button>
              <button className="danger-action" onClick={onRemovePerson}>
                Remove {selectedNodeIds.length > 1 ? 'selected people' : 'person'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmArrange && (
        <div className="simple-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !isArranging && onCancelArrange()}>
          <div className="delete-dialog arrange-dialog" role="dialog" aria-modal="true" aria-labelledby="arrange-family-title">
            <div className="arrange-dialog-icon" aria-hidden="true">
              <GitFork size={20} />
            </div>
            <h2 id="arrange-family-title">Arrange this family?</h2>
            <p>The visible family will be placed in clear generation rows with partners and siblings together. The new positions will be saved for every device.</p>
            <div>
              <button onClick={onCancelArrange} disabled={isArranging}>
                Cancel
              </button>
              <button className="arrange-action" onClick={onArrange} disabled={isArranging}>
                {isArranging ? 'Arranging…' : 'Arrange family'}
              </button>
            </div>
          </div>
        </div>
      )}
      {savedLayoutsOpen && (
        <div
          className="simple-modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && !isSavingLayout && !applyingLayoutId && onSavedLayoutsOpenChange(false)}
        >
          <div className="delete-dialog saved-layouts-dialog" role="dialog" aria-modal="true" aria-labelledby="saved-layouts-title">
            <button className="saved-layouts-close" onClick={() => onSavedLayoutsOpenChange(false)} aria-label="Close saved tree views">
              <X size={17} />
            </button>
            <div className="arrange-dialog-icon" aria-hidden="true">
              <Bookmark size={20} />
            </div>
            <h2 id="saved-layouts-title">Favorite tree views</h2>
            <p>Save this family’s current node positions with a name. Restoring a view also saves it as the active layout on every device.</p>
            <form className="save-layout-form" onSubmit={onSaveLayout}>
              <label htmlFor="saved-layout-name">View name</label>
              <div>
                <input id="saved-layout-name" value={layoutName} onChange={(event) => onLayoutNameChange(event.target.value)} maxLength={60} placeholder="Example: My favorite layout" autoFocus />
                <button type="submit" className="arrange-action" disabled={!layoutName.trim() || isSavingLayout}>
                  <Save size={14} />
                  {isSavingLayout ? 'Saving…' : 'Save current'}
                </button>
              </div>
            </form>
            <div className="saved-layout-list" aria-label="Saved tree views">
              <div className="saved-layout-list-heading">
                <span>Saved views</span>
                <small>{savedLayouts.length}</small>
              </div>
              {savedLayouts.length ? (
                savedLayouts.map((savedLayout) => (
                  <div className="saved-layout-row" key={savedLayout._id}>
                    <div>
                      <strong>{savedLayout.name}</strong>
                      <small>
                        {savedLayout.positions?.length || 0} people · {new Date(savedLayout.updatedAt).toLocaleDateString()}
                      </small>
                    </div>
                    <div className="saved-layout-actions">
                      {confirmLayoutDeleteId === savedLayout._id ? (
                        <>
                          <button type="button" onClick={() => onConfirmLayoutDeleteIdChange('')} disabled={deletingLayoutId === savedLayout._id}>
                            Cancel
                          </button>
                          <button className="remove-saved-layout-confirm" type="button" onClick={() => onRemoveLayout(savedLayout)} disabled={deletingLayoutId === savedLayout._id}>
                            {deletingLayoutId === savedLayout._id ? 'Removing…' : 'Remove'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => onApplyLayout(savedLayout)} disabled={Boolean(applyingLayoutId || deletingLayoutId)}>
                            <FolderOpen size={14} />
                            {applyingLayoutId === savedLayout._id ? 'Restoring…' : 'Restore'}
                          </button>
                          <button
                            className="remove-saved-layout"
                            type="button"
                            onClick={() => onConfirmLayoutDeleteIdChange(savedLayout._id)}
                            disabled={Boolean(applyingLayoutId || deletingLayoutId)}
                            aria-label={`Remove saved view ${savedLayout.name}`}
                            title="Remove saved view"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="saved-layout-empty">
                  <Bookmark size={18} />
                  <span>No favorite views saved for this family yet.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
