import { Bookmark, GitFork, Lock, Maximize2, Palette, Unlock, UsersRound, ZoomIn, ZoomOut } from 'lucide-react';

export default function TreeToolbar({
  visualStyle,
  onVisualStyleChange,
  familyColorsEnabled,
  onToggleFamilyColors,
  loading,
  peopleCount,
  generationCount,
  onOpenSavedViews,
  onArrange,
  arranging,
  movementLocked,
  onToggleMovement,
  zoom,
  onZoomOut,
  onZoomIn,
  onFit,
}) {
  return (
    <div className="tree-toolbar-simple">
      <div className="tree-toolbar-settings">
        <label className="tree-style-toolbar-field">
          <span>TREE STYLE</span>
          <select className="link-style-select" value={visualStyle} onChange={(event) => onVisualStyleChange(event.target.value)}>
            <option value="dashboard">Dashboard cards</option>
            <option value="classic">Classic cards</option>
            <option value="atlas">Family atlas</option>
          </select>
        </label>
        <button
          className={`family-color-toggle ${familyColorsEnabled ? 'active' : ''}`}
          type="button"
          aria-label={familyColorsEnabled ? 'Turn off family branch colors' : 'Turn on family branch colors'}
          aria-pressed={familyColorsEnabled}
          title="Color ancestors and descendants around the selected person"
          onClick={onToggleFamilyColors}
        >
          <Palette size={14} />
          <span>Family colors</span>
        </button>
      </div>
      <div className="tree-count">
        <UsersRound size={15} />
        <span>{loading ? 'Loading family…' : `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}`}</span>
        {!loading && (
          <>
            <span className="toolbar-dot">·</span>
            <span>{generationCount} generations</span>
          </>
        )}
      </div>
      <div className="tree-toolbar-actions">
        <button
          className="arrange-family-button saved-layouts-button"
          onClick={onOpenSavedViews}
          disabled={!peopleCount}
          aria-label="Save or restore a favorite tree view"
          title="Save or restore a favorite tree view"
        >
          <Bookmark size={14} />
          <span>Saved views</span>
        </button>
        <button
          className="arrange-family-button"
          onClick={onArrange}
          disabled={!peopleCount || arranging}
          aria-label="Arrange family into a clear layout"
          title="Arrange generations and save the new positions"
        >
          <GitFork size={14} />
          <span>{arranging ? 'Arranging…' : 'Arrange'}</span>
        </button>
        <button
          className={`canvas-lock-button ${movementLocked ? 'locked' : 'unlocked'}`}
          onClick={onToggleMovement}
          aria-pressed={movementLocked}
          aria-label={movementLocked ? 'Unlock node movement' : 'Lock node movement'}
          title={movementLocked ? 'Node movement is locked. Unlock to move people.' : 'Node movement is unlocked. Lock to prevent moving people.'}
        >
          {movementLocked ? <Lock size={14} /> : <Unlock size={14} />}
          <span>{movementLocked ? 'Locked' : 'Unlocked'}</span>
        </button>
        <div className="zoom-tools">
          <button onClick={onZoomOut} aria-label="Zoom out">
            <ZoomOut size={16} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={onZoomIn} aria-label="Zoom in">
            <ZoomIn size={16} />
          </button>
          <i />
          <button onClick={onFit} aria-label="Reset tree to 100% and center" title="100% and center">
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
