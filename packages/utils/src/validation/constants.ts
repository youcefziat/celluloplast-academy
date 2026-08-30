import { QUESTION_TYPE_IDS } from '@cio/question-types';

/**
 * Validation Constants
 *
 * Shared constants used across validation schemas.
 * These should match the constants in the API.
 */

export const ALLOWED_CONTENT_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-powerpoint' // .ppt
] as const;

export type AllowedDocumentMimeType = (typeof ALLOWED_DOCUMENT_TYPES)[number];
export type LessonDocumentType = 'pdf' | 'docx' | 'doc' | 'pptx' | 'ppt';
export type DocumentProcessingStatus = 'processing' | 'ready' | 'failed';

export const POWERPOINT_DOCUMENT_TYPES = [
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint'
] as const satisfies readonly AllowedDocumentMimeType[];

const DOCUMENT_TYPE_BY_MIME_TYPE: Record<AllowedDocumentMimeType, LessonDocumentType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt'
};

export function getDocumentTypeFromMimeType(mimeType: AllowedDocumentMimeType): LessonDocumentType {
  return DOCUMENT_TYPE_BY_MIME_TYPE[mimeType];
}

export function getDocumentFileExtension(fileName: string): string {
  const extensionSeparatorIndex = fileName.lastIndexOf('.');

  if (extensionSeparatorIndex === -1) {
    return '';
  }

  return fileName
    .slice(extensionSeparatorIndex + 1)
    .trim()
    .toLowerCase();
}

export function isDocumentFileNameCompatibleWithMimeType(fileName: string, mimeType: AllowedDocumentMimeType): boolean {
  return getDocumentFileExtension(fileName) === getDocumentTypeFromMimeType(mimeType);
}

export function isPowerPointDocumentMimeType(mimeType: string | null | undefined): boolean {
  return POWERPOINT_DOCUMENT_TYPES.some((allowedType) => allowedType === mimeType);
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'] as const;

/**
 * Question Type Constants
 * These match canonical question type ids.
 */
export const QUESTION_TYPE = QUESTION_TYPE_IDS;
