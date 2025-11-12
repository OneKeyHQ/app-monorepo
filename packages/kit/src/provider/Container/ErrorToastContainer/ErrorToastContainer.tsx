import { useEffect } from 'react';

import { Toast } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { getErrorAction } from './ErrorToasts';

const ERROR_CODE = [403];
const isFilterErrorCode = (code?: number) => code && ERROR_CODE.includes(code);

export function ErrorToastContainer() {
  useEffect(() => {
    const fn = (p: IAppEventBusPayload[EAppEventBusNames.ShowToast]) => {
      if (!p.title) {
        return;
      }
      const toastIdByErrorCode = isFilterErrorCode(p.errorCode)
        ? String(p.errorCode)
        : undefined;
      // Use requestId or title as toastId for de-duplication
      const toastId = p.toastId || toastIdByErrorCode || p.requestId || p.title;

      const actions = getErrorAction({
        errorCode: p.errorCode,
        requestId: p.requestId,
        diagnosticText: p.diagnosticText,
      });

      Toast[p.method]({
        title: p.title,
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
