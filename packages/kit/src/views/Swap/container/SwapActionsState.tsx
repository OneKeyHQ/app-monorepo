import { useCallback, useMemo } from 'react';

import { XStack } from 'tamagui';

import { Button, Spinner, Text, YStack } from '@onekeyhq/components';

import {
  useSwapQuoteFetchingAtom,
  useSwapResultQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
} from '../../../states/jotai/contexts/swap';

const SwapActionsState = () => {
  const [quoteFetching] = useSwapQuoteFetchingAtom();
  const [swapQuoteCurrentSelect] = useSwapResultQuoteCurrentSelectAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const enableActionState = useMemo<{
    title: string;
    disabled?: boolean;
    isLoading?: boolean;
  }>(() => {
    // TODO:
    // 1. check account connect state
    // 2. check account balance
    if (quoteFetching) {
      return { title: 'Finding...', disabled: true, isLoading: true };
    }
    if (swapQuoteCurrentSelect) {
      // TODO:
      // 1. check account connect state
      // 2. check account balance
      return { title: 'Swap' };
    }
    return { title: 'Swap', disabled: true };
  }, [quoteFetching, swapQuoteCurrentSelect]);

  const onApprovePrecision = useCallback(() => {}, []);
  const onApproveUnLimited = useCallback(() => {}, []);

  if (
    swapQuoteCurrentSelect &&
    fromToken &&
    swapQuoteCurrentSelect.allowanceResult
  ) {
    const { allowanceResult } = swapQuoteCurrentSelect;
    return (
      <YStack space="$4">
        <Text>{`Step 1: Approve ${
          fromToken?.symbol ?? ''
        } -> Step 2: Swap`}</Text>
        <Button
          onPress={onApprovePrecision}
        >{`Approve ${allowanceResult.amount} ${fromToken.symbol} to ${swapQuoteCurrentSelect.info.providerName}`}</Button>
        <Button
          onPress={onApproveUnLimited}
        >{`Approve UnLimited ${fromToken.symbol} to ${swapQuoteCurrentSelect.info.providerName}`}</Button>
      </YStack>
    );
  }
  return (
    <YStack>
      <Button variant="primary" disabled={!!enableActionState.disabled}>
        <XStack>
          {enableActionState.isLoading && <Spinner />}
          <Text color="white">{enableActionState.title}</Text>
        </XStack>
      </Button>
    </YStack>
  );
};

export default SwapActionsState;
