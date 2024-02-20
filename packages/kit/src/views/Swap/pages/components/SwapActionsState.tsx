import { memo, useCallback, useMemo } from 'react';

import {
  Alert,
  Button,
  Dialog,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';

import { useSwapStepState } from '../../hooks/useSwapStepState';
import { ESwapStepStateType } from '../../types';

interface ISwapActionsStateProps {
  onBuildTx: () => void;
  onWrapped: () => void;
  onApprove: (
    amount: string,
    isMax?: boolean,
    shoutResetApprove?: boolean,
  ) => void;
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
    () => swapStepState.type === ESwapStepStateType.APPROVE,
    [swapStepState.type],
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
      return swapStepState.approveUnLimit
        ? `Approve Unlimited ${fromToken?.symbol ?? ''} to ${
            selectCurrentProvider?.info.providerName ?? ''
          }`
        : `Approve  ${fromAmount} ${fromToken?.symbol ?? ''} to ${
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

  const handleApprove = useCallback(() => {
    if (swapStepState.shoutResetApprove) {
      Dialog.confirm({
        onConfirmText: 'Continue',
        onConfirm: () => {
          onApprove(fromAmount, swapStepState.approveUnLimit, true);
        },
        showCancelButton: true,
        title: 'Need to Send 2 Transactions to Change Allowance',
        description:
          'Some tokens require multiple transactions to modify the allowance. You must first set the allowance to zero before establishing the new desired allowance value.',
        icon: 'TxStatusWarningCircleIllus',
      });
    } else {
      onApprove(fromAmount, swapStepState.approveUnLimit);
    }
  }, [
    fromAmount,
    onApprove,
    swapStepState.approveUnLimit,
    swapStepState.shoutResetApprove,
  ]);

  const onActionHandler = useCallback(() => {
    if (swapStepState.type === ESwapStepStateType.APPROVE) {
      handleApprove();
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
    handleApprove,
    onBuildTx,
    onWrapped,
    swapStepState.isWrapped,
    swapStepState.type,
  ]);

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
    </YStack>
  );
};

export default memo(SwapActionsState);
