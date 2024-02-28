import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Button, XStack, YStack } from '@onekeyhq/components';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteFetchingAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { swapFromAmountPercentageItems } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapFromAmountPercentageItem } from '@onekeyhq/shared/types/swap/types';

import SwapFromAmountPercentage from '../../components/SwapFromAmountPercentage';
import SwapTokenAmountInput from '../../components/SwapTokenAmountInput';
import SwapTokenCurrencyValue from '../../components/SwapTokenCurrencyValue';
import SwapTokenSelectTrigger from '../../components/SwapTokenSelectTrigger';
import { useSwapApproving } from '../../hooks/useSwapAproving';
import { useSwapQuote } from '../../hooks/useSwapQuote';
import { useSwapNetworkList } from '../../hooks/useSwapTokens';
import { useSwapAccountNetworkSync } from '../../hooks/uswSwapAccount';

import SwapAccountAddressContainer from './SwapAccountAddressContainer';
import { SwapSelectTokenBalance } from './SwapSelectTokenBalance';

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

  const onSelectAmountPercentage = useCallback(
    (item: ISwapFromAmountPercentageItem) => {
      const fromTokenBalanceBN = new BigNumber(fromTokenBalance);
      if (fromTokenBalanceBN.isZero() || fromTokenBalanceBN.isNaN()) return;
      const fromTokenBalanceAmount = fromTokenBalanceBN
        .multipliedBy(new BigNumber(item.value))
        .decimalPlaces(6, BigNumber.ROUND_DOWN)
        .toFixed();
      setFromInputAmount(fromTokenBalanceAmount);
    },
    [fromTokenBalance, setFromInputAmount],
  );

  return (
    <YStack>
      <YStack
        mx="$10"
        backgroundColor="$bgBackdropLight"
        borderTopLeftRadius="$4"
        borderTopRightRadius="$4"
        alignItems="center"
      >
        <XStack space="$4">
          <YStack space="$4">
            <SwapTokenAmountInput
              onInputChange={setFromInputAmount}
              inputValue={fromInputAmount}
            />
            <SwapTokenCurrencyValue
              value={amountPrice.fromTokenFiatValue}
              currency="$"
            />
          </YStack>
          <SwapTokenSelectTrigger
            loading={fetchLoading}
            currentToken={fromToken}
            onSelectTokenTrigger={() => {
              onSelectToken('from');
            }}
          />
        </XStack>
        {fromToken ? (
          <>
            <SwapAccountAddressContainer num={0} />
            <XStack>
              <SwapSelectTokenBalance token={fromToken} type="from" />
              <SwapFromAmountPercentage
                selectItems={swapFromAmountPercentageItems}
                onSelectItem={onSelectAmountPercentage}
              />
            </XStack>
          </>
        ) : null}
      </YStack>
      <XStack justifyContent="center">
        <Button borderRadius="$4" onPress={alternationToken}>
          交换
        </Button>
      </XStack>
      <YStack
        mx="$10"
        backgroundColor="$bgBackdropLight"
        borderBottomLeftRadius="$4"
        borderBottomRightRadius="$4"
        alignItems="center"
      >
        <XStack space="$4">
          <YStack space="$4">
            <SwapTokenAmountInput
              loading={quoteFetching}
              onInputChange={() => {}}
              inputValue={swapQuoteCurrentSelect?.toAmount ?? ''}
              disabled
            />
            <SwapTokenCurrencyValue
              value={amountPrice.toTokenFiatValue}
              currency="$"
            />
          </YStack>
          <SwapTokenSelectTrigger
            loading={fetchLoading}
            currentToken={toToken}
            onSelectTokenTrigger={() => {
              onSelectToken('to');
            }}
          />
        </XStack>

        {toToken ? (
          <>
            <SwapAccountAddressContainer num={1} />
            <XStack>
              <SwapSelectTokenBalance token={toToken} type="to" />
            </XStack>
          </>
        ) : null}
      </YStack>
    </YStack>
  );
};

export default memo(SwapQuoteInput);
