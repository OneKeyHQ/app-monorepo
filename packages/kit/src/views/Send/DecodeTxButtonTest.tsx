import React, { useCallback } from 'react';

import { Button } from '@onekeyhq/components';
import { createVaultHelperInstance } from '@onekeyhq/engine/src/vaults/factory';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';

function DecodeTxButtonTest({ encodedTx }: { encodedTx: any }) {
  const { accountId, networkId } = useActiveWalletAccount();

  const decodeTxTest = useCallback(async () => {
    // call vaultHelper in UI (not recommend)
    const vaultHelper = createVaultHelperInstance({
      networkId,
      accountId,
    });
    const rawTx =
      '0xf86b018502540be40082520894a9b4d559a98ff47c83b74522b7986146538cd4df861b48eb57e0008081e5a06f021ecfb345b8122561c751acdc8c0516632442065c2dc6867c2b19054539dca022f230825979a211d70d4488888d6a3ed9d9c12667e15a6d90df6e5a7a48b440';
    const tx1 = await vaultHelper.parseToNativeTx(rawTx);
    console.log('tx1', tx1); // rawTx decode
    const tx2 = await vaultHelper.parseToNativeTx(encodedTx);
    console.log('tx2', tx2); // dapp tx decode

    // ----------------------------------------------
    // call vaultHelper from background
    const tx3 = await backgroundApiProxy.engine.decodeTx({
      accountId,
      networkId,
      encodedTx,
    });
    console.log('tx3', tx3);
  }, [networkId, accountId, encodedTx]);

  if (!platformEnv.isDev) {
    return null;
  }

  return <Button onPress={decodeTxTest}>DecodeTxButtonTest</Button>;
}
export { DecodeTxButtonTest };
