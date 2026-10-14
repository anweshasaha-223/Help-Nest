import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import type { MediaMetadata } from '../types.ts';

const PUBLIC_UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');

// Ensure public uploads directory exists
if (!fs.existsSync(PUBLIC_UPLOADS_DIR)) {
  fs.mkdirSync(PUBLIC_UPLOADS_DIR, { recursive: true });
}

// Configure Cloudinary if environment variables are provided
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_CLOUD_NAME !== 'sample_cloud_name' &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_KEY !== '123456789012345' &&
    process.env.CLOUDINARY_API_SECRET &&
    process.env.CLOUDINARY_API_SECRET !== 'sample_cloudinary_api_secret_key'
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log('[Cloudinary] Initialized with cloud:', process.env.CLOUDINARY_CLOUD_NAME);
} else {
  console.log('[Cloudinary] Credentials not set — using local secure media storage (/public/uploads/).');
}

export function getMediaStorageStatus(): {
  provider: 'CLOUDINARY' | 'LOCAL_SECURE';
  isCloudinaryConfigured: boolean;
  cloudName?: string;
  imageLimitBytes: number;
  videoLimitBytes: number;
  maxVideoDurationSecs: number;
} {
  return {
    provider: isCloudinaryConfigured ? 'CLOUDINARY' : 'LOCAL_SECURE',
    isCloudinaryConfigured,
    cloudName: isCloudinaryConfigured ? process.env.CLOUDINARY_CLOUD_NAME : undefined,
    imageLimitBytes: 2 * 1024 * 1024, // 2 MB
    videoLimitBytes: 5 * 1024 * 1024, // 5 MB
    maxVideoDurationSecs: 10,
  };
}

export interface UploadMediaOptions {
  buffer: Buffer;
  originalFilename: string;
  mimetype: string;
  durationSeconds?: number;
}

export async function processAndStoreMedia(
  options: UploadMediaOptions
): Promise<MediaMetadata> {
  const { buffer, originalFilename, mimetype, durationSeconds } = options;
  const isVideo = mimetype.startsWith('video/');
  const resourceType = isVideo ? 'video' : 'image';

  // Strict backend size enforcement
  const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
  const MAX_VIDEO_BYTES = 5 * 1024 * 1024; // 5 MB

  if (!isVideo && buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`Image size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the strict 2 MB limit.`);
  }

  if (isVideo && buffer.length > MAX_VIDEO_BYTES) {
    throw new Error(`Video size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the strict 5 MB limit.`);
  }

  if (isVideo && typeof durationSeconds === 'number' && durationSeconds > 10.5) {
    throw new Error(`Video duration (${durationSeconds.toFixed(1)}s) exceeds the maximum 10 seconds limit.`);
  }

  const rawExt = path.extname(originalFilename).toLowerCase().replace('.', '');
  const format = rawExt || (isVideo ? 'mp4' : 'jpg');
  const safeUniqueId = `media_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

  // Attempt Cloudinary upload if configured
  if (isCloudinaryConfigured) {
    try {
      const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'helpnest_reports',
            public_id: safeUniqueId,
            resource_type: resourceType,
            format: format === 'jpeg' ? 'jpg' : format,
            overwrite: true,
          },
          (error, result) => {
            if (error || !result) {
              reject(error || new Error('Cloudinary upload stream returned empty result.'));
            } else {
              resolve(result);
            }
          }
        );
        stream.end(buffer);
      });

      return {
        id: `med-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        publicId: uploadResult.public_id,
        secureUrl: uploadResult.secure_url,
        resourceType,
        format: uploadResult.format || format,
        bytes: uploadResult.bytes || buffer.length,
        width: uploadResult.width,
        height: uploadResult.height,
        durationSeconds: uploadResult.duration || durationSeconds,
        originalFilename,
        storageProvider: 'CLOUDINARY',
        uploadedAt: new Date().toISOString(),
      };
    } catch (cloudErr: any) {
      console.warn('[Cloudinary] Cloud upload failed, falling back to local secure storage:', cloudErr?.message || cloudErr);
      // Fallback seamlessly to local secure storage
    }
  }

  // Local Secure Storage Fallback
  const safeFilename = `${safeUniqueId}.${format}`;
  const localFilePath = path.join(PUBLIC_UPLOADS_DIR, safeFilename);
  fs.writeFileSync(localFilePath, buffer);

  return {
    id: `med-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    publicId: safeUniqueId,
    secureUrl: `/uploads/${safeFilename}`,
    resourceType,
    format,
    bytes: buffer.length,
    durationSeconds: durationSeconds || (isVideo ? 10 : undefined),
    originalFilename,
    storageProvider: 'LOCAL_SECURE',
    uploadedAt: new Date().toISOString(),
  };
}
