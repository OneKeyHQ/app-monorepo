import { useEffect, useState } from 'react';

import type { IEncodedTx } from '@onekeyhq/engine/src/vaults/types';

import { prepareSendConfirmEncodedTx } from './prepareSendConfirmEncodedTx';

import type { BatchSendConfirmParams } from '../types';

function useBatchSendConfirmEncodedTxs({
  batchSendConfirmParams,
  networkImpl,
  address,
}: {
  networkImpl: string;
  batchSendConfirmParams: BatchSendConfirmParams; // routeParams
  address: string;
}): { encodedTxs: IEncodedTx[] } {
  const [encodedTxs, setEncodedTxs] = useState<IEncodedTx[]>([]);
  useEffect(() => {
    Promise.all(
      batchSendConfirmParams.encodedTxs.map((encodedTx) =>
        prepareSendConfirmEncodedTx({
          encodedTx,
          sendConfirmParams: batchSendConfirmParams,
          networkImpl,
          address,
        }),
      ),
    ).then(setEncodedTxs);
  }, [
    address,
    networkImpl,
    batchSendConfirmParams,
    batchSendConfirmParams.encodedTxs,
  ]);
  return { encodedTxs };
}

export { useBatchSendConfirmEncodedTxs };
