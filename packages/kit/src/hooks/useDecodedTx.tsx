import { useEffect, useState } from 'react';

import { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import { IEncodedTx } from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useActiveWalletAccount } from './redux';

function useDecodedTx({
  encodedTx,
  payload,
}: {
  encodedTx: IEncodedTx;
  payload?: any;
}) {
  const [decodedTx, setDecodedTx] = useState<EVMDecodedItem | null>(null);
  const { networkId, accountId } = useActiveWalletAccount();
  const { engine } = backgroundApiProxy;
  useEffect(() => {
    (async () => {
      // TODO move to SendConfirm
      const tx = await engine.decodeTx({
        networkId,
        accountId,
        encodedTx,
        payload,
      });
      setDecodedTx(tx);
    })();
  }, [accountId, encodedTx, engine, networkId, payload]);
  return { decodedTx };
}

export { useDecodedTx };
