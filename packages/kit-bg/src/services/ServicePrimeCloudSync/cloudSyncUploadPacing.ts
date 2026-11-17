import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export const CLOUD_SYNC_UPLOAD_BATCH_INTERVAL_MS = 200;

// Pace only consecutive chunks of one upload, not its first chunk or flush.
export async function waitForCloudSyncUploadBatch({
  previousBatchStartedAt,
  signal,
}: {
  previousBatchStartedAt: number | undefined;
  signal?: AbortSignal;
}): Promise<void> {
  const cancelled = () => new OneKeyLocalError('Cloud sync was cancelled');
  if (signal?.aborted) throw cancelled();
  if (previousBatchStartedAt === undefined) return;
  // A backwards wall-clock adjustment must not create an unbounded delay.
  const elapsed = Math.max(0, Date.now() - previousBatchStartedAt);
  const delay = CLOUD_SYNC_UPLOAD_BATCH_INTERVAL_MS - elapsed;
  if (delay <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, delay);
    function abort() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(cancelled());
    }
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}
