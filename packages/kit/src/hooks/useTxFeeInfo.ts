import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { useAccountData } from './useAccountData';

export function useFeeInfoInDecodedTx({
  decodedTx,
}: {
  decodedTx: IDecodedTx;
}) {
  const { network, vaultSettings } = useAccountData({
    networkId: decodedTx.networkId,
  });

  const { totalFeeInNative, totalFeeFiatValue } = decodedTx;
  const txFee = totalFeeInNative ?? '0';
  const txFeeFiatValue = totalFeeFiatValue ?? '0';

  return {
    txFee,
    txFeeFiatValue,
    txFeeSymbol: network?.symbol ?? '',
    hideFeeInfo: vaultSettings?.hideFeeInfoInHistoryList,
  };
}
