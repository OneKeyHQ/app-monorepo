import { generateUUID } from '../../utils/miscUtils';

import type { ISniRequestConfig, ISniRequestOptions } from '../types/ipTable';

type SniRequestExecutor<T> = (config: ISniRequestConfig) => Promise<T>;
type SniRequestCanceller = (requestId: string) => Promise<unknown>;

class SniRequestCancelledError extends Error {
  readonly code = 'SNI_CANCELLED' as const;

  constructor() {
    super('SNI_CANCELLED: Request cancelled');
    this.name = 'SniRequestCancelledError';
  }
}

export async function executeSniRequestWithAbort<T>(
  config: ISniRequestConfig,
  options: ISniRequestOptions | undefined,
  execute: SniRequestExecutor<T>,
  cancel: SniRequestCanceller,
): Promise<T> {
  const signal = options?.signal;
  if (signal?.aborted) {
    throw new SniRequestCancelledError();
  }

  const requestId = config.requestId ?? generateUUID();
  const requestConfig: ISniRequestConfig = {
    ...config,
    requestId,
  };

  if (typeof signal?.addEventListener !== 'function') {
    return execute(requestConfig);
  }

  let rejectForAbort: (error: SniRequestCancelledError) => void = () =>
    undefined;
  const abortPromise = new Promise<never>((_resolve, reject) => {
    rejectForAbort = reject;
  });
  const handleAbort = () => {
    try {
      void cancel(requestId).catch(() => undefined);
    } catch {
      // Cancellation is best effort; the local promise still rejects promptly.
    }
    rejectForAbort(new SniRequestCancelledError());
  };

  signal.addEventListener('abort', handleAbort, { once: true });

  try {
    if (signal.aborted) {
      throw new SniRequestCancelledError();
    }
    return await Promise.race([execute(requestConfig), abortPromise]);
  } finally {
    signal.removeEventListener?.('abort', handleAbort);
  }
}
