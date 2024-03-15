import { memo, useCallback } from 'react';

import {
  Button,
  Dialog,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapSelectFromTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';

import { useSwapActionState } from '../../hooks/useSwapState';

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
  const swapActionState = useSwapActionState();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [fromAmount] = useSwapFromTokenAmountAtom();
  const { cleanQuoteInterval } = useSwapActions().current;

  const handleApprove = useCallback(() => {
    if (swapActionState.shoutResetApprove) {
      Dialog.confirm({
        onConfirmText: 'Continue',
        onConfirm: () => {
          onApprove(fromAmount, swapActionState.approveUnLimit, true);
        },
        showCancelButton: true,
        title: 'Need to Send 2 Transactions to Change Allowance',
        description:
          'Some tokens require multiple transactions to modify the allowance. You must first set the allowance to zero before establishing the new desired allowance value.',
        icon: 'TxStatusWarningCircleIllus',
      });
    } else {
      onApprove(fromAmount, swapActionState.approveUnLimit);
    }
  }, [
    fromAmount,
    onApprove,
    swapActionState.approveUnLimit,
    swapActionState.shoutResetApprove,
  ]);

  const onActionHandler = useCallback(() => {
    cleanQuoteInterval();
    if (swapActionState.isApprove) {
      handleApprove();
      return;
    }

    if (swapActionState.isWrapped) {
      onWrapped();
      return;
    }
    onBuildTx();
  }, [
    cleanQuoteInterval,
    handleApprove,
    onBuildTx,
    onWrapped,
    swapActionState.isApprove,
    swapActionState.isWrapped,
  ]);

  return (
    <YStack space="$5" p="$5">
      {swapActionState.isApprove ? (
        <XStack justifyContent="center">
          <SizableText>{`Step 1: Approve ${
            fromToken?.symbol ?? ''
          }`}</SizableText>
          <SizableText>{'-> Setp 2: Swap'}</SizableText>
        </XStack>
      ) : null}
      <Button
        onPress={onActionHandler}
        size="large"
        variant="primary"
        disabled={swapActionState.disabled || swapActionState.isLoading}
        loading={swapActionState.isLoading}
      >
        {swapActionState.label}
      </Button>
    </YStack>
  );
};

export default memo(SwapActionsState);
