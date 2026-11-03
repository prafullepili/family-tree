import { useEffect, useRef, useState } from 'react';
import { storageGet, storageSet } from './appHelpers.js';

export default function useDetailsPanelResize() {
  const [detailsWidth, setDetailsWidth] = useState(() => {
    const saved = Number(storageGet('kinfolk-details-width'));
    return Number.isFinite(saved) && saved >= 286 && saved <= 620 ? saved : 390;
  });
  const detailsResize = useRef(null);
  useEffect(() => {
    storageSet('kinfolk-details-width', String(detailsWidth));
  }, [detailsWidth]);
  function beginDetailsResize(event) {
    if (window.innerWidth <= 1050) return;
    event.preventDefault();
    detailsResize.current = { startX: event.clientX, startWidth: detailsWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDetailsResize(event) {
    if (!detailsResize.current) return;
    setDetailsWidth(Math.max(286, Math.min(620, detailsResize.current.startWidth + detailsResize.current.startX - event.clientX)));
  }
  function endDetailsResize() {
    detailsResize.current = null;
  }
  function handleDetailsResizeKey(event) {
    const delta = event.key === 'ArrowLeft' ? 16 : event.key === 'ArrowRight' ? -16 : 0;
    if (delta) {
      event.preventDefault();
      setDetailsWidth((width) => Math.max(286, Math.min(620, width + delta)));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setDetailsWidth(event.key === 'Home' ? 286 : 620);
    }
  }
  return { detailsWidth, beginDetailsResize, moveDetailsResize, endDetailsResize, handleDetailsResizeKey };
}

