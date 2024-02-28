import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { IconButton, XStack, YStack } from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteFetchingAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapSelectedToTokenBalanceAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapApproving } from '../../hooks/useSwapAproving';
import { useSwapQuote } from '../../hooks/useSwapQuote';
import { useSwapNetworkList } from '../../hooks/useSwapTokens';
import { useSwapAccountNetworkSync } from '../../hooks/uswSwapAccount';
import { validateInput } from '../../utils/utils';

import SwapInputContainer from './SwapInputContainer';

interface ISwapQuoteInputProps {
  onSelectToken: (type: 'from' | 'to') => void;
}

const SwapQuoteInput = ({ onSelectToken }: ISwapQuoteInputProps) => {
  const { fetchLoading } = useSwapNetworkList();
  const [fromInputAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [quoteFetching] = useSwapQuoteFetchingAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const { alternationToken } = useSwapActions().current;
  const [swapQuoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  const [fromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const [toTokenBalance] = useSwapSelectedToTokenBalanceAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  useSwapQuote();
  useSwapAccountNetworkSync();
  useSwapApproving();

  const amountPrice = useMemo(() => {
    const fromTokenPriceBN = new BigNumber(fromToken?.price ?? 0);
    const toTokenPriceBN = new BigNumber(toToken?.price ?? 0);
    const fromTokenFiatValueBN = new BigNumber(
      fromInputAmount ?? 0,
    ).multipliedBy(fromTokenPriceBN);
    const toTokenFiatValueBN = new BigNumber(
      swapQuoteCurrentSelect?.toAmount ?? '0',
    ).multipliedBy(toTokenPriceBN);
    return {
      fromTokenFiatValue: fromTokenFiatValueBN.isNaN()
        ? '0'
        : fromTokenFiatValueBN.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(),
      toTokenFiatValue: toTokenFiatValueBN.isNaN()
        ? '0'
        : toTokenFiatValueBN.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(),
    };
  }, [
    fromInputAmount,
    fromToken?.price,
    swapQuoteCurrentSelect?.toAmount,
    toToken?.price,
  ]);

  return (
    <YStack>
      <SwapInputContainer
        token={fromToken}
        direction={ESwapDirectionType.FROM}
        onAmountChange={(value) => {
          if (validateInput(value)) {
            setFromInputAmount(value);
          }
        }}
        amountValue={fromInputAmount}
        onSelectToken={onSelectToken}
        balance={fromTokenBalance}
        amountPrice={amountPrice.fromTokenFiatValue}
        address={activeAccount.account?.address}
      />
      <XStack justifyContent="flex-end" mr="$10" my="$2">
        <IconButton icon="SwitchVerOutline" onPress={alternationToken} />
      </XStack>
      <SwapInputContainer
        token={toToken}
        direction={ESwapDirectionType.TO}
        amountValue={swapQuoteCurrentSelect?.toAmount ?? ''}
        onSelectToken={onSelectToken}
        balance={toTokenBalance}
        amountPrice={amountPrice.toTokenFiatValue}
        address={activeAccount.account?.address}
      />
    </YStack>
  );
};

export default memo(SwapQuoteInput);
