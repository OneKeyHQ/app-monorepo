import { useEffect, useState } from 'react';

import {
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
} from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useActiveWalletAccount } from './redux';

function useDecodedTx({
  encodedTx,
  payload,
}: {
  encodedTx: IEncodedTx | null | undefined;
  payload?: any;
}) {
  const [decodedTxLegacy, setDecodedTxLegacy] =
    useState<IDecodedTxLegacy | null>(null);
  const [decodedTx, setDecodedTx] = useState<IDecodedTx | null>(null);
  const { networkId, accountId } = useActiveWalletAccount();
  const { engine } = backgroundApiProxy;
  useEffect(() => {
    if (!encodedTx) {
      return;
    }
    (async () => {
      // TODO move to SendConfirm
      const result = await engine.decodeTx({
        networkId,
        accountId,
        encodedTx,
        payload,
      });
      setDecodedTx(result.decodedTx);
      setDecodedTxLegacy(result.decodedTxLegacy);
    })();
  }, [accountId, encodedTx, engine, networkId, payload]);
  return { decodedTx, decodedTxLegacy };
}

export { useDecodedTx };
