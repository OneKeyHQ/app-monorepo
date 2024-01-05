import { memo, useCallback, useMemo } from 'react';

import { XStack } from 'tamagui';

import { Alert, Button, Spinner, Text, YStack } from '@onekeyhq/components';

import {
  useSwapFromTokenAmountAtom,
  useSwapResultQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapStepStateAtom,
} from '../../../states/jotai/contexts/swap';
import { ESwapStepStateType } from '../types';

interface ISwapActionsStateProps {
  onBuildTx: () => void;
  onApprove: (allowanceValue: number) => void;
}

const SwapActionsState = ({ onBuildTx, onApprove }: ISwapActionsStateProps) => {
  const [swapStepState] = useSwapStepStateAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [fromAmount] = useSwapFromTokenAmountAtom();
  const [selectCurrentProvider] = useSwapResultQuoteCurrentSelectAtom();
  const wrongMsgComponent = useMemo(() => {
    if (swapStepState.wrongMsg || swapStepState.rateWarning) {
      return (
        <YStack>
          {swapStepState.wrongMsg && (
            <Alert
              description={swapStepState.wrongMsg}
              icon="PlaceholderOutline"
            />
          )}
          {swapStepState.rateWarning && (
            <Alert
              description={swapStepState.rateWarning}
              icon="PlaceholderOutline"
            />
          )}
        </YStack>
      );
    }
    return null;
  }, [swapStepState]);

  const actionText = useMemo(() => {
    if (swapStepState.type === ESwapStepStateType.APPROVE) {
      return `Approve  ${fromAmount} ${fromToken?.symbol ?? ''} to ${
        selectCurrentProvider?.info.providerName ?? ''
      }`;
    }
    if (
      swapStepState.type === ESwapStepStateType.BUILD_TX &&
      swapStepState.isCrossChain
    ) {
      return swapStepState.isLoading ? 'Build Transaction' : 'Cross-Chain Swap';
    }
    if (
      swapStepState.type === ESwapStepStateType.QUOTE &&
      swapStepState.isLoading
    ) {
      return 'Finding Best Price...';
    }
    if (swapStepState.type === ESwapStepStateType.ACCOUNT_CHECK) {
      return 'Insufficient Balance';
    }
    return 'Swap';
  }, [
    fromAmount,
    fromToken?.symbol,
    selectCurrentProvider?.info.providerName,
    swapStepState.isCrossChain,
    swapStepState.isLoading,
    swapStepState.type,
  ]);

  const onActionHandler = useCallback(() => {
    if (swapStepState.type === ESwapStepStateType.APPROVE) {
      onApprove(Number(fromAmount));
      return;
    }
    if (swapStepState.type === ESwapStepStateType.BUILD_TX) {
      onBuildTx();
    }
  }, [fromAmount, onApprove, onBuildTx, swapStepState.type]);

  const onAction2Handler = useCallback(() => {
    onApprove(-1); // -1 means approve unlimited
  }, [onApprove]);

  return (
    <YStack space="$4">
      {wrongMsgComponent}
      <Button
        onPress={onActionHandler}
        variant="primary"
        disabled={swapStepState.disabled}
      >
        <XStack>
          {swapStepState.isLoading && <Spinner size="small" />}
          <Text color="white">{actionText}</Text>
        </XStack>
      </Button>
      {swapStepState.type === ESwapStepStateType.APPROVE &&
      !swapStepState.isLoading ? (
        <Button
          onPress={onAction2Handler}
          variant="primary"
          disabled={swapStepState.disabled}
        >
          <Text>{`Approve Unlimited ${fromToken?.symbol ?? ''} to ${
            selectCurrentProvider?.info.providerName ?? ''
          }`}</Text>
        </Button>
      ) : null}
    </YStack>
  );
};

export default memo(SwapActionsState);
