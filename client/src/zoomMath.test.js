import assert from 'node:assert/strict';
import test from 'node:test';
import { MIN_CANVAS_ZOOM, stepCanvasZoom } from './zoomMath.js';

test('zoom steps are reciprocal so zooming in then out returns to the same scale', () => {
  const initialZoom = 0.14;
  const zoomedIn = stepCanvasZoom(initialZoom, 1, 2);

  assert.equal(stepCanvasZoom(zoomedIn, -1, 2), initialZoom);
});

test('zoom steps respect the canvas limits', () => {
  assert.equal(stepCanvasZoom(MIN_CANVAS_ZOOM, -1, 2), MIN_CANVAS_ZOOM);
  assert.equal(stepCanvasZoom(2, 1, 2), 2);
});
