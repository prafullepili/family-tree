import { useEffect, useRef, useState } from 'react';
import App from './App.jsx';
import { apiFetch, apiUrl, setActiveTreeId, resetFamilyDataRequest } from './apiClient.js';
import './treeWorkspace.css';

async function request(path, method = 'GET', body) {
  const response = await apiFetch(apiUrl(`/api/trees${path}`), { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw Error(data?.error || 'Could not complete this action.');
  return data;
}

export default function TreeWorkspace({ user, onLogout }) {
  const [trees, setTrees] = useState([]);
  const [active, setActive] = useState(null);
  const [panel, setPanel] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [token, setToken] = useState(() => new URLSearchParams(location.search).get('invite') || '');
  const [inviteLink, setInviteLink] = useState('');
  const [rows, setRows] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [revision, setRevision] = useState(0);
  const [canvasRevision, setCanvasRevision] = useState(0);
  const panelRef = useRef(null);

  function selectTree(tree) {
    setActiveTreeId(tree.id);
    setActive(tree);
    setPanel('');
    setRows([]);
    setInviteLink('');
    try { localStorage.setItem(`vanshlink-active-tree:${user.id}`, tree.id); } catch {}
  }
  async function loadTrees(preferredId) {
    const list = await request('');
    setTrees(list);
    let saved;
    try { saved = localStorage.getItem(`vanshlink-active-tree:${user.id}`); } catch {}
    const selected = list.find((tree) => tree.id === (preferredId || active?.id || saved)) || list[0];
    if (selected) selectTree(selected);
  }
  useEffect(() => { loadTrees().catch((e) => setError(e.message)); }, [user.id]);
  useEffect(() => {
    if (active && new URLSearchParams(location.search).has('invite')) setPanel('join');
  }, [active?.id]);
  useEffect(() => {
    if (!panel || !active || panel === 'create' || panel === 'join') return;
    let cancelled = false;
    setRows([]);
    setError('');
    Promise.all([request(`/${active.id}/${panel}`), panel === 'members' && active.role === 'owner' ? request(`/${active.id}/invitations`) : Promise.resolve([])])
      .then(([items, pending]) => { if (!cancelled) { setRows(items); setInvitations(pending); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [panel, active?.id, revision]);
  useEffect(() => {
    if (!panel) return;
    const previousFocus = document.activeElement;
    panelRef.current?.querySelector('button')?.focus();
    const close = (e) => { if (e.key === 'Escape') setPanel(''); };
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('keydown', close); previousFocus?.focus(); };
  }, [panel]);
  async function act(action) {
    setBusy(true); setError('');
    try { await action(); setRevision((n) => n + 1); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const title = { members: 'Members & invitations', activity: 'Activity history', 'recycle-bin': 'Recycle bin', create: 'Create a family tree', join: 'Accept invitation' }[panel];
  return (
    <div className={`tree-workspace ${active?.role === 'viewer' ? 'tree-workspace-viewer' : ''}`}>
      <nav className="workspace-bar" aria-label="Family tree workspace" inert={panel ? '' : undefined}>
        <label>Tree <select aria-label="Choose family tree" value={active?.id || ''} onChange={(e) => selectTree(trees.find((t) => t.id === e.target.value))}>
          {!active && <option value="">Loading trees…</option>}
          {trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.name}</option>)}
        </select></label>
        {active && <span className="workspace-role">{active.role}</span>}
        <button onClick={() => setPanel('create')}>New tree</button>
        <button onClick={() => setPanel('join')}>Join tree</button>
        <button disabled={!active} onClick={() => setPanel('members')}>Members</button>
        <button disabled={!active} onClick={() => setPanel('activity')}>Activity</button>
        <button disabled={!active} onClick={() => setPanel('recycle-bin')}>Recycle bin</button>
      </nav>
      {!active && <div className="workspace-loading">{error || 'Opening your family trees…'}{error && <button onClick={() => loadTrees().catch((e) => setError(e.message))}>Retry</button>}</div>}
      {active && <div className="workspace-content" inert={panel ? '' : undefined}><App key={`${active.id}:${canvasRevision}`} authUser={{ ...user, treeId: active.id, treeRole: active.role }} onLogout={onLogout} /></div>}
      {panel && <>
        <button className="workspace-scrim" aria-label="Close tree panel" onClick={() => setPanel('')} />
        <aside ref={panelRef} className="workspace-panel" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape') setPanel('');
          if (event.key === 'Tab') {
            const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input, select, a[href]')];
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}>
          <header><h2>{title}</h2><button autoFocus onClick={() => setPanel('')} aria-label="Close">×</button></header>
          {error && <p role="alert" className="workspace-error">{error}</p>}
          {panel === 'create' && <form onSubmit={(e) => { e.preventDefault(); act(async () => { const tree = await request('', 'POST', { name }); await loadTrees(tree.id); setName(''); }); }}>
            <label>Tree name<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Our family" /></label>
            <button disabled={busy}>Create tree</button>
          </form>}
          {panel === 'join' && <form onSubmit={(e) => { e.preventDefault(); act(async () => { let value = token.trim(); try { value = new URL(value).searchParams.get('invite') || value; } catch {} const result = await request('/accept-invitation', 'POST', { token: value }); await loadTrees(result.treeId); setToken(''); const url = new URL(location.href); url.searchParams.delete('invite'); history.replaceState(null, '', url); }); }}>
            <p>Sign in with the email address that received the invitation, then paste the invitation link or code.</p>
            <label>Invitation link or code<input required value={token} onChange={(e) => setToken(e.target.value)} /></label><button disabled={busy}>Join tree</button>
          </form>}
          {panel === 'members' && <>
            <p>Owners manage access. Editors update people and positions. Viewers browse without changing the tree.</p>
            {active.role === 'owner' && <form onSubmit={(e) => { e.preventDefault(); act(async () => { const result = await request(`/${active.id}/invitations`, 'POST', { email, role }); const url = new URL(location.href); url.searchParams.set('invite', result.token); setInviteLink(url.href); setEmail(''); }); }}>
              <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label>Access<select value={role} onChange={(e) => setRole(e.target.value)}><option value="viewer">Viewer</option><option value="editor">Editor</option></select></label>
              <button disabled={busy}>Create invitation link</button>
              {inviteLink && <label>Share this link (valid for 7 days)<input readOnly value={inviteLink} onFocus={(e) => e.target.select()} /><button type="button" onClick={() => act(() => navigator.clipboard.writeText(inviteLink))}>Copy link</button><small>Send it to the invited person. Email delivery is not automatic.</small></label>}
            </form>}
            <ul>{rows.map((member) => <li key={member.id}><div><strong>{member.name}</strong><small>{member.email}</small></div>
              {active.role === 'owner' && member.role !== 'owner' ? <><select aria-label={`Role for ${member.name}`} disabled={busy} value={member.role} onChange={(e) => act(() => request(`/${active.id}/members/${member.id}`, 'PATCH', { role: e.target.value }))}><option value="viewer">Viewer</option><option value="editor">Editor</option></select><button disabled={busy} onClick={() => { if (confirm(`Remove ${member.name} from this tree?`)) act(() => request(`/${active.id}/members/${member.id}`, 'DELETE')); }}>Remove</button></> : <span className="workspace-role">{member.role}</span>}
            </li>)}</ul>
            {active.role === 'owner' && invitations.length > 0 && <><h3>Pending invitations</h3><ul>{invitations.map((invite) => <li key={invite._id}><div>{invite.email}<small>{invite.role} · Expires {new Date(invite.expiresAt).toLocaleDateString()}</small></div><button disabled={busy} onClick={() => act(() => request(`/${active.id}/invitations/${invite._id}`, 'DELETE'))}>Revoke</button></li>)}</ul></>}
          </>}
          {panel === 'activity' && <><p>Latest 100 changes to this tree.</p><ul>{rows.map((item) => <li key={item._id}><div><strong>{item.actorName}</strong><p>{item.action}{item.detail && ` · ${item.detail}`}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div></li>)}{!rows.length && <p>No activity recorded yet.</p>}</ul></>}
          {panel === 'recycle-bin' && <><p>Deleted people stay here with their saved relationships and positions. Restore related people together to see their connections again.</p><ul>{rows.map((person) => <li key={person._id}><div><strong>{person.firstName} {person.lastName}</strong><small>Deleted {new Date(person.deletedAt).toLocaleString()}</small></div>{active.role !== 'viewer' && <button disabled={busy} onClick={() => act(async () => { await request(`/${active.id}/recycle-bin/${person._id}/restore`, 'POST'); resetFamilyDataRequest(); setCanvasRevision((n) => n + 1); })}>Restore</button>}</li>)}{!rows.length && <p>The recycle bin is empty.</p>}</ul></>}
        </aside>
      </>}
    </div>
  );
}
