import { lazy, Suspense } from 'react';
import { CalendarDays, Heart, MapPin, Pencil, Trash2, UsersRound } from 'lucide-react';
import { formatLongDate, fullName, relationshipLabel, year } from './appHelpers.js';
import { PersonAvatar } from './TreeRenderComponents.jsx';

const PersonModal = lazy(() => import('./PersonModal.jsx'));

export function PersonModalDialog({ modal, people, onClose, onSave }) {
  if (!modal || modal.inline) return null;
  return (
    <Suspense fallback={<div className="person-editor-loading is-modal" role="status">Loading editor…</div>}>
      <PersonModal key={modal.person?.id || modal.kind || 'new'} modal={modal} people={people} onClose={onClose} onSave={onSave} />
    </Suspense>
  );
}

export default function PersonDetailsPanel({
  open,
  mobileOpen,
  editingModal,
  selected,
  people,
  detailsWidth,
  onResizeKeyDown,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onClearSelection,
  onCloseEditor,
  onSavePerson,
  onEditPerson,
  familyLinkGroups,
  getPersonById,
  onEditLinks,
  onOpenLinkedPerson,
  onClosePanel,
  onRequestDelete,
}) {
  return (
    <>
      {mobileOpen && <button className="details-scrim" onClick={onClearSelection} aria-label="Close person details and clear selection" />}
      {open && (
        <aside className={`simple-details ${mobileOpen ? 'show-mobile' : ''} ${editingModal?.inline ? 'editing-person' : ''}`}>
          <div
            className="details-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize details panel"
            aria-valuenow={detailsWidth}
            tabIndex={0}
            onKeyDown={onResizeKeyDown}
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
          />
          {editingModal?.inline && (!editingModal.person || editingModal.person.id === selected?.id) ? (
            <Suspense fallback={<div className="person-editor-loading" role="status">Loading editor…</div>}>
              <PersonModal
                key={editingModal.person?.id || editingModal.kind || 'new'}
                modal={editingModal}
                people={people}
                onClose={onCloseEditor}
                onSave={onSavePerson}
              />
            </Suspense>
          ) : selected ? (
            <>
              <div className="details-heading">
                <span>PERSON DETAILS</span>
                <div>
                  <button className="family-links-edit-button" onClick={onEditPerson} aria-label="Edit person" title="Edit person">
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
              <div className="selected-profile">
                <PersonAvatar person={selected} size="profile" />
                <h2>{fullName(selected)}</h2>
                <span className="person-years">
                  {year(selected.birthDate)}
                  {selected.deathDate ? ` — ${year(selected.deathDate)}` : ' —'}
                </span>
              </div>
              <div className="details-fields">
                <div className="detail-field">
                  <CalendarDays size={15} />
                  <span>
                    <small>Born</small>
                    <strong>{formatLongDate(selected.birthDate)}</strong>
                  </span>
                </div>
                <div className="detail-field">
                  <MapPin size={15} />
                  <span>
                    <small>Birthplace</small>
                    <strong>{selected.birthPlace || 'Not added'}</strong>
                  </span>
                </div>
                {selected.deathDate && (
                  <div className="detail-field">
                    <CalendarDays size={15} />
                    <span>
                      <small>Died</small>
                      <strong>
                        {new Date(`${selected.deathDate}T00:00:00`).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </strong>
                    </span>
                  </div>
                )}
                {selected.occupation && (
                  <div className="detail-field">
                    <Heart size={15} />
                    <span>
                      <small>Occupation</small>
                      <strong>{selected.occupation}</strong>
                    </span>
                  </div>
                )}
              </div>
              <div className="details-bio">
                <label>ABOUT</label>
                <p>{selected.bio || 'Add a short story or memory about this person.'}</p>
              </div>
              <div className="details-links">
                <div className="details-links-heading">
                  <label>FAMILY LINKS</label>
                  <button className="family-links-edit-button" onClick={onEditLinks} aria-label="Edit family links" title="Edit family links">
                    <Pencil size={13} />
                  </button>
                </div>
                {familyLinkGroups.length ? (
                  <div className="details-link-groups">
                    {familyLinkGroups.map((group) => (
                      <section className="details-link-group" key={group.key} aria-labelledby={`family-link-group-${group.key}`}>
                        <h3 id={`family-link-group-${group.key}`}>
                          <span>{group.label}</span>
                          <small>{group.links.length}</small>
                        </h3>
                        {group.links.map((link) => {
                          const person = getPersonById(link.id);
                          return (
                            <button className="details-link-row" key={`${group.key}-${link.id}`} onClick={() => onOpenLinkedPerson(link.id)}>
                              <PersonAvatar person={person} />
                              <span className="details-link-person">
                                <strong>{fullName(person)}</strong>
                              </span>
                              <small className="details-link-role">{link.label || relationshipLabel(link.role, person, selected)}</small>
                            </button>
                          );
                        })}
                      </section>
                    ))}
                  </div>
                ) : (
                  <p className="details-links-empty">No family links added yet.</p>
                )}
                <div className="details-actions-row">
                  <button className="details-cancel-button" onClick={onClosePanel}>
                    Cancel
                  </button>
                  <button className="remove-person-button" onClick={onRequestDelete}>
                    <Trash2 size={14} /> Remove person
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="details-empty">
              <UsersRound size={23} />
              <p>Select a person in the tree to see details.</p>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
