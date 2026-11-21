import { randomUUID } from 'node:crypto';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import { serviceUnavailable, validationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import type { ImageType } from './image-type.js';

export type ImageFolder = 'products' | 'shops';

export interface StoredImage {
  publicId: string;
  url: string;
}

export interface ImageStorage {
  readonly driver: 'local' | 'cloudinary';
  save(input: { buffer: Buffer; type: ImageType; folder: ImageFolder }): Promise<StoredImage>;
  /** The public URL is always derived on the server; clients only ever send the id. */
  urlFor(publicId: string): string;
  /** True only for ids this storage issued for the given folder. */
  isOwnImage(publicId: string, folder: ImageFolder): Promise<boolean>;
}

const LOCAL_ID = /^(products|shops)\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Development driver: files on local disk, served by the API under /uploads. */
export class LocalImageStorage implements ImageStorage {
  readonly driver = 'local' as const;

  constructor(
    private readonly root: string,
    private readonly publicBase = '/uploads',
  ) {}

  async save({ buffer, type, folder }: { buffer: Buffer; type: ImageType; folder: ImageFolder }) {
    const publicId = `${folder}/${randomUUID()}.${type.ext}`;
    const target = path.join(this.root, publicId);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer, { flag: 'wx' });
    return { publicId, url: this.urlFor(publicId) };
  }

  urlFor(publicId: string): string {
    return `${this.publicBase}/${publicId}`;
  }

  async isOwnImage(publicId: string, folder: ImageFolder): Promise<boolean> {
    if (!LOCAL_ID.test(publicId) || !publicId.startsWith(`${folder}/`)) return false;
    try {
      await access(path.join(this.root, publicId));
      return true;
    } catch {
      return false;
    }
  }
}

/** Production driver: Cloudinary keeps files across deploys and serves them from its CDN. */
export class CloudinaryImageStorage implements ImageStorage {
  readonly driver = 'cloudinary' as const;

  constructor(
    config: { cloudName: string; apiKey: string; apiSecret: string },
    private readonly rootFolder: string,
  ) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  save({ buffer, folder }: { buffer: Buffer; type: ImageType; folder: ImageFolder }) {
    return new Promise<StoredImage>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${this.rootFolder}/${folder}`,
          resource_type: 'image',
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error || !result) {
            logger.error({ err: error }, 'Cloudinary upload failed');
            reject(serviceUnavailable('The image could not be uploaded. Please try again.'));
            return;
          }
          resolve({ publicId: result.public_id, url: this.urlFor(result.public_id) });
        },
      );
      stream.end(buffer);
    });
  }

  urlFor(publicId: string): string {
    return cloudinary.url(publicId, {
      secure: true,
      transformation: [{ fetch_format: 'auto', quality: 'auto' }],
    });
  }

  async isOwnImage(publicId: string, folder: ImageFolder): Promise<boolean> {
    const prefix = `${this.rootFolder}/${folder}/`;
    return publicId.startsWith(prefix) && /^[A-Za-z0-9_-]+$/.test(publicId.slice(prefix.length));
  }
}

function createStorage(): ImageStorage {
  if (env.STORAGE_DRIVER === 'cloudinary') {
    return new CloudinaryImageStorage(
      {
        // Presence is enforced by the environment schema.
        cloudName: env.CLOUDINARY_CLOUD_NAME ?? '',
        apiKey: env.CLOUDINARY_API_KEY ?? '',
        apiSecret: env.CLOUDINARY_API_SECRET ?? '',
      },
      env.CLOUDINARY_FOLDER,
    );
  }
  return new LocalImageStorage(env.LOCAL_STORAGE_DIR);
}

export const storage: ImageStorage = createStorage();

/** Rejects image ids that this server did not issue, then returns their URLs. */
export async function resolveImages(
  publicIds: string[],
  folder: ImageFolder,
  field: string,
): Promise<StoredImage[]> {
  const checks = await Promise.all(publicIds.map((id) => storage.isOwnImage(id, folder)));
  const invalidIndex = checks.indexOf(false);
  if (invalidIndex !== -1) {
    throw validationError('One of the images was not found. Please upload it again.', [
      { field, message: 'Unknown image reference' },
    ]);
  }
  return publicIds.map((publicId) => ({ publicId, url: storage.urlFor(publicId) }));
}
