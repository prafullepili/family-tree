import { Eye, EyeOff, Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { fullName, year } from './appHelpers.js';
import { PersonAvatar } from './TreeRenderComponents.jsx';

const QUICK_ADD_OPTIONS = [
  ['father', 'Father'],
  ['mother', 'Mother'],
  ['brother', 'Brother'],
  ['sister', 'Sister'],
  ['son', 'Son'],
  ['daughter', 'Daughter'],
  ['partner', 'Partner'],
];

export default function TreePersonNode({
  person,
  position,
  detailsVisible,
  linkHighlighted,
  networkHighlighted,
  selected,
  familyColorIndex,
  quickAddOpen,
  aboutOpen,
  aboutDismissed,
  onHoverStart,
  onHoverEnd,
  onTouchDragStart,
  onTouchPointerUp,
  onMouseDragStart,
  onOpenFromKeyboard,
  onToggleQuickAdd,
  onQuickAdd,
  onEdit,
  onToggleDetails,
  onRestoreAboutHover,
  onToggleAbout,
  onDelete,
}) {
  const name = fullName(person);
  const familyColorClass = familyColorIndex == null ? '' : `family-colored family-color-${familyColorIndex}`;
  return (
    <div
      data-person-id={person.id}
      className={`tree-person gender-${person.gender || 'unspecified'} ${person.deathDate ? 'is-deceased' : ''} ${linkHighlighted ? 'link-highlighted' : ''} ${networkHighlighted ? 'link-path-node' : ''} ${selected ? 'selected' : ''} ${familyColorClass}`}
      style={{ left: position.x, top: position.y }}
      onPointerEnter={(event) => event.pointerType !== 'touch' && onHoverStart()}
      onPointerLeave={(event) => event.pointerType !== 'touch' && onHoverEnd()}
      onPointerDown={(event) => event.pointerType === 'touch' && onTouchDragStart(event)}
      onPointerUp={(event) => event.pointerType === 'touch' && onTouchPointerUp(event)}
      onMouseDown={onMouseDragStart}
    >
      <button
        className="tree-person-card"
        aria-label={`Select ${name}; drag to move; press and hold to open details`}
        onContextMenu={(event) => event.preventDefault()}
        onClick={(event) => event.detail === 0 && onOpenFromKeyboard()}
      >
        <PersonAvatar person={person} size="large" />
        <span className="tree-person-copy">
          <strong>{name}</strong>
          <small>
            {person.maidenName ? `Born: ${person.maidenName} · ` : ''}
            {year(person.birthDate)}
            {person.deathDate ? ` — ${year(person.deathDate)}` : ' —'}
          </small>
        </span>
        <span className="drag-grip">⠿</span>
      </button>
      <div className={`tree-node-quick-add ${quickAddOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="tree-node-quick-add-button"
          aria-label={`Quickly add a relative of ${name}`}
          aria-expanded={quickAddOpen}
          title="Add relative"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggleQuickAdd();
          }}
        >
          <Plus size={16} />
        </button>
        {quickAddOpen && (
          <div className="tree-node-quick-add-menu" role="menu" aria-label={`Add relative of ${name}`}>
            {QUICK_ADD_OPTIONS.map(([kind, label]) => (
              <button
                type="button"
                role="menuitem"
                key={kind}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onQuickAdd(kind);
                }}
              >
                <Plus size={12} />
                Add {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        className="tree-node-edit"
        title={`Edit ${name}`}
        aria-label={`Edit ${name}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
      >
        <Pencil size={13} />
      </button>
      <button
        className="tree-node-info"
        title={detailsVisible ? `Hide ${name} details` : `View ${name} details`}
        aria-label={detailsVisible ? `Hide ${name} details` : `View ${name} details`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onToggleDetails();
        }}
      >
        {detailsVisible ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <div
        className={`tree-node-about-wrap ${aboutOpen ? 'is-open' : ''} ${aboutDismissed ? 'is-dismissed' : ''}`}
        onPointerEnter={(event) => event.pointerType !== 'touch' && aboutDismissed && onRestoreAboutHover()}
      >
        <button
          className="tree-node-about"
          aria-label={`Information about ${name}`}
          aria-describedby={`tree-person-tooltip-${person.id}`}
          aria-expanded={aboutOpen}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggleAbout();
          }}
        >
          <Info size={13} />
        </button>
        <div
          id={`tree-person-tooltip-${person.id}`}
          className="tree-node-about-tooltip"
          role="tooltip"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="tree-node-about-heading">
            <span>PERSON DETAILS</span>
            <strong>{name}</strong>
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
        title={`Delete ${name}`}
        aria-label={`Delete ${name}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
