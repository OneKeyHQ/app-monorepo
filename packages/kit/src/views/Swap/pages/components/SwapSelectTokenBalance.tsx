import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Skeleton } from '@onekeyhq/components';

import SwapTokenBalance from '../../components/SwapTokenBalance';
import { useSwapSelectedTokenDetail } from '../../hooks/useSwapTokens';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

interface ISwapSelectTokenBalanceProps {
  accountXpub?: string;
  accountAddress?: string;
  accountNetworkId?: string;
  type: 'from' | 'to';
  token?: ISwapToken;
}
export const SwapSelectTokenBalance = ({
  accountXpub,
  accountAddress,
  accountNetworkId,
  type,
  token,
}: ISwapSelectTokenBalanceProps) => {
  const { isLoading, swapSelectedTokenBalance } = useSwapSelectedTokenDetail({
    token,
    type,
    accountAddress,
    accountXpub,
    accountNetworkId,
  });
  const computedBalance = useMemo(() => {
    const balanceBN = new BigNumber(swapSelectedTokenBalance ?? 0);
    return balanceBN.isNaN()
      ? '0'
      : balanceBN.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed();
  }, [swapSelectedTokenBalance]);
  return isLoading ? (
    <Skeleton w="$20" h="$10" />
  ) : (
    <SwapTokenBalance balance={computedBalance} symbol={token?.symbol ?? ''} />
  );
};
