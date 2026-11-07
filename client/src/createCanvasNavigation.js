import { stepCanvasZoom } from './zoomMath.js';
import { flushSync } from 'react-dom';
import { positionZoomAnchor } from './useCanvasZoomViewport.js';

export default function createCanvasNavigation({
  treeScroll,
  manualZoomTouched,
  pendingZoom,
  zoomFrame,
  zoomValue,
  pendingZoomAnchor,
  setZoom,
  maxCanvasZoom,
  layoutPositions,
  minNodeX,
  maxNodeX,
  minNodeY,
  maxNodeY,
}) {
  function focusPersonInTree(id) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const viewport = treeScroll.current;
        if (!viewport) return;
        const node = [...viewport.querySelectorAll('.tree-person')].find((item) => item.dataset.personId === id);
        if (!node) return;
        const nodeRect = node.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        viewport.scrollTo({
          left: viewport.scrollLeft + nodeRect.left + nodeRect.width / 2 - viewportRect.left - viewport.clientWidth / 2,
          top: viewport.scrollTop + nodeRect.top + nodeRect.height / 2 - viewportRect.top - viewport.clientHeight / 2,
          behavior: 'smooth',
        });
      }),
    );
  }
  function zoomAround(clientX, clientY, nextZoom, fixedAnchor) {
    manualZoomTouched.current = true;
    pendingZoom.current = { clientX, clientY, nextZoom, fixedAnchor };
    if (zoomFrame.current) return;
    zoomFrame.current = requestAnimationFrame(() => {
      zoomFrame.current = 0;
      const request = pendingZoom.current;
      pendingZoom.current = null;
      if (!request) return;
      const viewport = treeScroll.current;
      const board = viewport?.querySelector('.tree-board');
      if (viewport && board) {
        const boardRect = board.getBoundingClientRect();
        pendingZoomAnchor.current = {
          x: request.fixedAnchor?.x ?? (request.clientX - boardRect.left) / zoomValue.current,
          y: request.fixedAnchor?.y ?? (request.clientY - boardRect.top) / zoomValue.current,
          clientX: request.clientX,
          clientY: request.clientY,
        };
      }
      if (Math.abs(request.nextZoom - zoomValue.current) < 0.0001) {
        if (request.fixedAnchor && pendingZoomAnchor.current) positionZoomAnchor(viewport, pendingZoomAnchor.current, zoomValue.current);
        pendingZoomAnchor.current = null;
        return;
      }
      // Commit scale and the layout-effect scroll correction in this animation
      // frame, rather than leaving a scaled-but-unanchored frame visible.
      flushSync(() => setZoom(request.nextZoom));
    });
  }
  function zoomTo(nextZoom) {
    nextZoom = Math.max(0.1, Math.min(maxCanvasZoom, nextZoom));
    const viewport = treeScroll.current;
    if (!viewport) {
      setZoom(nextZoom);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    zoomAround(rect.left + viewport.clientWidth / 2, rect.top + viewport.clientHeight / 2, nextZoom);
  }
  function stepZoom(direction) {
    const currentZoom = pendingZoom.current?.nextZoom ?? zoomValue.current;
    zoomTo(stepCanvasZoom(currentZoom, direction, maxCanvasZoom));
  }
  function fitTreeToView() {
    if (zoomFrame.current) cancelAnimationFrame(zoomFrame.current);
    zoomFrame.current = 0; pendingZoom.current = null; pendingZoomAnchor.current = null;
    manualZoomTouched.current = true;
    const viewport = treeScroll.current;
    if (!viewport) return;
    const fittedZoom = Math.min(1, maxCanvasZoom);
    zoomValue.current = fittedZoom;
    setZoom(fittedZoom);
    requestAnimationFrame(() => {
      const board = viewport.querySelector('.tree-board');
      const boardRect = board?.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      if (!boardRect || !layoutPositions.length) return;
      const centerX = (minNodeX + maxNodeX) / 2;
      const centerY = (minNodeY + maxNodeY) / 2;
      const targetX = viewportRect.left + viewport.clientWidth / 2;
      const targetY = viewportRect.top + viewport.clientHeight / 2;
      viewport.scrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + boardRect.left + centerX * fittedZoom - targetX));
      viewport.scrollTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + boardRect.top + centerY * fittedZoom - targetY));
    });
  }
  return { focusPersonInTree, zoomAround, zoomTo, stepZoom, fitTreeToView };
}

