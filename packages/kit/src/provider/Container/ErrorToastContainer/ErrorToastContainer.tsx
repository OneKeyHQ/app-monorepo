import { useEffect } from 'react';

import { Toast, globalNetInfo } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { getErrorAction } from './ErrorToasts';
import { getNetworkErrorToastSuppressReason } from './offlineNetworkToastGuard';

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

const getToastTraceValue = (value: unknown) => {
  if (value === undefined || value === null) {
    return value;
  }

  const text = String(value);
  return text.length > 160 ? `${text.slice(0, 160)}...` : text;
};

export function ErrorToastContainer() {
  useEffect(() => {
    const fn = (p: IAppEventBusPayload[EAppEventBusNames.ShowToast]) => {
      if (!p.title) {
        return;
      }
      const isInternetReachable =
        globalNetInfo.currentState().isInternetReachable;
      const suppressReason = getNetworkErrorToastSuppressReason({
        isInternetReachable,
        payload: p,
      });
      const shouldSuppress = suppressReason !== null;
      const statusCodeForDeduplicate =
        p.httpStatusCode ??
        (typeof p.errorCode === 'number' ? p.errorCode : undefined);
      if (p.method === 'error') {
        defaultLogger.app.toastTrace.toastDecision({
          isInternetReachable,
          shouldSuppress,
          suppressReason,
          method: p.method,
          title: getToastTraceValue(p.title),
          message: getToastTraceValue(p.message),
          errorCode: getToastTraceValue(p.errorCode),
          errorName: getToastTraceValue(p.errorName),
          errorClassName: getToastTraceValue(p.errorClassName),
          httpStatusCode: p.httpStatusCode,
          effectiveHttpStatusCode: statusCodeForDeduplicate,
          hasRequestId: Boolean(p.requestId),
          hasToastId: Boolean(p.toastId),
        });
      }
      if (shouldSuppress) {
        return;
      }

      const deduplication = getDeduplicationId(statusCodeForDeduplicate);
      // For critical errors (403, 429, 5xx), force deduplication to prevent toast spam
      // Otherwise, respect custom toastId from caller
      const toastId = deduplication.forceDeduplicate
        ? deduplication.id
        : p.toastId ||
          deduplication.id ||
          (p.errorCode !== undefined ? String(p.errorCode) : undefined) ||
          p.title ||
          p.requestId;

      const actions = getErrorAction({
        errorCode: p.errorCode,
        requestId: p.requestId,
        diagnosticText: p.diagnosticText,
        i18nKey: p.i18nKey,
      });

      Toast[p.method]({
        title: p.title,
        message: p.message,
        // icon is string in event bus (shared can't import IKeyOfIcons from components)
        icon: p.icon as any,
        toastId,
        actions,
        duration: p.duration,
      });
    };
    appEventBus.on(EAppEventBusNames.ShowToast, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowToast, fn);
    };
  }, []);

  return null;
}
