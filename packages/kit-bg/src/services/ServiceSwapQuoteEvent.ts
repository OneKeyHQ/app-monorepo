import type { ISwapQuoteSessionTransportErrorV2 } from '@onekeyhq/shared/types/swap/types';

type IEventSourceTransportError = {
  data?: unknown;
  error?: unknown;
  message?: unknown;
  status?: unknown;
  statusText?: unknown;
  type?: unknown;
  xhrState?: unknown;
  xhrStatus?: unknown;
};

function getErrorMessage(error: IEventSourceTransportError) {
  if (typeof error.message === 'string' && error.message) {
    return error.message;
  }
  if (error.error instanceof Error && error.error.message) {
    return error.error.message;
  }
  if (typeof error.error === 'string' && error.error) {
    return error.error;
  }
  if (typeof error.data === 'string' && error.data) {
    return error.data;
  }
  if (error.type === 'timeout') {
    return 'Swap quote event timeout';
  }
  if (typeof error.statusText === 'string' && error.statusText) {
    return error.statusText;
  }
  return undefined;
}

export function normalizeSwapQuoteSessionTransportErrorV2(
  error: unknown,
): ISwapQuoteSessionTransportErrorV2 {
  if (!error || typeof error !== 'object') {
    return typeof error === 'string' ? { message: error } : {};
  }
  const errorRecord = error as IEventSourceTransportError;
  const message = getErrorMessage(errorRecord);
  let xhrStatus: number | undefined;
  if (typeof errorRecord.xhrStatus === 'number') {
    xhrStatus = errorRecord.xhrStatus;
  } else if (typeof errorRecord.status === 'number') {
    xhrStatus = errorRecord.status;
  }
  return {
    ...(message ? { message } : {}),
    ...(typeof errorRecord.xhrState === 'number'
      ? { xhrState: errorRecord.xhrState }
      : {}),
    ...(xhrStatus !== undefined ? { xhrStatus } : {}),
  };
}

export function buildSwapQuoteSessionTransportErrorEventV2(error: unknown) {
  return {
    kind: 'transportError' as const,
    error: normalizeSwapQuoteSessionTransportErrorV2(error),
  };
}
