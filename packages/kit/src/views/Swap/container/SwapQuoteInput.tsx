import { memo, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Button, XStack, YStack } from '@onekeyhq/components';

import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapResultQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../states/jotai/contexts/swap';
import SwapFromAmountPercentage from '../Components/SwapFromAmountPercentage';
import SwapTokenAmountInput from '../Components/SwapTokenAmountInput';
import SwapTokenBalance from '../Components/SwapTokenBalance';
import SwapTokenCurrencyValue from '../Components/SwapTokenCurrencyValue';
import SwapTokenSelectTrigger from '../Components/SwapTokenSelectTrigger';
import { swapFromAmountPercentageItems } from '../config/SwapProvider.constants';
import { useSwapQuote } from '../hooks/useSwapQuote';
import { useSwapNetworkList } from '../hooks/useSwapTokens';

interface ISwapQuoteInputProps {
  onSelectToken: (type: 'from' | 'to') => void;
}

const SwapQuoteInput = ({ onSelectToken }: ISwapQuoteInputProps) => {
  const { fetchLoading } = useSwapNetworkList();
  const [fromInputAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const { quoteFetch, quoteFetching } = useSwapQuote();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [quoteResult] = useSwapResultQuoteCurrentSelectAtom();
  const { alternationToken } = useSwapActions();
  const [swapQuoteCurrentSelect] = useSwapResultQuoteCurrentSelectAtom();

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
      quoteResult?.toAmount ?? '0',
    ).multipliedBy(toTokenPriceBN);
    return {
      fromTokenFiatValue: fromTokenFiatValueBN
        .decimalPlaces(6, BigNumber.ROUND_DOWN)
        .toFixed(),
      toTokenFiatValue: toTokenFiatValueBN
        .decimalPlaces(6, BigNumber.ROUND_DOWN)
        .toFixed(),
    };
  }, [
    fromInputAmount,
    fromToken?.price,
    quoteResult?.toAmount,
    toToken?.price,
  ]);

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
        {/* todo account logic */}
        <XStack justifyContent="space-between">
          <SwapTokenBalance
            balance={
              fromToken?.balanceParsed ? Number(fromToken.balanceParsed) : 0.0
            }
            symbol={fromToken?.symbol ?? ''}
          />
          <SwapFromAmountPercentage
            selectItems={swapFromAmountPercentageItems}
            onSelectItem={(item) => {
              // todo
              console.log('onSelectItem', item);
            }}
          />
        </XStack>
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
        {/* todo account logic */}
        <XStack justifyContent="flex-start">
          <SwapTokenBalance
            balance={
              toToken?.balanceParsed ? Number(toToken.balanceParsed) : 0.0
            }
            symbol={toToken?.symbol ?? ''}
          />
        </XStack>
      </YStack>
    </YStack>
  );
};

export default memo(SwapQuoteInput);
