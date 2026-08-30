import './../bootstrap';

import { Worker } from 'bullmq';

import { getAssetById, recordDeadLetterJob, updateAsset, updateMediaJob } from '@cio/db/queries';
import { JOB_NAMES, QUEUE_NAMES, createRedisConnection } from '@cio/jobs';

import { JobCanceledError, errorMessage } from '../utils/cancel';
import { env } from '../config/env';
import { log } from '../utils/logger';
import {
  processConvertDocument,
  processExtractAudio,
  processGenerateThumbnail,
  processProbeMetadata
} from '../processors/media';

const concurrency = Number.parseInt(env.MEDIA_WORKER_CONCURRENCY ?? '2', 10) || 2;
const connection = createRedisConnection();

const worker = new Worker(
  QUEUE_NAMES.media,
  async (job) => {
    log.info('media-job-start', { jobName: job.name, bullmqJobId: job.id, attempt: job.attemptsMade + 1 });

    switch (job.name) {
      case JOB_NAMES.media.probeMetadata:
        return processProbeMetadata(job.data);
      case JOB_NAMES.media.generateThumbnail:
        return processGenerateThumbnail(job.data);
      case JOB_NAMES.media.extractAudio:
        return processExtractAudio(job.data);
      case JOB_NAMES.media.convertDocument:
        return processConvertDocument(job.data);
      default:
        throw new Error(`Unknown media job: ${job.name}`);
    }
  },
  { connection, concurrency }
);

worker.on('failed', async (job, err) => {
  if (!job) return;

  if (err instanceof JobCanceledError) {
    log.warn('media-job-canceled', { jobName: job.name, bullmqJobId: job.id });
    await updateMediaJob(err.mediaJobId, {
      status: 'canceled',
      stage: 'canceled',
      error: { code: 'CANCELED', message: 'Run canceled by user' }
    });
    if (job.name === JOB_NAMES.media.convertDocument) {
      await markDocumentConversionFailed(job.data, 'CANCELED');
    }
    return;
  }

  log.error('media-job-failed', {
    jobName: job.name,
    bullmqJobId: job.id,
    attempt: job.attemptsMade,
    error: errorMessage(err)
  });

  const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
  if (!isFinalAttempt) return;

  const data = job.data as { mediaJobId?: string; assetId?: string; actorContext?: { organizationId?: string } };
  if (data?.mediaJobId) {
    await updateMediaJob(data.mediaJobId, {
      status: 'failed',
      stage: 'failed',
      error: { code: 'WORKER_EXHAUSTED_RETRIES', message: errorMessage(err) }
    });
  }

  if (job.name === JOB_NAMES.media.convertDocument) {
    await markDocumentConversionFailed(job.data, 'WORKER_EXHAUSTED_RETRIES');
  }

  await recordDeadLetterJob({
    organizationId: data?.actorContext?.organizationId ?? null,
    domain: 'media',
    runId: data?.mediaJobId ?? null,
    queueName: QUEUE_NAMES.media,
    jobName: job.name,
    bullmqJobId: job.id ?? null,
    payload: job.data as Record<string, unknown>,
    error: { code: 'WORKER_EXHAUSTED_RETRIES', message: errorMessage(err), stack: err.stack },
    attempts: job.attemptsMade
  });
});

async function markDocumentConversionFailed(rawData: unknown, errorCode: string): Promise<void> {
  const data = rawData as { assetId?: string; actorContext?: { organizationId?: string } };
  const assetId = data.assetId;
  const organizationId = data.actorContext?.organizationId;
  if (!assetId || !organizationId) {
    return;
  }

  try {
    const asset = await getAssetById(assetId, organizationId);
    const metadata =
      asset?.metadata && typeof asset.metadata === 'object' && !Array.isArray(asset.metadata)
        ? (asset.metadata as Record<string, unknown>)
        : {};

    await updateAsset(assetId, organizationId, {
      metadata: {
        ...metadata,
        documentProcessing: {
          status: 'failed',
          errorCode,
          failedAt: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    log.error('document-conversion-status-update-failed', { assetId, error: errorMessage(error) });
  }
}

worker.on('ready', () => log.info('media-worker-ready', { concurrency, queue: QUEUE_NAMES.media }));
worker.on('error', (err) => log.error('media-worker-error', { error: errorMessage(err) }));

const shutdown = async (signal: string) => {
  log.info('media-worker-shutdown', { signal });
  await worker.close();
  await connection.quit();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
