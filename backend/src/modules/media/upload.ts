import { MAX_UPLOAD_BYTES } from '@marketplace/contracts';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { validationError } from '../../lib/errors.js';
import { sendData } from '../../lib/http.js';
import { detectImageType } from './image-type.js';
import { storage, type ImageFolder } from './storage.js';

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 },
}).single('image');

/** Multipart field `image`: JPEG, PNG or WebP, at most 5 MB. Responds `{ publicId, url }`. */
export function imageUpload(folder: ImageFolder): RequestHandler[] {
  return [
    parser,
    async (req, res) => {
      if (!req.file) {
        throw validationError('Choose an image to upload.', [
          { field: 'image', message: 'An image file is required' },
        ]);
      }
      const type = detectImageType(req.file.buffer);
      if (!type) {
        throw validationError('Only JPEG, PNG or WebP images are allowed.', [
          { field: 'image', message: 'Unsupported file type' },
        ]);
      }
      const stored = await storage.save({ buffer: req.file.buffer, type, folder });
      sendData(res, stored, 201);
    },
  ];
}
