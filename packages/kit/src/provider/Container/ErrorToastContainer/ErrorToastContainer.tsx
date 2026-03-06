import { useEffect } from 'react';

import { Toast } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getErrorAction } from './ErrorToasts';

// Get deduplication ID for error types to prevent toast spam
const getDeduplicationId = (
  httpStatusCode?: number,
  i18nKey?: string,
): { id: string | undefined; forceDeduplicate: boolean } => {
  // Network connectivity errors - force deduplicate
  if (i18nKey === ETranslations.global_network_error) {
    return { id: 'error_network', forceDeduplicate: true };
  }

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

export function ErrorToastContainer() {
  useEffect(() => {
    const fn = (p: IAppEventBusPayload[EAppEventBusNames.ShowToast]) => {
      if (!p.title) {
        return;
      }
      const statusCodeForDeduplicate =
        p.httpStatusCode ??
        (typeof p.errorCode === 'number' ? p.errorCode : undefined);
      const deduplication = getDeduplicationId(
        statusCodeForDeduplicate,
        p.i18nKey,
      );
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
      });

      Toast[p.method]({
        title: p.title,
        message: p.message,
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
