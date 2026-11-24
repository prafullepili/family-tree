import { useEffect, useState } from 'react';
import { Check, Copy, GitMerge, Link2, X } from 'lucide-react';
import { fullName } from './appHelpers.js';

export default function PersonMergeDialogs({ invite, preview, people, isAccepting, error, onCloseInvite, onClosePreview, onAccept }) {
  const [copied, setCopied] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [targetOpen, setTargetOpen] = useState(false);
  const [activeTargetIndex, setActiveTargetIndex] = useState(0);
  const [mergeMode, setMergeMode] = useState('match');
  const [linkMode, setLinkMode] = useState('live');
  useEffect(() => {
    setCopied(false);
    setTargetId('');
    setTargetQuery('');
    setTargetOpen(false);
    setActiveTargetIndex(0);
    setMergeMode('match');
    setLinkMode('live');
  }, [invite?.token, preview?.token]);
  useEffect(() => {
    if (!preview) return;
    const matches = people.filter((person) => fullName(person).trim().toLowerCase() === fullName(preview.person).trim().toLowerCase());
    const match = matches.length === 1 ? matches[0] : null;
    setTargetId(match?.id || '');
    setTargetQuery(match ? fullName(match) : '');
  }, [preview?.token, people]);

  const normalizedTargetQuery = targetQuery.trim().toLowerCase();
  const filteredPeople = normalizedTargetQuery
    ? people.filter((person) => `${fullName(person)} ${person.birthDate || ''}`.toLowerCase().includes(normalizedTargetQuery))
    : people;
  const chooseTarget = (person) => {
    setTargetId(person.id);
    setTargetQuery(fullName(person));
    setTargetOpen(false);
  };

  return <>
    {invite && <div className="simple-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCloseInvite()}>
      <div className="delete-dialog merge-invitation-dialog" role="dialog" aria-modal="true" aria-labelledby="merge-invite-title">
        <button className="saved-layouts-close" type="button" onClick={onCloseInvite} aria-label="Close"><X size={17}/></button>
        <div className="arrange-dialog-icon"><Link2 size={20}/></div>
        <h2 id="merge-invite-title">Invite someone to merge this family</h2>
        <p>This link invites someone to match <strong>{invite.personName}</strong> to a person in their tree and merge the connected family relationships. Your tree stays unchanged. The link expires in 7 days and can be used once.</p>
        <label className="merge-invitation-link-label">Invitation link<input readOnly value={invite.url} onFocus={(event) => event.target.select()} /></label>
        <div>
          <button type="button" onClick={onCloseInvite}>Done</button>
          <button type="button" className="arrange-action" onClick={async () => {
            try { await navigator.clipboard.writeText(invite.url); setCopied(true); }
            catch { setCopied(false); }
          }}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copied' : 'Copy link'}</button>
        </div>
      </div>
    </div>}
    {preview && <div className="simple-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !isAccepting && onClosePreview()}>
      <div className="delete-dialog merge-invitation-dialog" role="dialog" aria-modal="true" aria-labelledby="merge-accept-title">
        <div className="arrange-dialog-icon"><GitMerge size={20}/></div>
        <h2 id="merge-accept-title">Merge an invited family</h2>
        {preview.loading ? <p role="status">Loading invitation…</p> : !preview.person ? <>
          <p className="relationship-error" role="alert">{preview.error || error || 'This merge invitation is unavailable.'}</p>
          <div><button type="button" onClick={onClosePreview}>Close</button></div>
        </> : <>
          <p><strong>{preview.sourceTreeName}</strong> invites you to merge the family connected to <strong>{fullName(preview.person)}</strong>. The source tree will not be changed.</p>
          <p>{preview.familyCount} connected family {preview.familyCount === 1 ? 'member' : 'members'} will be included. The source tree will not be changed.</p>
          <label className="branch-import-field">How should the invited person connect?
            <select value={mergeMode} onChange={(event) => setMergeMode(event.target.value)}>
              <option value="match">They are the same person as someone in my tree</option>
              <option value="add-as-parent">Add them as a parent of someone in my tree</option>
            </select>
          </label>
          <label className="branch-import-field">How should this family be connected?
            <select value={linkMode} onChange={(event) => setLinkMode(event.target.value)}>
              <option value="live">Live link · refresh details and relationships later</option>
              <option value="copy">Copy once · keep a snapshot in my tree</option>
            </select>
          </label>
          <label className="branch-import-field">{mergeMode === 'match' ? 'Match the invited person to someone in your tree' : 'Choose their child in your tree'}
            <input
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={targetOpen}
              aria-controls="merge-target-options"
              aria-activedescendant={targetOpen && filteredPeople[activeTargetIndex] ? `merge-target-${filteredPeople[activeTargetIndex].id}` : undefined}
              value={targetQuery}
              onFocus={(event) => {
                event.currentTarget.select();
                setTargetOpen(true);
              }}
              onBlur={() => setTargetOpen(false)}
              onChange={(event) => {
                setTargetQuery(event.target.value);
                setTargetId('');
                setActiveTargetIndex(0);
                setTargetOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setTargetOpen(true);
                  setActiveTargetIndex((index) => Math.min(index + 1, Math.max(filteredPeople.length - 1, 0)));
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setTargetOpen(true);
                  setActiveTargetIndex((index) => Math.max(index - 1, 0));
                } else if (event.key === 'Enter' && targetOpen && filteredPeople[activeTargetIndex]) {
                  event.preventDefault();
                  chooseTarget(filteredPeople[activeTargetIndex]);
                } else if (event.key === 'Escape') {
                  setTargetOpen(false);
                }
              }}
              placeholder="Search by name or birth date…"
              aria-label={mergeMode === 'match' ? 'Search people to match' : 'Search for their child'}
            />
            {targetOpen && <div className="merge-target-options" id="merge-target-options" role="listbox">
              {filteredPeople.length ? filteredPeople.map((person, index) => <div
                key={person.id}
                id={`merge-target-${person.id}`}
                className={`merge-target-option${index === activeTargetIndex ? ' active' : ''}${person.id === targetId ? ' selected' : ''}`}
                role="option"
                aria-selected={person.id === targetId}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveTargetIndex(index)}
                onClick={() => chooseTarget(person)}
              >
                <span>{fullName(person)}</span>
                {person.birthDate && <small>Born {String(person.birthDate).slice(0, 10)}</small>}
              </div>) : <span className="branch-import-search-empty">No people match that search.</span>}
            </div>}
          </label>
          {error && <p className="relationship-error" role="alert">{error}</p>}
          <div>
            <button type="button" onClick={onClosePreview} disabled={isAccepting}>Cancel</button>
            <button type="button" className="arrange-action" onClick={() => onAccept(targetId, mergeMode, linkMode)} disabled={isAccepting || !targetId}>
              {isAccepting ? 'Merging…' : linkMode === 'live' ? 'Accept with live link' : 'Accept and copy once'}
            </button>
          </div>
        </>}
      </div>
    </div>}
  </>;
}
