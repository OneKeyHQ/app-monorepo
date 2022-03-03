import { useCallback, useState } from 'react';

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

function useDappApproveAction({
  id,
  getResolveData,
}: {
  id: number | string;
  getResolveData: () => Promise<any> | any;
}) {
  const [rejectError, setRejectError] = useState<Error | null>(null);
  const reject = useCallback(
    ({ close }: { close: () => void }) => {
      backgroundApiProxy.rejectPromiseCallback({
        id,
        error: rejectError || web3Errors.provider.userRejectedRequest(),
      });
      close();
    },
    [id, rejectError],
  );

  const resolve = useCallback(
    async ({ close }: { close: () => void }) => {
      try {
        setRejectError(null);
        // throw new Error('simulate something is wrong');
        const data = await getResolveData();
        backgroundApiProxy.resolvePromiseCallback({
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
  return {
    reject,
    resolve,
  };
}

export default useDappApproveAction;
