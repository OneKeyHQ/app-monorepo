import { useEffect, useState } from 'react';

import type { IEncodedTx } from '@onekeyhq/engine/src/vaults/types';

import { prepareSendConfirmEncodedTx } from './prepareSendConfirmEncodedTx';

import type { SendConfirmAdvancedSettings, SendConfirmParams } from '../types';

export function useSendConfirmEncodedTx({
  networkId,
  accountId,
  sendConfirmParams,
  networkImpl,
  address,
  advancedSettings,
}: {
  networkId: string;
  accountId: string;
  networkImpl: string;
  sendConfirmParams: SendConfirmParams; // routeParams
  address: string;
  advancedSettings: SendConfirmAdvancedSettings;
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
      selectedUtxos: advancedSettings.selectedUtxos,
      currentHexData: advancedSettings.currentHexData,
    }).then(setEncodedTx);
  }, [
    address,
    networkImpl,
    sendConfirmParams,
    sendConfirmParams.encodedTx,
    networkId,
    accountId,
    advancedSettings.currentHexData,
    advancedSettings.selectedUtxos,
  ]);
  return { encodedTx };
}
