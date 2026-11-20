import { useEffect } from 'react';

import {
  type IToastProps,
  Toast,
} from '@onekeyhq/components/src/actions/Toast';
import { globalNetInfo } from '@onekeyhq/components/src/hooks/useNetInfo';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  getEffectiveHttpStatusCode,
  getNetworkErrorToastSuppressReason,
} from './offlineNetworkToastGuard';

// Get deduplication ID for HTTP status codes to prevent toast spam
// @param httpStatusCode - HTTP status code (e.g., 403, 429, 503)
const getDeduplicationId = (
  httpStatusCode?: number,
): { id: string | undefined; forceDeduplicate: boolean } => {
  if (!httpStatusCode) return { id: undefined, forceDeduplicate: false };

  // Forbidden - force deduplicate
  if (httpStatusCode === 403)
    return { id: 'error_403', forceDeduplicate: true };

  // Rate limiting - force deduplicate to avoid spam
  if (httpStatusCode === 429)
    return { id: 'error_429', forceDeduplicate: true };

  // Server errors (5xx) - force unified deduplication to prevent toast avalanche
  if (httpStatusCode >= 500 && httpStatusCode < 600) {
    return { id: 'error_5xx', forceDeduplicate: true };
  }

  return { id: undefined, forceDeduplicate: false };
};

type IErrorToastPayload = IAppEventBusPayload[EAppEventBusNames.ShowToast];

export function shouldSuppressErrorToast(payload: IErrorToastPayload) {
  return (
    getNetworkErrorToastSuppressReason({
      isInternetReachable: globalNetInfo.currentState().isInternetReachable,
      payload,
    }) !== null
  );
}

export function showErrorToast(
  payload: IErrorToastPayload,
  { title = payload.title, actions }: Pick<IToastProps, 'title' | 'actions'> = {
    title: payload.title,
  },
) {
  const deduplication = getDeduplicationId(getEffectiveHttpStatusCode(payload));
  const toastId = deduplication.forceDeduplicate
    ? deduplication.id
    : payload.toastId ||
      deduplication.id ||
      (payload.errorCode !== undefined
        ? String(payload.errorCode)
        : undefined) ||
      payload.title ||
      payload.requestId;

  Toast[payload.method]({
    title,
    message: payload.message,
    icon: payload.icon as IToastProps['icon'],
    toastId,
    actions,
    duration: payload.duration,
    nativeStorageRecoveryTestSessionId:
      payload.nativeStorageRecoveryTestSessionId,
  });
}

export function ErrorToastListener() {
  useEffect(() => {
    const listener = (payload: IErrorToastPayload) => {
      if (payload.title && !shouldSuppressErrorToast(payload)) {
        showErrorToast(payload);
      }
    };
    appEventBus.on(EAppEventBusNames.ShowToast, listener);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowToast, listener);
    };
  }, []);

  return null;
}
