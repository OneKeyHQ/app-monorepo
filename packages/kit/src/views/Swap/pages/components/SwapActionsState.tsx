import { memo, useCallback } from 'react';

import {
  Button,
  Dialog,
  EPageType,
  Icon,
  Page,
  Popover,
  SizableText,
  XStack,
  YStack,
  useMedia,
  usePageType,
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
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [fromAmount] = useSwapFromTokenAmountAtom();
  const { cleanQuoteInterval } = useSwapActions().current;
  const swapActionState = useSwapActionState();

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
  const pageType = usePageType();
  const { md } = useMedia();

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
    <YStack p="$5">
      {swapActionState.isApprove && !swapActionState.isLoading ? (
        <XStack pb="$5" space="$1">
          <Popover
            title="Approve"
            placement="top-start"
            renderContent={
              <SizableText
                size="$bodyLg"
                $gtMd={{
                  size: '$bodyMd',
                }}
                p="$5"
              >
                The first time you swap or add liquidity, you have to approve
                the token to be swapped. This gives the Provider permission to
                swap that token from your wallet.
              </SizableText>
            }
            renderTrigger={
              <XStack
                userSelect="none"
                hoverStyle={{
                  opacity: 0.5,
                }}
              >
                <SizableText size="$bodyMdMedium" pr="$1">{`Step 1: Approve ${
                  fromToken?.symbol ?? ''
                }`}</SizableText>
                <Icon
                  size="$5"
                  color="$iconSubdued"
                  name="QuestionmarkOutline"
                />
              </XStack>
            }
          />
          <Icon name="ArrowRightOutline" size="$5" color="$iconSubdued" />
          <SizableText size="$bodyMd" color="$textSubdued">
            Step 2: Swap
          </SizableText>
        </XStack>
      ) : null}

      {pageType !== EPageType.modal && !md ? (
        <Button
          onPress={onActionHandler}
          size="large"
          variant="primary"
          disabled={swapActionState.disabled || swapActionState.isLoading}
          loading={swapActionState.isLoading}
        >
          {swapActionState.label}
        </Button>
      ) : (
        <Page.Footer
          onConfirmText={swapActionState.label}
          confirmButtonProps={{
            variant: 'primary',
            size: 'large',
            loading: swapActionState.isLoading,
            disabled: swapActionState.disabled || swapActionState.isLoading,
            onPress: onActionHandler,
          }}
        />
      )}
    </YStack>
  );
};

export default memo(SwapActionsState);
