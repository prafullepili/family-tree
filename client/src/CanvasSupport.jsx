import { GitFork, Info, Plus, Trash2, X } from 'lucide-react';

export function CanvasHelp({ open, controlRef, onToggle }) {
  return (
    <div className={`canvas-help ${open ? 'open' : ''}`} ref={controlRef}>
      <button
        className="canvas-help-button"
        aria-label="Canvas help"
        aria-expanded={open}
        aria-controls="canvas-help-tooltip"
        title="Canvas help"
        onClick={onToggle}
      >
        <Info size={17} />
      </button>
      <div id="canvas-help-tooltip" className="canvas-help-tooltip" role="tooltip">
        <div className="canvas-help-heading">
          <strong>Canvas controls</strong>
          <span>Move around and manage your family tree</span>
        </div>
        <div className="canvas-help-items">
          <p>
            <strong>Select and move people</strong>
            <span>Click or tap a person to select them. Drag a person to move them; dragging any person in a group selection moves the whole group. Lock movement to prevent accidental changes.</span>
          </p>
          <p>
            <strong>Select several people</strong>
            <span>On desktop, drag on empty canvas to draw a selection box; hold Shift to add to the selection. On phone, press empty canvas briefly, then drag.</span>
          </p>
          <p>
            <strong>Move and zoom the canvas</strong>
            <span>On desktop, hold Space and drag, or drag with the middle mouse button. On phone, drag empty space. Pinch with two fingers or use Ctrl/⌘ + wheel to zoom.</span>
          </p>
          <p>
            <strong>Inspect relationships</strong>
            <span>Select a person to keep their parents, grandparents, and related links highlighted. Hover a link to see its relationship; on mobile, tap a person.</span>
          </p>
          <p>
            <strong>Person shortcuts</strong>
            <span>Use + to add a relative, the pencil to edit, and the details icon to open the profile. Press and hold a person on mobile to open details.</span>
          </p>
          <p>
            <strong>Tree tools</strong>
            <span>Arrange creates a clear layout, Saved views stores favorite positions, and Maximize resets to 100% and centers the tree. Full screen, Settings, and tree themes are in the bottom-right corner.</span>
          </p>
          <p>
            <strong>Keyboard</strong>
            <span>Ctrl/⌘ + A selects everyone in the current family. Delete removes the selection after confirmation. Escape closes open panels and help.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function SelectionToolbar({ count, onRemove, onClear }) {
  if (count <= 1) return null;
  return (
    <div className="selection-toolbar" aria-live="polite">
      <span>{count} selected</span>
      <button onClick={onRemove}>
        <Trash2 size={14} /> Remove selected
      </button>
      <button className="selection-clear-button" aria-label="Clear selection" title="Clear selection" onClick={onClear}>
        <X size={14} />
      </button>
    </div>
  );
}

export function TreeStatus({ apiState, hasSnapshot, peopleCount, treePeopleCount, refreshing, onRefresh, onAdd }) {
  if (apiState === 'checking' && (!hasSnapshot || !peopleCount)) {
    return (
      <div className="tree-loading" role="status" aria-live="polite">
        <span className="loading-spinner" />
        <span>Loading your family tree…</span>
      </div>
    );
  }
  if (treePeopleCount) return null;
  return (
    <div className="tree-empty">
      <div className="tree-empty-icon">
        <GitFork size={26} />
      </div>
      {apiState === 'error' ? (
        <>
          <h2>Couldn’t load your family tree</h2>
          <p>Check that the API and MongoDB are running, then try again.</p>
          <button className="add-person-button" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Try again'}
          </button>
        </>
      ) : (
        <>
          <h2>Start your family tree</h2>
          <p>Add a person, then link parents and partners to build the branches.</p>
          <button className="add-person-button" onClick={onAdd}>
            <Plus size={16} />
            Add first person
          </button>
        </>
      )}
    </div>
  );
}
