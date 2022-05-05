/* eslint-disable  @typescript-eslint/no-unused-vars */
import { useCallback, useEffect, useState } from 'react';

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { toPlainErrorObject } from '../background/utils';

function useDappApproveAction({
  id,
  getResolveData,
  closeOnError,
}: {
  id: number | string;
  // Case of rejection only
  getResolveData?: () => Promise<any> | any;
  closeOnError?: boolean;
}) {
  const isExt = platformEnv.isExtensionUiStandaloneWindow;
  const [rejectError, setRejectError] = useState<Error | null>(null);
  // TODO ignore multiple times reject/resolve
  const reject = useCallback(
    ({ close }: { close?: () => void } = {}) => {
      const error = rejectError || web3Errors.provider.userRejectedRequest();
      backgroundApiProxy.servicePromise.rejectCallback({
        id,
        error: toPlainErrorObject(error),
      });
      close?.();
      if (isExt) {
        // timeout wait reject done.
        setTimeout(() => window.close(), 0);
      }
    },
    [id, isExt, rejectError],
  );

  const resolve = useCallback(
    async ({ close, result }: { close?: () => void; result?: any } = {}) => {
      try {
        setRejectError(null);
        // throw new Error('simulate something is wrong');
        const data = result ?? (await getResolveData?.());
        backgroundApiProxy.servicePromise.resolveCallback({
          id,
          data,
        });
        close?.();
      } catch (error) {
        console.error('getResolveData ERROR:', error);
        setRejectError(error as Error);
        throw error;
      }
    },
    [getResolveData, id],
  );

  useEffect(() => {
    if (rejectError && closeOnError) {
      reject();
    }
  }, [closeOnError, reject, rejectError]);

  // also trigger browser refresh
  useEffect(() => {
    // const registerWindowUnload = isExt && !platformEnv.isDev;
    const registerWindowUnload = isExt;
    // TODO do not reject with hardware interaction when beforeunload
    if (registerWindowUnload) {
      window.addEventListener('beforeunload', () => reject());
    }
    return () => {
      if (registerWindowUnload) {
        window.removeEventListener('beforeunload', () => reject());
      }
    };
  }, [isExt, reject]);

  return {
    reject,
    resolve,
  };
}

export default useDappApproveAction;
