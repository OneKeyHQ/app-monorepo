import { memo, useCallback, useMemo } from 'react';

import {
  Alert,
  Button,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';

import {
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
} from '../../../states/jotai/contexts/swap';
import { useSwapStepState } from '../hooks/useSwapStepState';
import { ESwapStepStateType } from '../types';

interface ISwapActionsStateProps {
  onBuildTx: () => void;
  onWrapped: () => void;
  onApprove: (allowanceValue: number) => void;
}

const SwapActionsState = ({
  onBuildTx,
  onApprove,
  onWrapped,
}: ISwapActionsStateProps) => {
  const swapStepState = useSwapStepState();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [fromAmount] = useSwapFromTokenAmountAtom();
  const [selectCurrentProvider] = useSwapQuoteCurrentSelectAtom();
  const isApproveStepStatus = useMemo(
    () =>
      swapStepState.type === ESwapStepStateType.APPROVE &&
      !swapStepState.isLoading,
    [swapStepState.type, swapStepState.isLoading],
  );

  const wrongMsgComponent = useMemo(() => {
    if (
      (swapStepState.wrongMsg || swapStepState.rateWarning) &&
      !swapStepState.isLoading
    ) {
      return (
        <YStack>
          {swapStepState.wrongMsg ? (
            <Alert
              description={swapStepState.wrongMsg}
              icon="PlaceholderOutline"
            />
          ) : null}
          {swapStepState.rateWarning ? (
            <Alert
              description={swapStepState.rateWarning}
              icon="PlaceholderOutline"
            />
          ) : null}
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
    if (swapStepState.isWrapped) {
      return 'Wrap';
    }
    return 'Swap';
  }, [
    fromAmount,
    fromToken?.symbol,
    selectCurrentProvider?.info.providerName,
    swapStepState,
  ]);

  const onActionHandler = useCallback(() => {
    if (swapStepState.type === ESwapStepStateType.APPROVE) {
      onApprove(Number(fromAmount));
      return;
    }
    if (swapStepState.type === ESwapStepStateType.BUILD_TX) {
      if (swapStepState.isWrapped) {
        onWrapped();
        return;
      }
      onBuildTx();
    }
  }, [
    fromAmount,
    onApprove,
    onBuildTx,
    onWrapped,
    swapStepState.isWrapped,
    swapStepState.type,
  ]);

  const onAction2Handler = useCallback(() => {
    onApprove(-1); // -1 means approve unlimited
  }, [onApprove]);

  return (
    <YStack space="$4">
      {wrongMsgComponent}
      {isApproveStepStatus ? (
        <XStack justifyContent="center">
          <SizableText>{`Step 1: Approve ${
            fromToken?.symbol ?? ''
          }`}</SizableText>
          <SizableText>{'-> Setp 2: Swap'}</SizableText>
        </XStack>
      ) : null}
      <Button
        onPress={onActionHandler}
        variant="primary"
        disabled={swapStepState.disabled}
      >
        <XStack>
          {swapStepState.isLoading && <Spinner size="small" />}
          <SizableText color="white">{actionText}</SizableText>
        </XStack>
      </Button>
      {isApproveStepStatus ? (
        <Button
          onPress={onAction2Handler}
          variant="primary"
          disabled={swapStepState.disabled}
        >
          <SizableText>{`Approve Unlimited ${fromToken?.symbol ?? ''} to ${
            selectCurrentProvider?.info.providerName ?? ''
          }`}</SizableText>
        </Button>
      ) : null}
    </YStack>
  );
};

export default memo(SwapActionsState);
