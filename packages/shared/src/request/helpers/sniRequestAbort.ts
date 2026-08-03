import { generateUUID } from '../../utils/miscUtils';

import type {
  ISniRequestCancelSettledResult,
  ISniRequestConfig,
  ISniRequestOptions,
  ISniRequestTransportSettledResult,
} from '../types/ipTable';

type SniRequestExecutor<T> = (config: ISniRequestConfig) => Promise<T>;
type SniRequestCanceller = (requestId: string) => Promise<{ success: boolean }>;

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

  const reportTransportSettled = (
    result: ISniRequestTransportSettledResult,
  ) => {
    try {
      void Promise.resolve(options?.onTransportSettled?.(result)).catch(
        () => undefined,
      );
    } catch {
      // Diagnostics must not change product request behavior.
    }
  };
  const observeTransport = (requestPromise: Promise<T>) => {
    if (!options?.onTransportSettled) return;
    void requestPromise.then(
      () => reportTransportSettled({ requestId, status: 'fulfilled' }),
      (error: unknown) =>
        reportTransportSettled({ requestId, status: 'rejected', error }),
    );
  };

  if (typeof signal?.addEventListener !== 'function') {
    const requestPromise = execute(requestConfig);
    observeTransport(requestPromise);
    return requestPromise;
  }

  let rejectForAbort: (error: SniRequestCancelledError) => void = () =>
    undefined;
  const abortPromise = new Promise<never>((_resolve, reject) => {
    rejectForAbort = reject;
  });
  const reportCancelSettled = (result: ISniRequestCancelSettledResult) => {
    try {
      void Promise.resolve(options?.onCancelSettled?.(result)).catch(
        () => undefined,
      );
    } catch {
      // Diagnostics must not change product cancellation behavior.
    }
  };
  const handleAbort = () => {
    try {
      void cancel(requestId).then(
        (result) =>
          reportCancelSettled({
            requestId,
            status: 'fulfilled',
            success: result?.success === true,
          }),
        (error: unknown) =>
          reportCancelSettled({
            requestId,
            status: 'rejected',
            error,
          }),
      );
    } catch (error) {
      reportCancelSettled({
        requestId,
        status: 'rejected',
        error,
      });
    }
    rejectForAbort(new SniRequestCancelledError());
  };

  signal.addEventListener('abort', handleAbort, { once: true });

  try {
    if (signal.aborted) {
      throw new SniRequestCancelledError();
    }
    const requestPromise = execute(requestConfig);
    observeTransport(requestPromise);
    return await Promise.race([requestPromise, abortPromise]);
  } finally {
    signal.removeEventListener?.('abort', handleAbort);
  }
}
