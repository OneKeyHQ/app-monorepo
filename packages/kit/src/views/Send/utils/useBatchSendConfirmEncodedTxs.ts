import { useEffect, useState } from 'react';

import { IEncodedTx } from '@onekeyhq/engine/src/vaults/types';

import { BatchSendConfirmParams } from '../types';

import { prepareSendConfirmEncodedTx } from './prepareSendConfirmEncodedTx';

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
