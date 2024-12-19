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
      const message = p.message;
      let toastId = isFilterErrorCode(p.errorCode)
        ? String(p.errorCode)
        : undefined;
      toastId = toastId || (p.title ? p.title : message);
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
