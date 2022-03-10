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
  getResolveData: () => Promise<any> | any;
  closeOnError?: boolean;
}) {
  const isExt = platformEnv.isExtensionUiStandaloneWindow;
  const [rejectError, setRejectError] = useState<Error | null>(null);
  // TODO ignore multiple times reject/resolve
  const reject = useCallback(
    ({ close = () => null }: { close?: () => void } = {}) => {
      const error = rejectError || web3Errors.provider.userRejectedRequest();
      backgroundApiProxy.servicePromise.rejectCallback({
        id,
        error: toPlainErrorObject(error),
      });
      close();
      if (isExt) {
        // timeout wait reject done.
        setTimeout(() => window.close(), 0);
      }
    },
    [id, isExt, rejectError],
  );

  const resolve = useCallback(
    async ({ close }: { close: () => void }) => {
      try {
        setRejectError(null);
        // throw new Error('simulate something is wrong');
        const data = await getResolveData();
        backgroundApiProxy.servicePromise.resolveCallback({
          id,
          data,
        });
        close();
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
    // TODO do not reject with hardware interaction when beforeunload
    if (isExt) {
      window.addEventListener('beforeunload', () => reject());
    }
    return () => {
      if (isExt) {
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
