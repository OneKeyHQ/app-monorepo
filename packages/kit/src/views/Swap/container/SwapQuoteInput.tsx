import { memo, useEffect } from 'react';

import { Button, XStack, YStack } from '@onekeyhq/components';

import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapResultQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../states/jotai/contexts/swap';
import SwapFromAmountPercentage from '../components/SwapFromAmountPercentage';
import SwapTokenAmountInput from '../components/SwapTokenAmountInput';
import SwapTokenBalance from '../components/SwapTokenBalance';
import SwapTokenCurrencyValue from '../components/SwapTokenCurrencyValue';
import SwapTokenSelectTrigger from '../components/SwapTokenSelectTrigger';
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
  const { alternationToken } = useSwapActions();
  const [swapQuoteCurrentSelect] = useSwapResultQuoteCurrentSelectAtom();

  useEffect(() => {
    void quoteFetch(Number(fromInputAmount));
  }, [fromInputAmount, quoteFetch]);

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
            <SwapTokenCurrencyValue value="99999" currency="$" />
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
        <XStack>
          <SwapTokenBalance balance={8888.88} symbol="BTC" />
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
            <SwapTokenCurrencyValue value="99999" currency="$" />
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
          <SwapTokenBalance balance={8888.88} symbol="BTC" />
        </XStack>
      </YStack>
    </YStack>
  );
};

export default memo(SwapQuoteInput);
