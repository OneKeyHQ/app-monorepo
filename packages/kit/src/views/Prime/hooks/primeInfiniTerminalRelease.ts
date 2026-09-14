/* cspell:ignore Infini */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IPrimeInfiniPendingPaymentSession } from '@onekeyhq/shared/types/prime/primeTypes';

import type { IPrimeInfiniPaymentSessionRevision } from './primeInfiniPaymentReplacement';

type ISessionPersistenceQueue = {
  persist<T>(task: () => Promise<T>): Promise<T | undefined>;
  finalize<T>(task: () => Promise<T>): Promise<T | undefined>;
};

// Reads the stored session revision that a terminal release will later be
// checked against. Runs through the persistence queue so a local write already
// in flight is included, and swallows failures: only the closed-unpaid branch
// consumes this, so a failed read must not break an ordinary replacement that
// never needed it. A missing revision is safe because the database layer fails
// closed on it.
export async function capturePrimeInfiniSessionRevision({
  queue,
  fetchPersistedSession,
  onError,
}: {
  queue: ISessionPersistenceQueue;
  fetchPersistedSession: () => Promise<
    IPrimeInfiniPendingPaymentSession | undefined
  >;
  onError?: (error: unknown) => void;
}): Promise<IPrimeInfiniPaymentSessionRevision | undefined> {
  const persistedSession = await queue
    .persist(async () => fetchPersistedSession())
    .catch((error) => {
      onError?.(error);
      return undefined;
    });
  if (!persistedSession) {
    return undefined;
  }
  return {
    updatedAt: persistedSession.updatedAt,
    sendStarted: persistedSession.sendStarted,
  };
}

// Releases an invoice the server closed with nothing collected. The refusal has
// to leave the queue usable: finalize() only clears its finalized flag when the
// task rejects, so returning normally would pin the queue and make the caller's
// fallback to tracking the payment fail on a finalized queue instead of
// resuming polling.
export async function releasePrimeInfiniTerminalSession({
  queue,
  discardTerminalSession,
}: {
  queue: ISessionPersistenceQueue;
  discardTerminalSession: () => Promise<boolean>;
}): Promise<boolean> {
  let wasReleaseRefused = false;
  try {
    await queue.finalize(async () => {
      const didDiscard = await discardTerminalSession();
      if (!didDiscard) {
        wasReleaseRefused = true;
        throw new OneKeyLocalError('Infini payment session cannot be released');
      }
    });
    return true;
  } catch (error) {
    if (wasReleaseRefused) {
      return false;
    }
    throw error;
  }
}
