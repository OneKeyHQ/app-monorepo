import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';

export function useFeeInfoInDecodedTx({
  decodedTx,
}: {
  decodedTx: IDecodedTx;
}) {
  const { accountId, networkId } = decodedTx;

  const { nativeToken, vaultSettings } =
    usePromiseResult(async () => {
      const [n, v] = await Promise.all([
        backgroundApiProxy.serviceToken.getNativeToken({
          accountId,
          networkId,
        }),
        backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId,
        }),
      ]);

      return {
        nativeToken: n,
        vaultSettings: v,
      };
    }, [accountId, networkId]).result ?? {};

  const { totalFeeInNative, totalFeeFiatValue } = decodedTx;
  const txFee = totalFeeInNative ?? '-';
  const txFeeFiatValue = totalFeeFiatValue;

  return {
    txFee,
    txFeeFiatValue,
    txFeeSymbol: nativeToken?.symbol ?? '',
    hideFeeInfo: vaultSettings?.hideFeeInfoInHistoryList,
  };
}
