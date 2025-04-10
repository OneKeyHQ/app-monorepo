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
      const message = p.message;
      const toastIdByErrorCode = isFilterErrorCode(p.errorCode)
        ? String(p.errorCode)
        : undefined;
      // Because the request error automatically toast will take the requestId as the message, when a large number of requests are reported at the same time, using the message as the toastId will toast frequently, so the title is prioritized as the toastId
      const toastId =
        p.toastId || toastIdByErrorCode || (p.title ? p.title : message);
      const actions = getErrorAction(p.errorCode, message ?? '');

      Toast[p.method]({
        ...p,
        toastId,
        actions,
      });
    };
    appEventBus.on(EAppEventBusNames.ShowToast, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowToast, fn);
    };
  }, []);

  return null;
}
