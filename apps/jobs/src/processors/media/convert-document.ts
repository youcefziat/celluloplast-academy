import { mkdtemp, mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { getAssetById, getJobStep, updateAsset, updateMediaJob, upsertJobStep } from '@cio/db/queries';
import { ZConvertDocumentPayload, type TConvertDocumentPayload } from '@cio/jobs/payloads/media';
import { isPowerPointDocumentMimeType } from '@cio/utils/validation/constants';

import { documentsBucket, downloadObjectToTempFile, safeUnlink, uploadFileToBucket } from '../../utils/storage';
import { errorMessage, throwIfCancelRequested } from '../../utils/cancel';
import { convertPowerPointToPdf } from '../../utils/libreoffice';
import { log } from '../../utils/logger';

const STEP_KEY = 'convert-document';
const DOMAIN = 'media';

interface DocumentConversionResult {
  bucket: string;
  pdfStorageKey: string;
  fileSizeBytes: number;
}

function toPlainMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

/** Convert an uploaded PPT/PPTX asset to a derived PDF while preserving the original object. */
export async function processConvertDocument(rawData: unknown): Promise<DocumentConversionResult> {
  const payload: TConvertDocumentPayload = ZConvertDocumentPayload.parse(rawData);
  const { mediaJobId, assetId, storageKey, actorContext } = payload;

  const existing = await getJobStep(DOMAIN, mediaJobId, STEP_KEY);
  if (existing?.status === 'completed' && existing.result) {
    log.info('convert-document-skip', { mediaJobId, reason: 'ledger-completed' });
    return existing.result as unknown as DocumentConversionResult;
  }

  await throwIfCancelRequested(mediaJobId);
  await updateMediaJob(mediaJobId, { status: 'running', stage: 'converting-document', progressPercent: 10 });
  await upsertJobStep({
    domain: DOMAIN,
    runId: mediaJobId,
    stepKey: STEP_KEY,
    status: 'running',
    startedAt: new Date().toISOString(),
    attempt: (existing?.attempt ?? 0) + 1
  });

  const asset = await getAssetById(assetId, actorContext.organizationId);
  if (!asset || asset.kind !== 'document' || !isPowerPointDocumentMimeType(asset.mimeType)) {
    throw new Error('Asset is not a supported PowerPoint document');
  }

  const sourceExtension = asset.mimeType === 'application/vnd.ms-powerpoint' ? '.ppt' : '.pptx';
  const workDirectory = await mkdtemp(path.join(tmpdir(), 'cio-powerpoint-'));
  const outputDirectory = path.join(workDirectory, 'output');
  const profileDirectory = path.join(workDirectory, 'libreoffice-profile');
  await Promise.all([mkdir(outputDirectory), mkdir(profileDirectory)]);

  let localSourcePath: string | undefined;
  try {
    localSourcePath = await downloadObjectToTempFile(documentsBucket(), storageKey, `source${sourceExtension}`);
    await updateMediaJob(mediaJobId, { progressPercent: 35 });
    await throwIfCancelRequested(mediaJobId);

    const outputPath = await convertPowerPointToPdf(localSourcePath, outputDirectory, profileDirectory);
    const outputStat = await stat(outputPath);
    const pdfStorageKey = `converted/${assetId}/document.pdf`;

    await throwIfCancelRequested(mediaJobId);
    await uploadFileToBucket(documentsBucket(), pdfStorageKey, outputPath, 'application/pdf', 'private, max-age=0');

    const result: DocumentConversionResult = {
      bucket: documentsBucket(),
      pdfStorageKey,
      fileSizeBytes: outputStat.size
    };
    const metadata = toPlainMetadata(asset.metadata);

    await updateAsset(assetId, actorContext.organizationId, {
      metadata: {
        ...metadata,
        documentProcessing: {
          status: 'ready',
          pdfStorageKey,
          convertedAt: new Date().toISOString(),
          fileSizeBytes: outputStat.size
        }
      }
    });
    await upsertJobStep({
      domain: DOMAIN,
      runId: mediaJobId,
      stepKey: STEP_KEY,
      status: 'completed',
      finishedAt: new Date().toISOString(),
      result: result as unknown as Record<string, unknown>
    });
    await updateMediaJob(mediaJobId, {
      status: 'completed',
      stage: 'document-ready',
      progressPercent: 100,
      result: result as unknown as Record<string, unknown>
    });

    log.info('convert-document-done', { mediaJobId, assetId, pdfStorageKey, fileSizeBytes: outputStat.size });
    return result;
  } catch (error) {
    log.error('convert-document-failed', { mediaJobId, assetId, error: errorMessage(error) });
    await upsertJobStep({
      domain: DOMAIN,
      runId: mediaJobId,
      stepKey: STEP_KEY,
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error: { code: 'DOCUMENT_CONVERSION_FAILED', message: errorMessage(error) }
    });
    throw error;
  } finally {
    await safeUnlink(localSourcePath);
    await rm(workDirectory, { recursive: true, force: true });
  }
}
