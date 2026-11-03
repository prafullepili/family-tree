import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
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
import VanshLinkLogo from './VanshLinkLogo.jsx';
import FamilyFilter from './FamilyFilter.jsx';

export default function AppHeader({
  workspaceActions,
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
    <header className={`simple-topbar ${workspaceActions ? 'has-workspace-actions' : ''}`}>
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
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><VanshLinkLogo size={18} /> VANSHLINK</span>
          <h1>{treeName}</h1>
        </div>
      </div>
      {workspaceActions}
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
