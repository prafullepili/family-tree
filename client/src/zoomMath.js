export const MIN_CANVAS_ZOOM = 0.1;
export const ZOOM_STEP_FACTOR = 1.2;

export function stepCanvasZoom(currentZoom, direction, maxZoom) {
  const factor = direction > 0 ? ZOOM_STEP_FACTOR : 1 / ZOOM_STEP_FACTOR;
  const nextZoom = Number((currentZoom * factor).toFixed(6));
  return Math.max(MIN_CANVAS_ZOOM, Math.min(maxZoom, nextZoom));
}
