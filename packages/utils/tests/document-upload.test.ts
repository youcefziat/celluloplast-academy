import { describe, expect, it } from 'vitest';

import { isUploadSizeBelowLimit, resolveUploadLimits } from '../src/config/upload-limits';
import { ZCourseDocumentPresignUrlUpload } from '../src/validation/course/course';

describe('lesson document upload limits', () => {
  it('defaults lesson documents to 50 MB without changing other upload defaults', () => {
    const limits = resolveUploadLimits({});

    expect(limits.documentMb).toBe(50);
    expect(limits.imageMb).toBe(5);
    expect(limits.videoMb).toBe(800);
    expect(limits.exerciseFileMb).toBe(2);
    expect(limits.agentDocumentMb).toBe(5);
  });

  it('accepts bytes below the cap and rejects bytes exactly at or above it', () => {
    const maxBytes = 50 * 1024 * 1024;

    expect(isUploadSizeBelowLimit(maxBytes - 1, maxBytes)).toBe(true);
    expect(isUploadSizeBelowLimit(maxBytes, maxBytes)).toBe(false);
    expect(isUploadSizeBelowLimit(maxBytes + 1, maxBytes)).toBe(false);
  });
});

describe('lesson document presign validation', () => {
  it.each([
    ['policy.pdf', 'application/pdf'],
    ['policy.doc', 'application/msword'],
    ['policy.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['policy.ppt', 'application/vnd.ms-powerpoint'],
    ['policy.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
  ] as const)('accepts %s with its canonical MIME type', (fileName, fileType) => {
    expect(ZCourseDocumentPresignUrlUpload.safeParse({ fileName, fileType, fileSize: 1024 }).success).toBe(true);
  });

  it('rejects a PowerPoint filename whose extension does not match its MIME type', () => {
    const result = ZCourseDocumentPresignUrlUpload.safeParse({
      fileName: 'policy.pptx',
      fileType: 'application/vnd.ms-powerpoint',
      fileSize: 1024
    });

    expect(result.success).toBe(false);
  });

  it('rejects macro-enabled PowerPoint formats', () => {
    const result = ZCourseDocumentPresignUrlUpload.safeParse({
      fileName: 'policy.pptm',
      fileType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      fileSize: 1024
    });

    expect(result.success).toBe(false);
  });
});
