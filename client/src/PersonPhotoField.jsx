import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Scissors, Undo2, X } from 'lucide-react';
import { personPhotoSrc, preparePersonPhoto } from './personPhotos.js';
import { apiFetch } from './apiClient.js';
import PhotoCropper from './PhotoCropper.jsx';

export default function PersonPhotoField({ photoUrl, file, onFileChange, onUrlChange, preparing, onPreparingChange, disabled }) {
  const input = useRef(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const [original, setOriginal] = useState(null);
  const [notice, setNotice] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const operation = useRef(0);
  useEffect(() => () => { operation.current++; }, []);
  useEffect(() => {
    if (!file) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function choose(event) {
    const picked = event.target.files?.[0]; event.target.value = '';
    if (!picked) return;
    const current = ++operation.current;
    let choosingCrop = false;
    setError(''); onPreparingChange(true);
    try {
      const prepared = await preparePersonPhoto(picked);
      if (current !== operation.current) return;
      setPendingPhoto(prepared); choosingCrop = true;
    }
    catch (e) { if (current === operation.current) setError(e.message); }
    finally { if (current === operation.current && !choosingCrop) onPreparingChange(false); }
  }
  async function removeBackground() {
    const current = ++operation.current;
    const before = { file, photoUrl };
    setError(''); setNotice(''); setRemoving(true); onPreparingChange(true);
    try {
      let selected = file;
      if (!selected) {
        const response = photoUrl?.startsWith('/api/photos/') ? await apiFetch(personPhotoSrc(photoUrl)) : await fetch(personPhotoSrc(photoUrl), { credentials: 'omit', mode: 'cors' });
        if (!response.ok) throw Error('Could not read the photo. Choose it from your device instead.');
        selected = await response.blob();
      }
      const { removePhotoBackground } = await import('./removePhotoBackground.js');
      const cutout = await removePhotoBackground(selected);
      if (current !== operation.current) return;
      setOriginal(before); onFileChange(cutout);
      setNotice('Background removed. Check the preview, then save the person to keep it.');
    } catch (e) {
      if (current === operation.current) setError(/fetch/i.test(e.message) ? 'This photo cannot be read from its URL. Choose it from your device instead.' : e.message || 'Could not remove the background. Your original photo is unchanged.');
    } finally {
      if (current === operation.current) { setRemoving(false); onPreparingChange(false); }
    }
  }
  const source = preview || personPhotoSrc(photoUrl);
  return <section className="person-photo-field" aria-label="Profile photo" aria-busy={preparing}>
    <div className="person-photo-upload-row">
      <div className="person-photo-preview">{source ? <img src={source} crossOrigin={photoUrl?.startsWith('/api/photos/') && !preview ? 'use-credentials' : undefined} alt="Profile preview" /> : <Camera size={22} aria-hidden="true" />}</div>
      <div className="person-photo-upload-actions">
        <button type="button" onClick={() => input.current?.click()} disabled={disabled || preparing}><ImagePlus size={14} />{pendingPhoto ? 'Photo selection open' : preparing && !removing ? 'Preparing photo…' : source ? 'Change photo' : 'Choose photo'}</button>
        {source && <div className="photo-background-actions">
          <button type="button" disabled={disabled || preparing || Boolean(original)} onClick={removeBackground}><Scissors size={14}/>{removing ? 'Removing background…' : 'Remove background'}</button>
          {original && <button type="button" disabled={disabled || preparing} onClick={() => { onFileChange(original.file); onUrlChange(original.photoUrl); setOriginal(null); setNotice('Original photo restored.'); setError(''); }}><Undo2 size={14}/>Undo</button>}
        </div>}
        <small>From your phone or computer · JPG, PNG, WebP · up to 10 MB</small>
        <small>Background removal runs on your device. First use downloads the tool.</small>
      </div>
      {source && <button type="button" className="plain-icon" aria-label="Remove photo" disabled={disabled || preparing} onClick={() => { onFileChange(null); onUrlChange(''); setError(''); setOriginal(null); setNotice(''); }}><X size={16} /></button>}
    </div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} disabled={disabled || preparing} hidden aria-label="Choose a photo from your device" />
    {pendingPhoto && <PhotoCropper file={pendingPhoto} disabled={disabled} onCancel={() => {setPendingPhoto(null);onPreparingChange(false);}} onApply={(selected) => {onFileChange(selected);setOriginal(null);setNotice('Photo selected. Save the person to keep it.');setPendingPhoto(null);onPreparingChange(false);}}/>}
    {!file && <label className="photo-url"><Camera size={15} /><span>Or photo URL</span><input type="url" value={photoUrl?.startsWith('/api/photos/') ? '' : photoUrl} onChange={(event) => { onUrlChange(event.target.value); setOriginal(null); setNotice(''); }} placeholder={photoUrl?.startsWith('/api/photos/') ? 'Uploaded photo selected' : 'https://…'} disabled={disabled || preparing} /></label>}
    {notice && <p className="photo-processing-notice" role="status">{notice}</p>}
    {error && <p className="relationship-error" role="alert">{error}</p>}
  </section>;
}
