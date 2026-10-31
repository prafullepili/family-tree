import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  GitFork,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { fullName } from './appHelpers.js';
import { PersonAvatar } from './TreeRenderComponents.jsx';

function FamilyFilter({ value, options, onChange, label }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      <option value="__all__">All groups</option>
      {options.map((group) => (
        <option key={group.key} value={group.key}>
          {group.name} ({group.count})
        </option>
      ))}
    </select>
  );
}

export function FamilySidebar({
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
            <GitFork size={18} />
          </div>
          <span>kinfolk</span>
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

export function AppHeader({
  sidebarOpen,
  onSidebarOpenChange,
  treeName,
  memberFamilyFilter,
  memberFamilyOptions,
  onMemberFamilyFilterChange,
  query,
  onQueryChange,
  onSearchFocus,
  theme,
  onThemeChange,
  isRefreshing,
  onRefresh,
  detailsVisible,
  onToggleDetails,
  onAddPerson,
  authUser,
  onLogout,
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const accountRef = useRef(null);
  useEffect(() => {
    if (!accountOpen) return undefined;
    const close = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [accountOpen]);
  const initials = String(authUser?.displayName || authUser?.username || 'You')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <header className="simple-topbar">
      <div className="topbar-left">
        <button
          className="plain-icon open-sidebar"
          onClick={() => onSidebarOpenChange(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Hide family members' : 'Show family members'}
          title={sidebarOpen ? 'Hide family members' : 'Show family members'}
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        <div className="topbar-title">
          <span>FAMILY TREE</span>
          <h1>{treeName}</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <label className="header-member-search">
          <FamilyFilter value={memberFamilyFilter} options={memberFamilyOptions} onChange={onMemberFamilyFilterChange} label="Search within family group" />
          <Search size={14} />
          <input
            value={query}
            placeholder="Search people"
            aria-label="Search family members"
            onFocus={onSearchFocus}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          {query && (
            <button type="button" onClick={() => onQueryChange('')} aria-label="Clear member search">
              <X size={12} />
            </button>
          )}
        </label>
        <button className="top-theme-toggle" onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle color mode">
          {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <button
          className={`top-theme-toggle data-refresh-toggle ${isRefreshing ? 'is-refreshing' : ''}`}
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={isRefreshing ? 'Refreshing family data' : 'Refresh family data'}
          title={isRefreshing ? 'Refreshing family data…' : 'Refresh family data'}
        >
          <RefreshCw size={16} />
        </button>
        <button className="right-panel-toggle" onClick={onToggleDetails} aria-label={detailsVisible ? 'Hide person details' : 'Show person details'}>
          {detailsVisible ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
        </button>
        <button className="add-person-button" onClick={onAddPerson}>
          <Plus size={16} />
          <span>Add person</span>
        </button>
        <div className="account-menu" ref={accountRef}>
          <button
            type="button"
            className={`account-menu-trigger ${accountOpen ? 'is-open' : ''}`}
            onClick={() => setAccountOpen((open) => !open)}
            aria-label="Open account menu"
            aria-haspopup="menu"
            aria-expanded={accountOpen}
          >
            {authUser?.avatarUrl ? <img src={authUser.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
            <ChevronDown size={14} />
          </button>
          {accountOpen && (
            <div className="account-menu-popover" role="menu">
              <div className="account-menu-user">
                {authUser?.avatarUrl ? <img src={authUser.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
                <div>
                  <strong>{authUser?.displayName || authUser?.username}</strong>
                  <small>{authUser?.email}</small>
                </div>
              </div>
              <button
                type="button"
                role="menuitem"
                disabled={loggingOut}
                onClick={async () => {
                  setLoggingOut(true);
                  await onLogout?.();
                }}
              >
                <LogOut size={15} />
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
