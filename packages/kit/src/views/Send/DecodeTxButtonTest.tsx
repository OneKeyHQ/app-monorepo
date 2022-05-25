import React, { useCallback } from 'react';

import { Button } from '@onekeyhq/components';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { createVaultHelperInstance } from '@onekeyhq/engine/src/vaults/factory';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';

function DecodeTxButtonTest({ encodedTx }: { encodedTx: any }) {
  const { accountId, networkId, networkImpl } = useActiveWalletAccount();
  const { engine } = backgroundApiProxy;

  const decodeTxTest = useCallback(async () => {
    // call vaultHelper in UI (not recommend)
    const vaultHelper = createVaultHelperInstance({
      networkId,
      accountId,
    });
    let nativeTxFromRawTx = null;
    let nativeTx = null;
    try {
      if (networkImpl === IMPL_EVM) {
        const rawTx =
          '0xf86b018502540be40082520894a9b4d559a98ff47c83b74522b7986146538cd4df861b48eb57e0008081e5a06f021ecfb345b8122561c751acdc8c0516632442065c2dc6867c2b19054539dca022f230825979a211d70d4488888d6a3ed9d9c12667e15a6d90df6e5a7a48b440';
        // rawTx decode
        nativeTxFromRawTx = await vaultHelper.parseToNativeTx(rawTx);
      }

      // dapp tx decode
      nativeTx = await vaultHelper.parseToNativeTx(encodedTx);
    } catch (err) {
      console.error(err);
    }

    // ----------------------------------------------
    // call vaultHelper from background
    const decodedTxLegacy = await engine.decodeTx({
      accountId,
      networkId,
      encodedTx,
    });
    const decodedTx = await engine.decodeTx({
      accountId,
      networkId,
      encodedTx,
      legacy: false,
    });
    console.log('decodeTxTest >>>> ', {
      encodedTx,
      decodedTx,
      nativeTx,
      decodedTxLegacy,
      _nativeTxFromRawTx: nativeTxFromRawTx,
    });
  }, [networkId, accountId, networkImpl, encodedTx, engine]);

  if (!platformEnv.isDev) {
    return null;
  }

  if (!encodedTx) {
    return null;
  }

  return (
    <Button mt={4} mb={4} onPress={decodeTxTest}>
      DecodeTxButtonTest
    </Button>
  );
}
export { DecodeTxButtonTest };
