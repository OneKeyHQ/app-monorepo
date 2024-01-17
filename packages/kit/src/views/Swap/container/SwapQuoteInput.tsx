import { memo, useCallback, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Button, XStack, YStack } from '@onekeyhq/components';

import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../states/jotai/contexts/swap';
import SwapTokenAmountInput from '../components/SwapTokenAmountInput';
import SwapTokenCurrencyValue from '../components/SwapTokenCurrencyValue';
import SwapTokenSelectTrigger from '../components/SwapTokenSelectTrigger';
import { useSwapQuote } from '../hooks/useSwapQuote';
import { useSwapNetworkList } from '../hooks/useSwapTokens';

import SwapAccountContainer from './SwapAccountContainer';

import type { ISwapFromAmountPercentageItem } from '../types';

interface ISwapQuoteInputProps {
  onSelectToken: (type: 'from' | 'to') => void;
}

const SwapQuoteInput = ({ onSelectToken }: ISwapQuoteInputProps) => {
  const { fetchLoading } = useSwapNetworkList();
  const [fromInputAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const { quoteFetch, quoteFetching } = useSwapQuote();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const { alternationToken } = useSwapActions().current;
  const [swapQuoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();

  useEffect(() => {
    void quoteFetch(Number(fromInputAmount));
  }, [fromInputAmount, quoteFetch]);

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
      console.log('item-', item);
    },
    [],
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
        <SwapAccountContainer
          num={0}
          token={fromToken}
          onSelectAmountPercentage={onSelectAmountPercentage}
        />
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

        <SwapAccountContainer num={1} token={toToken} isReceiver />
      </YStack>
    </YStack>
  );
};

export default memo(SwapQuoteInput);
