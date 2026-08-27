import { AppError, ErrorCodes, handleError, type ErrorResponse } from '@api/utils/errors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { Hono } from '@api/utils/hono';
import { authMiddleware } from '@api/middlewares/auth';
import { uploadImage } from '@api/services/media';

export const mediaRouter = new Hono().post('/image', authMiddleware, async (c) => {
  try {
    const body = await c.req.parseBody();

    const file = body.file;

    if (!file || !(file instanceof File)) {
      throw new AppError('No file provided', ErrorCodes.VALIDATION_ERROR, 400);
    }

    const result = await uploadImage(file);

    return c.json({
      success: true,
      url: result.url,
      fileKey: result.fileKey,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Error in route:', error);

    // Prefer AppError messages for upload failures so clients see storage/config hints
    // instead of a generic "Failed to upload image" when status is 500.
    if (error instanceof AppError) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: error.message,
          code: error.code,
          field: error.field
        },
        error.statusCode as ContentfulStatusCode
      );
    }

    return handleError(c, error, 'Failed to upload image');
  }
});
