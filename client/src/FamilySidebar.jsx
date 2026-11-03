import { Moon, PanelLeftClose, Search, Sun, X } from 'lucide-react';
import { fullName } from './appHelpers.js';
import { PersonAvatar } from './TreeRenderComponents.jsx';
import VanshLinkLogo from './VanshLinkLogo.jsx';
import FamilyFilter from './FamilyFilter.jsx';

export default function FamilySidebar({
  treeName,
  apiState,
  hasMongoSnapshot,
  peopleCount,
  familyPeopleCount,
  families,
  selectedFamilyId,
  selectedFamily,
  familyPickerOpen,
  familyQuery,
  onFamilyPickerOpenChange,
  onFamilyQueryChange,
  onSelectFamily,
  memberFamilyFilter,
  memberFamilyOptions,
  onMemberFamilyFilterChange,
  query,
  onQueryChange,
  memberListRef,
  sidebarMemberGroups,
  selectedId,
  selectedNodeIds,
  onSelectMember,
  filteredCount,
  refreshFailed,
  isRefreshing,
  theme,
  onThemeChange,
  onClose,
}) {
  const matchingFamilies = families.filter((group) => group.name.toLowerCase().includes(familyQuery.toLowerCase()));
  return (
    <>
      <button className="sidebar-scrim" onClick={onClose} aria-label="Close sidebar" />
      <aside className="simple-sidebar">
        <div className="simple-brand">
          <div className="simple-brand-mark">
            <VanshLinkLogo size={24} />
          </div>
          <span>VanshLink</span>
          <button className="plain-icon hide-sidebar" onClick={onClose} aria-label="Close sidebar">
            <PanelLeftClose size={17} />
          </button>
        </div>
        <div className="sidebar-family">
          <span className="sidebar-family-mark">{treeName[0] || 'F'}</span>
          <div>
            <strong>{treeName}</strong>
            <small>{apiState === 'checking' && (!hasMongoSnapshot || !peopleCount) ? 'Loading…' : `${familyPeopleCount} ${familyPeopleCount === 1 ? 'person' : 'people'}`}</small>
          </div>
        </div>
        {families.length > 1 && (
          <div className="family-picker-label">
            <span>FAMILY</span>
            <div className="family-picker-control" onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && onFamilyPickerOpenChange(false)}>
              <label className="family-picker-search">
                <Search size={13} />
                <input
                  value={familyPickerOpen ? familyQuery : selectedFamilyId === '__all__' ? (families.length === 2 ? 'Both families' : 'All families') : selectedFamily?.name || ''}
                  placeholder="Search families"
                  onFocus={() => {
                    onFamilyPickerOpenChange(true);
                    onFamilyQueryChange('');
                  }}
                  onChange={(event) => {
                    onFamilyQueryChange(event.target.value);
                    onFamilyPickerOpenChange(true);
                  }}
                  aria-label="Search and select a family"
                  aria-expanded={familyPickerOpen}
                />
                {familyPickerOpen && familyQuery && (
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onFamilyQueryChange('')} aria-label="Clear family search">
                    <X size={12} />
                  </button>
                )}
              </label>
              {familyPickerOpen && (
                <div className="family-picker-options">
                  <button type="button" className={selectedFamilyId === '__all__' ? 'active' : ''} onClick={() => onSelectFamily('__all__')}>
                    {families.length === 2 ? 'Both families' : 'All families'} · {peopleCount}
                  </button>
                  {matchingFamilies.map((group) => (
                    <button
                      type="button"
                      key={group.id}
                      className={selectedFamilyId === group.id || (!selectedFamilyId && selectedFamily?.id === group.id) ? 'active' : ''}
                      onClick={() => onSelectFamily(group.id)}
                    >
                      {group.name} · {group.people.length}
                    </button>
                  ))}
                  {!matchingFamilies.length && <span>No matching families</span>}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="side-caption">FAMILY MEMBERS</div>
        <label className="sidebar-search">
          <FamilyFilter value={memberFamilyFilter} options={memberFamilyOptions} onChange={onMemberFamilyFilterChange} label="Filter family group" />
          <Search size={14} />
          <input placeholder="Find a person" value={query} onChange={(event) => onQueryChange(event.target.value)} />
          {query && (
            <button onClick={() => onQueryChange('')}>
              <X size={12} />
            </button>
          )}
        </label>
        <div className="member-list" ref={memberListRef}>
          {sidebarMemberGroups.map((group) => (
            <section className="member-family-group" key={group.name}>
              <div className="member-family-heading">
                <strong>{group.name}</strong>
                <span>{group.people.length}</span>
              </div>
              <div className="member-family-people">
                {group.people.map((person) => (
                  <button
                    key={person.id}
                    className={`member-list-item ${selectedId === person.id || selectedNodeIds.includes(person.id) ? 'active' : ''}`}
                    onClick={(event) => onSelectMember(person.id, event.currentTarget)}
                  >
                    <PersonAvatar person={person} />
                    <span>{fullName(person)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {!filteredCount && (
            <div className="empty-list">
              {apiState === 'checking' && (!hasMongoSnapshot || !peopleCount)
                ? 'Loading family members…'
                : apiState === 'error'
                  ? 'Could not load family members'
                  : query || memberFamilyFilter !== '__all__'
                    ? 'No matching people'
                    : 'No people yet'}
            </div>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="storage-status">
            <span className={`status-light ${refreshFailed ? 'error' : apiState}`} />
            <span>
              {refreshFailed && hasMongoSnapshot
                ? 'Offline · showing saved data'
                : isRefreshing && hasMongoSnapshot
                  ? 'Refreshing data…'
                  : apiState === 'connected'
                    ? 'Saved to MongoDB'
                    : apiState === 'checking'
                      ? 'Connecting…'
                      : apiState === 'demo'
                        ? 'Saved in this browser'
                        : 'Database unavailable'}
            </span>
          </div>
          <button className="theme-toggle" onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <span>Switch to {theme === 'light' ? 'dark' : 'light'} mode</span>
          </button>
        </div>
      </aside>
    </>
  );
}
