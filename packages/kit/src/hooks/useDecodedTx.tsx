import { useEffect, useState } from 'react';

import { IEncodedTxAny } from '@onekeyhq/engine/src/types/vault';
import { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useActiveWalletAccount } from './redux';

function useDecodedTx({ encodedTx }: { encodedTx: IEncodedTxAny }) {
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
      });
      setDecodedTx(tx);
    })();
  }, [accountId, encodedTx, engine, networkId]);
  return { decodedTx };
}

export { useDecodedTx };
