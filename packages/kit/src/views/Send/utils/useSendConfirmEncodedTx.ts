import { useEffect, useState } from 'react';

import { IEncodedTx } from '@onekeyhq/engine/src/vaults/types';

import { SendConfirmParams } from '../types';

import { prepareSendConfirmEncodedTx } from './prepareSendConfirmEncodedTx';

export function useSendConfirmEncodedTx({
  sendConfirmParams,
  networkImpl,
  address,
}: {
  networkImpl: string;
  sendConfirmParams: SendConfirmParams; // routeParams
  address: string;
}): { encodedTx: IEncodedTx | null } {
  const [encodedTx, setEncodedTx] = useState<IEncodedTx | null>(null);
  useEffect(() => {
    // remove gas price if need
    prepareSendConfirmEncodedTx({
      encodedTx: sendConfirmParams.encodedTx,
      sendConfirmParams,
      networkImpl,
      address,
    }).then(setEncodedTx);
  }, [address, networkImpl, sendConfirmParams, sendConfirmParams.encodedTx]);
  return { encodedTx };
}
