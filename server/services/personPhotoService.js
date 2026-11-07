import mongoose from 'mongoose';

export const MAX_PHOTO_BYTES = 1024 * 1024;
export const photoBucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'personPhotos' });
export const photoPath = (id) => `/api/photos/${id}`;

export function detectPhotoType(bytes) {
  if (!Buffer.isBuffer(bytes)) return null;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function validatePhotoReference(url, treeId) {
  if (typeof url !== 'string' || !url.startsWith('/api/photos')) return;
  const match = /^\/api\/photos\/([a-f\d]{24})$/i.exec(url);
  const file =
    match &&
    (await photoBucket()
      .find({ _id: new mongoose.Types.ObjectId(match[1]), 'metadata.treeId': treeId })
      .next());
  if (!file) throw Object.assign(Error('Choose a photo uploaded to this family tree.'), { name: 'ValidationError' });
}
