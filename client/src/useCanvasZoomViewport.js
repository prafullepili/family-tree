import { useLayoutEffect } from 'react';

export function positionZoomAnchor(viewport, anchor, zoom) {
  const board = viewport?.querySelector('.tree-board');
  if (!board) return;
  const rect = board.getBoundingClientRect();
  viewport.scrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + rect.left + anchor.x * zoom - anchor.clientX));
  viewport.scrollTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + rect.top + anchor.y * zoom - anchor.clientY));
}

export default function useCanvasZoomViewport({ treeScroll, zoom, zoomValue, pendingZoomAnchor, appliedTreeOffset, offsetX, offsetY, boardLeft, boardTop }) {
  useLayoutEffect(() => {
    zoomValue.current = zoom;
    const viewport = treeScroll.current;
    const anchor = pendingZoomAnchor.current;
    pendingZoomAnchor.current = null;
    const previous = appliedTreeOffset.current;
    appliedTreeOffset.current = { x: offsetX, y: offsetY };
    if (!viewport) return;
    // Apply the scale's anchor correction before paint. Padding compensation
    // must not also run for the same zoom commit, or the two corrections fight.
    if (anchor) positionZoomAnchor(viewport, anchor, zoom);
    else {
      viewport.scrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + offsetX - previous.x));
      viewport.scrollTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + offsetY - previous.y));
    }
  }, [treeScroll, zoom, zoomValue, pendingZoomAnchor, appliedTreeOffset, offsetX, offsetY, boardLeft, boardTop]);
}
