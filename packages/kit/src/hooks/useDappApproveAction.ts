import { useCallback, useEffect, useState } from 'react';

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';

import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

const useSendRejectId = platformEnv.isExtensionUiSidePanel
  ? (id: number | string) => {
      useEffect(() => {
        appEventBus.emit(EAppEventBusNames.SidePanel_UIToBg, {
          type: 'dappRejectId',
          payload: {
            rejectId: id,
          },
        });
      }, [id]);
    }
  : () => {};

function useDappApproveAction({
  id,
  getResolveData,
  closeOnError,
  closeWindowAfterResolved,
}: {
  id: number | string;
  // Case of rejection only
  getResolveData?: () => Promise<any> | any;
  closeOnError?: boolean;
  closeWindowAfterResolved?: boolean;
}) {
  const isExtStandaloneWindow = platformEnv.isExtensionUiStandaloneWindow;
  const [rejectError, setRejectError] = useState<Error | null>(null);
  // TODO ignore multiple times reject/resolve
  useSendRejectId(id);
  const reject = useCallback(
    ({ close, error }: { close?: () => void; error?: Error } = {}) => {
      if (!id) return;
      // eslint-disable-next-line no-param-reassign
      const newError =
        error || rejectError || web3Errors.provider.userRejectedRequest();
      void backgroundApiProxy.servicePromise.rejectCallback({
        id,
        error: toPlainErrorObject(newError),
      });
      if (isExtStandaloneWindow) {
        // timeout wait reject done.
        setTimeout(() => {
          close?.();
          window.close();
        }, 0);
      } else {
        close?.();
      }
    },
    [id, isExtStandaloneWindow, rejectError],
  );

  const resolve = useCallback(
    async ({ close, result }: { close?: () => void; result?: any } = {}) => {
      if (!id) return;
      try {
        setRejectError(null);
        const data = result ?? (await getResolveData?.());
        void backgroundApiProxy.servicePromise.resolveCallback({
          id,
          data,
        });
        close?.();
        if (isExtStandaloneWindow && closeWindowAfterResolved) {
          setTimeout(() => {
            window.close();
          }, 0);
        }
      } catch (error) {
        console.error('getResolveData ERROR:', error);
        setRejectError(error as Error);
        throw error;
      }
    },
    [getResolveData, id, isExtStandaloneWindow, closeWindowAfterResolved],
  );

  useEffect(() => {
    if (rejectError && closeOnError) {
      reject();
    }
  }, [closeOnError, reject, rejectError]);

  // also trigger browser refresh
  useEffect(() => {
    // const registerWindowUnload = isExt && !platformEnv.isDev;
    const registerWindowUnload = isExtStandaloneWindow;
    // TODO do not reject with hardware interaction when before-unload
    if (registerWindowUnload) {
      window.addEventListener('beforeunload', () => reject());
    }
    return () => {
      if (registerWindowUnload) {
        window.removeEventListener('beforeunload', () => reject());
      }
    };
  }, [isExtStandaloneWindow, reject]);

  return {
    reject,
    resolve,
  };
}

export default useDappApproveAction;
