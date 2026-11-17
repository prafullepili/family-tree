import { preparePersonPhoto } from './personPhotos.js';

let segmenterPromise;
async function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const asset = (name) => `${import.meta.env.BASE_URL}background-removal/${name}`;
      return ImageSegmenter.createFromOptions({
        wasmLoaderPath: asset('vision_wasm_internal.js'),
        wasmBinaryPath: asset('vision_wasm_internal.wasm'),
      }, {
        baseOptions: { modelAssetPath: asset('selfie_segmenter.tflite'), delegate: 'CPU' },
        runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false,
      });
    })().catch((error) => { segmenterPromise = null; throw error; });
  }
  return segmenterPromise;
}

export function applyPersonMask(pixels, width, height, mask, maskWidth, maskHeight) {
  let visible = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const confidence = mask[Math.min(maskHeight - 1, Math.floor(y * maskHeight / height)) * maskWidth + Math.min(maskWidth - 1, Math.floor(x * maskWidth / width))];
      const alpha = Math.max(0, Math.min(1, (confidence - .25) / .5));
      const offset = (y * width + x) * 4 + 3;
      pixels[offset] = Math.round(pixels[offset] * alpha * alpha * (3 - 2 * alpha));
      if (pixels[offset] > 127) visible++;
    }
  }
  if (visible < width * height * .01) throw Error('No person was detected. Try a clearer photo of one person.');
}

export async function removePhotoBackground(file) {
  // Decode a resized local blob. Neither the image nor the mask is uploaded.
  const prepared = await preparePersonPhoto(file);
  const source = URL.createObjectURL(prepared);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(Error('Could not open this photo.')); image.src = source; });
    const segmenter = await getSegmenter();
    // Give the browser a frame to display the processing state before inference.
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw Error('This browser could not process the photo.');
    context.drawImage(image, 0, 0);
    segmenter.segment(image, (result) => {
      const masks = result.confidenceMasks;
      const mask = masks?.length === 1 ? masks[0] : masks?.[1];
      if (!mask) throw Error('Background removal could not identify the person.');
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      applyPersonMask(pixels.data, canvas.width, canvas.height, mask.getAsFloat32Array(), mask.width, mask.height);
      context.putImageData(pixels, 0, 0);
    });
    const cutout = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!cutout) throw Error('Could not save the transparent photo.');
    return await preparePersonPhoto(cutout);
  } finally { URL.revokeObjectURL(source); }
}
