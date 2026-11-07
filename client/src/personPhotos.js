import { apiFetch, apiUrl } from './apiClient.js';

export const personPhotoSrc = (url) => url?.startsWith('/api/photos/') ? apiUrl(url) : url;

export async function preparePersonPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw Error('Choose a JPEG, PNG, or WebP photo.');
  if (file.size > 10 * 1024 * 1024) throw Error('Choose a photo smaller than 10 MB.');
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve; image.onerror = () => reject(Error('This image could not be opened. Choose another photo.')); image.src = source;
    });
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 50000000) throw Error('This photo is too large. Choose a smaller image.');
    const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw Error('Your browser could not prepare this photo.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.7, 0.5]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= 1024 * 1024) return blob;
    }
    throw Error('This photo could not be reduced below 1 MB. Choose a smaller image.');
  } finally { URL.revokeObjectURL(source); }
}

export async function uploadPersonPhoto(file, request = apiFetch) {
  const response = await request(apiUrl('/api/photos'), { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Error(result?.error || 'Could not upload the photo. Please try again.');
  return result.photoUrl;
}

export async function discardUnusedPhoto(url, request = apiFetch) {
  if (!url?.startsWith('/api/photos/')) return;
  // The server refuses to remove a photo referenced by any saved or recycled person.
  await request(apiUrl(url), { method: 'DELETE' }).catch(() => {});
}
