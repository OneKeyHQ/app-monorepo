import { useCallback, useEffect, useState } from 'react';

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { toPlainErrorObject } from '../background/utils';

function useDappApproveAction({
  id,
  getResolveData,
}: {
  id: number | string;
  getResolveData: () => Promise<any> | any;
}) {
  const [rejectError, setRejectError] = useState<Error | null>(null);
  const reject = useCallback(
    ({ close = () => null }: { close?: () => void } = {}) => {
      const error = rejectError || web3Errors.provider.userRejectedRequest();
      backgroundApiProxy.promiseContainer.rejectCallback({
        id,
        error: toPlainErrorObject(error),
      });
      close();
      if (platformEnv.isExtensionUiStandaloneWindow) {
        // timeout wait reject done.
        setTimeout(() => window.close(), 0);
      }
    },
    [id, rejectError],
  );

  const resolve = useCallback(
    async ({ close }: { close: () => void }) => {
      try {
        setRejectError(null);
        // throw new Error('simulate something is wrong');
        const data = await getResolveData();
        backgroundApiProxy.promiseContainer.resolveCallback({
          id,
          data,
        });
        close();
      } catch (error) {
        setRejectError(error as Error);
        throw error;
      }
    },
    [getResolveData, id],
  );

  useEffect(() => {
    // TODO do not reject with hardware interaction when beforeunload
    window.addEventListener('beforeunload', () => reject());
    return () => {
      window.removeEventListener('beforeunload', () => reject());
    };
  }, [reject]);

  return {
    reject,
    resolve,
  };
}

export default useDappApproveAction;
