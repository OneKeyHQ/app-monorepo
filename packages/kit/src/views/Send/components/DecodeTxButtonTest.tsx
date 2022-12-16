import { useCallback } from 'react';

import { useRoute } from '@react-navigation/native';

import { Button } from '@onekeyhq/components';
import type VaultHelperEvm from '@onekeyhq/engine/src/vaults/impl/evm/VaultHelper';
import type { IFeeInfoPayload } from '@onekeyhq/engine/src/vaults/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount } from '../../../hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useInteractWithInfo } from '../../../hooks/useDecodedTx';

// import { createVaultHelperInstance } from '@onekeyhq/engine/src/vaults/factory';
const createVaultHelperInstance = (options: any) =>
  ({ ...options } as VaultHelperEvm);

function DecodeTxButtonTest({
  accountId,
  networkId,
  encodedTx,
  feeInfoPayload,
}: {
  accountId: string;
  networkId: string;
  encodedTx: any;
  feeInfoPayload?: IFeeInfoPayload | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useAppNavigation();

  const { networkImpl } = useActiveSideAccount({
    accountId,
    networkId,
  });
  const { engine } = backgroundApiProxy;
  const route = useRoute();
  const interactInfo = useInteractWithInfo({
    // @ts-ignore
    sourceInfo: route.params.sourceInfo,
  });
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
        nativeTxFromRawTx = await vaultHelper.parseToNativeTx(rawTx as any);
      }

      // dapp tx decode
      nativeTx = await vaultHelper.parseToNativeTx(encodedTx);
    } catch (err) {
      console.error(err);
    }

    // ----------------------------------------------
    // call vaultHelper from background

    const { decodedTx, decodedTxLegacy } = await engine.decodeTx({
      accountId,
      networkId,
      encodedTx,
      // @ts-ignore
      payload: route.params?.payloadInfo || route.params?.payload,
      interactInfo,
    });
    console.log('decodeTxTest >>>> ', {
      feeInfoPayload,
      feeInfoValue: feeInfoPayload?.current?.value,
      routeParams: route.params,
      encodedTx,
      decodedTx,
      nativeTx,
      decodedTxLegacy,
      _nativeTxFromRawTx: nativeTxFromRawTx,
    });
  }, [
    feeInfoPayload,
    networkId,
    accountId,
    engine,
    encodedTx,
    route.params,
    interactInfo,
    networkImpl,
  ]);

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
