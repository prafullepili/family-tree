import { preparePersonPhoto } from './personPhotos.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
export function photoCropRect(width, height, { zoom = 1, x = 50, y = 50 } = {}) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw Error('The photo has invalid dimensions.');
  const size = Math.min(width, height) / clamp(zoom, 1, 4);
  return { x: (width - size) * clamp(x, 0, 100) / 100, y: (height - size) * clamp(y, 0, 100) / 100, size };
}

export async function cropPersonPhoto(image, settings) {
  const crop = photoCropRect(image.naturalWidth, image.naturalHeight, settings);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(1024, Math.round(crop.size));
  const context = canvas.getContext('2d');
  if (!context) throw Error('This browser could not crop the photo.');
  context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw Error('Could not create the cropped photo.');
  return preparePersonPhoto(blob);
}
