import { useEffect, useRef } from 'react';

export function canvasGestureHandlers({ viewport, drag, pinch, zoomValue, pendingZoom, zoomAround, maxCanvasZoom }) {
  let wheelAnchor = null;
  const limit = (value) => Math.max(0.1, Math.min(maxCanvasZoom, value));
  const distance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  return {
    wheel(event) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault(); event.stopPropagation();
      const base = pendingZoom.current?.nextZoom ?? zoomValue.current;
      const now = performance.now();
      if (!wheelAnchor || now - wheelAnchor.time > 250 || Math.hypot(event.clientX - wheelAnchor.clientX, event.clientY - wheelAnchor.clientY) > 2 || Math.abs(base - wheelAnchor.zoom) > 0.0001) {
        const rect = viewport.querySelector('.tree-board')?.getBoundingClientRect();
        wheelAnchor = rect ? { x: (event.clientX - rect.left) / zoomValue.current, y: (event.clientY - rect.top) / zoomValue.current, clientX: event.clientX, clientY: event.clientY } : null;
      }
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      const next = limit(base * Math.exp(-delta * 0.01));
      if (wheelAnchor) { wheelAnchor.time = now; wheelAnchor.zoom = next; }
      zoomAround(event.clientX, event.clientY, next, wheelAnchor);
    },
    touchstart(event) {
      if (event.touches.length !== 2) return;
      const [a, b] = event.touches;
      const span = distance(a, b);
      const rect = viewport.querySelector('.tree-board')?.getBoundingClientRect();
      if (!rect || span < 1) return;
      if (event.cancelable) event.preventDefault();
      wheelAnchor = null;
      drag.current = null;
      pinch.current = {
        distance: span, zoom: zoomValue.current,
        anchor: { x: ((a.clientX + b.clientX) / 2 - rect.left) / zoomValue.current, y: ((a.clientY + b.clientY) / 2 - rect.top) / zoomValue.current },
      };
    },
    touchmove(event) {
      if (event.touches.length !== 2 || !pinch.current) return;
      if (event.cancelable) event.preventDefault();
      const [a, b] = event.touches;
      zoomAround((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, limit(pinch.current.zoom * distance(a, b) / pinch.current.distance), pinch.current.anchor);
    },
    touchend(event) {
      if (event.touches.length < 2) pinch.current = null;
    },
  };
}

export default function useCanvasGestures({ treeScroll, drag, pinch, zoomValue, pendingZoom, zoomFrame, pendingZoomAnchor, zoomAround, maxCanvasZoom }) {
  const latestZoomAround = useRef(zoomAround);
  latestZoomAround.current = zoomAround;
  useEffect(() => {
    const viewport = treeScroll.current;
    if (!viewport) return undefined;
    const handlers = canvasGestureHandlers({ viewport, drag, pinch, zoomValue, pendingZoom, maxCanvasZoom, zoomAround: (...args) => latestZoomAround.current(...args) });
    const entries = [...Object.entries(handlers), ['touchcancel', handlers.touchend]];
    for (const [event, handler] of entries) viewport.addEventListener(event, handler, { passive: false });
    return () => {
      for (const [event, handler] of entries) viewport.removeEventListener(event, handler);
      if (zoomFrame.current) cancelAnimationFrame(zoomFrame.current);
      zoomFrame.current = 0; pendingZoom.current = null; pendingZoomAnchor.current = null; pinch.current = null;
    };
  }, [treeScroll, drag, pinch, zoomValue, pendingZoom, zoomFrame, pendingZoomAnchor, maxCanvasZoom]);
}
