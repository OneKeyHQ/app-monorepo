import BigNumber from 'bignumber.js';

import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { getFormattedNumber } from '../utils/format';

import { useAccountData } from './useAccountData';

export function useFeeInfoInDecodedTx({
  decodedTx,
}: {
  decodedTx: IDecodedTx;
}) {
  const [settings] = useSettingsPersistAtom();
  const { network } = useAccountData({
    networkId: decodedTx.networkId,
  });

  const { totalFeeInNative, totalFeeFiatValue } = decodedTx;
  const txFee = totalFeeInNative
    ? `${getFormattedNumber(totalFeeInNative) ?? ''} ${network?.symbol ?? ''}`
    : '';
  const txFeeFiatValue = totalFeeFiatValue
    ? `${settings.currencyInfo.symbol}${new BigNumber(
        totalFeeFiatValue,
      ).toFixed(2)}`
    : '';

  return {
    txFee,
    txFeeFiatValue,
  };
}
