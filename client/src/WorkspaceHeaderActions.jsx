import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FolderPlus, History, MailPlus, Trash2, Users } from 'lucide-react';

export default function WorkspaceHeaderActions({ trees, active, onSelectTree, onOpenPanel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape); };
  }, [open]);
  const actions = [
    ['create', 'New tree', FolderPlus],
    ['join', 'Join tree', MailPlus],
    ['members', 'Members & invitations', Users],
    ['activity', 'Activity history', History],
    ['recycle-bin', 'Recycle bin', Trash2],
  ];
  return (
    <nav className="workspace-header-actions" aria-label="Family tree workspace">
      <select aria-label="Choose family tree" value={active.id} onChange={(event) => onSelectTree(trees.find((tree) => tree.id === event.target.value))}>
        {trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.name}</option>)}
      </select>
      <div className="workspace-action-menu" ref={ref}>
        <button ref={trigger} type="button" className="workspace-menu-trigger" aria-expanded={open} aria-controls="workspace-action-list" onClick={() => setOpen((value) => !value)}>
          Tree actions <ChevronDown size={15} />
        </button>
        {open && <div id="workspace-action-list" className="workspace-action-list">
          <span className="workspace-menu-caption">Your access: {active.role}</span>
          {actions.map(([panel, label, Icon]) => <button key={panel} type="button" onClick={() => { trigger.current?.focus(); setOpen(false); onOpenPanel(panel); }}><Icon size={17} /><span>{label}</span></button>)}
        </div>}
      </div>
    </nav>
  );
}
