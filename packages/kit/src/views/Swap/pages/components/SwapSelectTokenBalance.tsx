import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Skeleton } from '@onekeyhq/components';

import SwapTokenBalance from '../../components/SwapTokenBalance';
import { useSwapSelectedTokenDetail } from '../../hooks/useSwapTokens';

import type { ISwapToken } from '../../types';

interface ISwapSelectTokenBalanceProps {
  accountXpub?: string;
  accountAddress?: string;
  accountNetworkId?: string;
  token?: ISwapToken;
}
export const SwapSelectTokenBalance = ({
  accountXpub,
  accountAddress,
  accountNetworkId,
  token,
}: ISwapSelectTokenBalanceProps) => {
  const { isLoading, currentTokenBalance } = useSwapSelectedTokenDetail({
    token,
    accountAddress,
    accountXpub,
    accountNetworkId,
  });
  const computedBalance = useMemo(() => {
    const balanceBN = new BigNumber(currentTokenBalance ?? 0);
    return balanceBN.isNaN()
      ? '0'
      : balanceBN.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed();
  }, [currentTokenBalance]);
  return isLoading ? (
    <Skeleton w="$20" h="$10" />
  ) : (
    <SwapTokenBalance balance={computedBalance} symbol={token?.symbol ?? ''} />
  );
};
