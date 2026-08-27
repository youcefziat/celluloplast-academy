import { AppError, ErrorCodes } from '@api/utils/errors';
import { MAX_IMAGE_SIZE } from '@api/constants/upload';

import { ALLOWED_IMAGE_TYPES } from '@cio/utils/validation';
import { getStorageConfig } from '@cio/core/config/storage';
import { generateFileKey } from '@cio/core/utils/upload';
import { uploadToS3 } from '@cio/core/utils/s3';

const EXTENSION_CONTENT_TYPES: Record<string, (typeof ALLOWED_IMAGE_TYPES)[number]> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif'
};

function resolveImageContentType(file: File): string | null {
  if (ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return file.type;
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension) {
    return null;
  }

  return EXTENSION_CONTENT_TYPES[extension] ?? null;
}

/**
 * Uploads an image file to object storage and returns the public URL
 * @param file - The image file to upload
 * @returns Object containing the public URL and file key
 */
export async function uploadImage(file: File) {
  let config;
  try {
    config = getStorageConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Object storage not configured';
    console.error('[uploadImage] storage config error:', message);
    throw new AppError(message, ErrorCodes.INTERNAL_ERROR, 500);
  }

  if (!config.mediaPublicBaseUrl) {
    throw new AppError(
      'Media public URL not configured. Set OBJECT_STORAGE_MEDIA_PUBLIC_BASE_URL or CLOUDFLARE_IMAGE_BUCKET_DOMAIN.',
      ErrorCodes.INTERNAL_ERROR,
      500
    );
  }

  const contentType = resolveImageContentType(file);
  if (!contentType) {
    throw new AppError(
      `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      ErrorCodes.VALIDATION_ERROR,
      400
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new AppError(
      `File size exceeds maximum of ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
      ErrorCodes.VALIDATION_ERROR,
      400
    );
  }

  const fileKey = generateFileKey(file.name);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadResult = await uploadToS3({
    Bucket: config.bucketMedia,
    Key: fileKey,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000'
  });

  if (!uploadResult.success) {
    console.error('[uploadImage] upload failed:', {
      bucket: config.bucketMedia,
      fileKey,
      contentType,
      error: uploadResult.error
    });
    throw new AppError(
      uploadResult.error
        ? `Failed to upload image to storage: ${uploadResult.error}`
        : 'Failed to upload image to storage',
      ErrorCodes.INTERNAL_ERROR,
      500
    );
  }

  const baseUrl = config.mediaPublicBaseUrl.replace(/\/$/, '');
  const publicUrl = `${baseUrl}/${fileKey}`;

  return {
    url: publicUrl,
    fileKey
  };
}
