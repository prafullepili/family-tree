import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { personPhotoSrc, preparePersonPhoto } from './personPhotos.js';

export default function PersonPhotoField({ photoUrl, file, onFileChange, onUrlChange, preparing, onPreparingChange, disabled }) {
  const input = useRef(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function choose(event) {
    const picked = event.target.files?.[0]; event.target.value = '';
    if (!picked) return;
    setError(''); onPreparingChange(true);
    try { onFileChange(await preparePersonPhoto(picked)); }
    catch (e) { setError(e.message); }
    finally { onPreparingChange(false); }
  }
  const source = preview || personPhotoSrc(photoUrl);
  return <section className="person-photo-field" aria-label="Profile photo" aria-busy={preparing}>
    <div className="person-photo-upload-row">
      <div className="person-photo-preview">{source ? <img src={source} crossOrigin={photoUrl?.startsWith('/api/photos/') && !preview ? 'use-credentials' : undefined} alt="Profile preview" /> : <Camera size={22} aria-hidden="true" />}</div>
      <div className="person-photo-upload-actions">
        <button type="button" onClick={() => input.current?.click()} disabled={disabled || preparing}><ImagePlus size={14} />{preparing ? 'Preparing photo…' : source ? 'Change photo' : 'Choose photo'}</button>
        <small>From your phone or computer · JPG, PNG, WebP · up to 10 MB</small>
        <small>Photos are resized before saving.</small>
      </div>
      {source && <button type="button" className="plain-icon" aria-label="Remove photo" disabled={disabled || preparing} onClick={() => { onFileChange(null); onUrlChange(''); setError(''); }}><X size={16} /></button>}
    </div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} disabled={disabled || preparing} hidden aria-label="Choose a photo from your device" />
    {!file && <label className="photo-url"><Camera size={15} /><span>Or photo URL</span><input type="url" value={photoUrl?.startsWith('/api/photos/') ? '' : photoUrl} onChange={(event) => onUrlChange(event.target.value)} placeholder={photoUrl?.startsWith('/api/photos/') ? 'Uploaded photo selected' : 'https://…'} disabled={disabled || preparing} /></label>}
    {error && <p className="relationship-error" role="alert">{error}</p>}
  </section>;
}
