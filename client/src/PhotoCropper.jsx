import { useEffect, useRef, useState } from 'react';
import { cropPersonPhoto, photoCropRect } from './photoCrop.js';

export default function PhotoCropper({ file, onApply, onCancel, disabled }) {
  const [url, setUrl] = useState('');
  const [size, setSize] = useState(null);
  const [settings, setSettings] = useState({zoom:1,x:50,y:50});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const image = useRef(null), drag = useRef(null), cancel = useRef(null), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const source = URL.createObjectURL(file); setUrl(source); cancel.current?.focus();
    return () => { alive.current = false; URL.revokeObjectURL(source); };
  }, [file]);
  const crop = size && photoCropRect(size.width, size.height, settings);
  function move(event) {
    if (!drag.current || !crop || busy || disabled) return;
    const start = drag.current;
    setSettings((current) => ({...current,
      x: Math.min(100,Math.max(0,start.x - (event.clientX-start.clientX)*crop.size/start.width/Math.max(1,size.width-crop.size)*100)),
      y: Math.min(100,Math.max(0,start.y - (event.clientY-start.clientY)*crop.size/start.width/Math.max(1,size.height-crop.size)*100)),
    }));
  }
  async function apply() {
    if (!crop || busy || disabled) return;
    setBusy(true); setError('');
    try { const result = await cropPersonPhoto(image.current,settings); if (alive.current) onApply(result); }
    catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  }
  return <section className="photo-cropper" aria-label="Crop photo" onKeyDown={(event) => {if(event.key==='Escape'&&!busy){event.preventDefault();event.stopPropagation();onCancel();}}}>
    <strong>Choose how to use this photo</strong>
    <p>Use the whole photo, or drag and zoom to crop a square portrait.</p>
    <div className="photo-crop-stage" onPointerDown={(event) => {
      if (busy || disabled || !crop) return;
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {clientX:event.clientX,clientY:event.clientY,x:settings.x,y:settings.y,width:event.currentTarget.getBoundingClientRect().width};
    }} onPointerMove={move} onPointerUp={() => {drag.current=null;}} onPointerCancel={() => {drag.current=null;}}>
      {url && <img ref={image} src={url} alt="Crop preview" draggable={false} onLoad={(event) => setSize({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} onError={() => setError('Could not open this photo. Choose another image.')} style={crop ? {width:`${size.width/crop.size*100}%`,height:`${size.height/crop.size*100}%`,left:`${-crop.x/crop.size*100}%`,top:`${-crop.y/crop.size*100}%`} : {visibility:'hidden'}}/>}
      <span className="photo-crop-grid" aria-hidden="true"/>
    </div>
    {['zoom','x','y'].map((key) => <label className="photo-crop-slider" key={key}><span>{key==='zoom'?'Zoom':key==='x'?'Horizontal':'Vertical'}</span><input aria-label={`Crop ${key==='x'?'horizontal position':key==='y'?'vertical position':'zoom'}`} type="range" min={key==='zoom'?1:0} max={key==='zoom'?4:100} step={key==='zoom'?.05:1} value={settings[key]} disabled={busy||disabled||!crop} onChange={(event) => setSettings((current)=>({...current,[key]:Number(event.target.value)}))}/></label>)}
    {error && <p role="alert" className="relationship-error">{error}</p>}
    <div className="photo-crop-actions">
      <button type="button" disabled={busy||disabled||!crop} onClick={() => onApply(file)}>Use whole photo</button>
      <button type="button" disabled={busy||disabled||!crop} onClick={apply}>{busy?'Applying…':'Apply crop'}</button>
      <button ref={cancel} type="button" disabled={busy} onClick={onCancel}>Cancel</button>
    </div>
  </section>;
}
