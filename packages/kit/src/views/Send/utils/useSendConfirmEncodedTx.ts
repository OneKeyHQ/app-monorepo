import { useEffect, useState } from 'react';

import type { IEncodedTx } from '@onekeyhq/engine/src/vaults/types';

import { prepareSendConfirmEncodedTx } from './prepareSendConfirmEncodedTx';

import type { SendConfirmParams } from '../types';

export function useSendConfirmEncodedTx({
  networkId,
  accountId,
  sendConfirmParams,
  networkImpl,
  address,
  selectedUtxos,
}: {
  networkId: string;
  accountId: string;
  networkImpl: string;
  sendConfirmParams: SendConfirmParams; // routeParams
  address: string;
  selectedUtxos?: string[];
}): { encodedTx: IEncodedTx | null } {
  const [encodedTx, setEncodedTx] = useState<IEncodedTx | null>(null);
  useEffect(() => {
    // remove gas price if need
    prepareSendConfirmEncodedTx({
      networkId,
      accountId,
      encodedTx: sendConfirmParams.encodedTx,
      sendConfirmParams,
      networkImpl,
      address,
      selectedUtxos,
    }).then(setEncodedTx);
  }, [
    address,
    networkImpl,
    sendConfirmParams,
    sendConfirmParams.encodedTx,
    networkId,
    accountId,
    selectedUtxos,
  ]);
  return { encodedTx };
}
