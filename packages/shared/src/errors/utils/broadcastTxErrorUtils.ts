import { OneKeyError } from '../errors/baseErrors';

import {
  BROADCAST_TX_CONTEXT_DATA_FIELD,
  getBroadcastTxContextFromData,
} from './broadcastTxErrorData';

import type { IBroadcastTxContext } from './broadcastTxErrorData';
import type { IOneKeyError, IOneKeyErrorI18nInfo } from '../types/errorTypes';

export function getBroadcastTxContext(
  error: unknown,
  networkId: string,
): IBroadcastTxContext | undefined {
  if (!error || typeof error !== 'object') return undefined;
  return getBroadcastTxContextFromData(
    (error as { data?: unknown }).data,
    networkId,
  );
}

export function withBroadcastTxContext(
  error: unknown,
  context: IBroadcastTxContext,
): OneKeyError {
  const original =
    error && typeof error === 'object'
      ? (error as Partial<IOneKeyError<IOneKeyErrorI18nInfo, unknown>>)
      : undefined;
  const originalData = original?.data;
  const validContext = getBroadcastTxContextFromData({
    [BROADCAST_TX_CONTEXT_DATA_FIELD]: context,
  });
  // Keep non-object error data intact rather than changing an existing contract.
  const data =
    validContext &&
    (originalData === undefined ||
      (originalData !== null &&
        typeof originalData === 'object' &&
        !Array.isArray(originalData)))
      ? {
          ...originalData,
          [BROADCAST_TX_CONTEXT_DATA_FIELD]: validContext,
        }
      : originalData;
  if (error instanceof OneKeyError) {
    try {
      error.data = data;
      return error;
    } catch {
      // Frozen errors still need a serializable copy with their original metadata.
    }
  }
  // Only copy the existing error contract, never signed bytes or request objects.
  return new OneKeyError({
    message:
      original?.message ?? (typeof error === 'string' ? error : undefined),
    code:
      typeof original?.code === 'number' && Number.isInteger(original.code)
        ? original.code
        : undefined,
    className: original?.className,
    name: original?.name,
    key: original?.key,
    info: original?.info,
    autoToast: original?.autoToast,
    requestId: original?.requestId,
    httpStatusCode: original?.httpStatusCode,
    payload: original?.payload,
    data,
  });
}
