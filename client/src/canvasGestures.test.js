import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasGestureHandlers } from './useCanvasGestures.js';
import { positionZoomAnchor } from './useCanvasZoomViewport.js';
import createCanvasNavigation from './createCanvasNavigation.js';

test('zoom anchor scroll correction is synchronous and respects scroll bounds', () => {
  const viewport = {
    scrollLeft: 100, scrollTop: 50, scrollWidth: 2000, scrollHeight: 1500, clientWidth: 600, clientHeight: 400,
    querySelector: () => ({ getBoundingClientRect: () => ({ left: 70 - viewport.scrollLeft, top: 40 - viewport.scrollTop }) }),
  };
  positionZoomAnchor(viewport, { x: 200, y: 100, clientX: 150, clientY: 90 }, 1.5);
  assert.equal(70 - viewport.scrollLeft + 200 * 1.5, 150);
  assert.equal(40 - viewport.scrollTop + 100 * 1.5, 90);
  positionZoomAnchor(viewport, { x: 0, y: 0, clientX: 10000, clientY: 10000 }, 1);
  assert.equal(viewport.scrollLeft, 0); assert.equal(viewport.scrollTop, 0);
});

function setup() {
  const calls = [], drag = { current: { id: 'person' } }, pinch = { current: null }, zoomValue = { current: 1 }, pendingZoom = { current: null };
  const viewport = { clientHeight: 500, querySelector: () => ({ getBoundingClientRect: () => ({ left: 20, top: 30 }) }) };
  const handlers = canvasGestureHandlers({ viewport, drag, pinch, zoomValue, pendingZoom, maxCanvasZoom: 2, zoomAround: (...args) => calls.push(args) });
  return { calls, drag, pinch, zoomValue, pendingZoom, handlers };
}

test('wheel bursts keep a fixed world point and accumulate queued zoom changes', () => {
  const { handlers, calls, pendingZoom, zoomValue } = setup();
  const event = { ctrlKey: true, clientX: 220, clientY: 130, deltaY: -3, deltaMode: 0, preventDefault() {}, stopPropagation() {} };
  handlers.wheel(event);
  pendingZoom.current = { nextZoom: calls[0][2] };
  handlers.wheel(event);
  assert.ok(calls[1][2] > calls[0][2]);
  assert.equal(calls[0][3].x, 200); assert.equal(calls[1][3].x, 200);
  assert.equal(calls[1][3].y, 100);
  zoomValue.current = 2; pendingZoom.current = null;
  handlers.wheel(event); assert.equal(calls.at(-1)[2], 2);
  handlers.wheel({ ...event, ctrlKey: false }); assert.equal(calls.length, 3);
});

test('pinch keeps its initial world anchor while the finger midpoint moves and cancels node dragging', () => {
  const { handlers, calls, drag, pinch } = setup();
  const event = (touches) => ({ touches, cancelable: true, preventDefault() {} });
  handlers.touchstart(event([{ clientX: 120, clientY: 130 }, { clientX: 320, clientY: 130 }]));
  assert.equal(drag.current, null);
  handlers.touchmove(event([{ clientX: 90, clientY: 150 }, { clientX: 390, clientY: 150 }]));
  assert.deepEqual(calls[0].slice(0, 3), [240, 150, 1.5]);
  assert.deepEqual(calls[0][3], { x: 200, y: 100 });
  handlers.touchend(event([])); assert.equal(pinch.current, null);
  handlers.touchmove(event([{ clientX: 90, clientY: 150 }, { clientX: 390, clientY: 150 }]));
  assert.equal(calls.length, 1);
});

test('zoom requests coalesce into one frame and equal-scale pinch movement still updates the anchor', (t) => {
  const frames = [];
  const previousFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  t.after(() => { if (previousFrame === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = previousFrame; });
  const viewport = { scrollLeft: 0, scrollTop: 0, scrollWidth: 2000, scrollHeight: 1500, clientWidth: 600, clientHeight: 400, querySelector: () => ({ getBoundingClientRect: () => ({ left: 20, top: 30 }) }) };
  let saves = 0;
  const refs = { treeScroll: { current: viewport }, manualZoomTouched: { current: false }, pendingZoom: { current: null }, zoomFrame: { current: 0 }, zoomValue: { current: 1 }, pendingZoomAnchor: { current: null } };
  const nav = createCanvasNavigation({ ...refs, setZoom: value => { saves++; refs.zoomValue.current = value; }, maxCanvasZoom: 2 });
  nav.zoomAround(220, 130, 1.2); nav.zoomAround(220, 130, 1.5);
  assert.equal(frames.length, 1); frames.shift()();
  assert.equal(saves, 1); assert.equal(refs.zoomValue.current, 1.5);
  assert.equal(refs.pendingZoomAnchor.current.x, 200);
  refs.pendingZoomAnchor.current = null;
  nav.zoomAround(220, 130, 1.5, { x: 200, y: 100 }); frames.shift()();
  assert.equal(saves, 1); assert.equal(viewport.scrollLeft, 100); assert.equal(viewport.scrollTop, 50);
});
