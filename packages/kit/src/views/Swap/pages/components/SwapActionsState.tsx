import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  useSwapActionState,
  useSwapQuoteLoading,
} from '../../hooks/useSwapState';

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
  const intl = useIntl();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [fromAmount] = useSwapFromTokenAmountAtom();
  const { cleanQuoteInterval } = useSwapActions().current;
  const swapActionState = useSwapActionState();
  const quoteLoading = useSwapQuoteLoading();
  const handleApprove = useCallback(() => {
    if (swapActionState.shoutResetApprove) {
      Dialog.confirm({
        onConfirmText: 'Continue',
        onConfirm: () => {
          onApprove(fromAmount, swapActionState.approveUnLimit, true);
        },
        showCancelButton: true,
        title: intl.formatMessage({
          id: ETranslations.swap_page_provider_approve_usdt_dialog_title,
        }),
        description: intl.formatMessage({
          id: ETranslations.swap_page_provider_approve_usdt_dialog_content,
        }),
        icon: 'TxStatusWarningCircleIllus',
      });
    } else {
      onApprove(fromAmount, swapActionState.approveUnLimit);
    }
  }, [
    fromAmount,
    intl,
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

  const approveStepComponent = useMemo(
    () =>
      swapActionState.isApprove && !quoteLoading ? (
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
                {intl.formatMessage({
                  id: ETranslations.swap_page_swap_steps_1_approve_dialog,
                })}
              </SizableText>
            }
            renderTrigger={
              <XStack
                userSelect="none"
                hoverStyle={{
                  opacity: 0.5,
                }}
              >
                <SizableText size="$bodyMdMedium" pr="$1">
                  {intl.formatMessage(
                    { id: ETranslations.swap_page_swap_steps_1 },
                    { tokenSymbol: fromToken?.symbol ?? '' },
                  )}
                </SizableText>
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
            {intl.formatMessage({
              id: ETranslations.swap_page_swap_steps_2,
            })}
          </SizableText>
        </XStack>
      ) : null,
    [fromToken?.symbol, intl, quoteLoading, swapActionState.isApprove],
  );

  const actionComponent = useMemo(
    () => (
      <YStack {...(pageType === EPageType.modal && !md ? {} : { flex: 1 })}>
        {approveStepComponent}
        <Button
          onPress={onActionHandler}
          size={pageType === EPageType.modal ? 'medium' : 'large'}
          variant="primary"
          disabled={swapActionState.disabled || swapActionState.isLoading}
          loading={swapActionState.isLoading}
        >
          {swapActionState.label}
        </Button>
      </YStack>
    ),
    [
      approveStepComponent,
      md,
      onActionHandler,
      pageType,
      swapActionState.disabled,
      swapActionState.isLoading,
      swapActionState.label,
    ],
  );

  return (
    <YStack p="$5">
      {pageType !== EPageType.modal && !md ? (
        actionComponent
      ) : (
        <Page.Footer confirmButton={actionComponent} />
      )}
    </YStack>
  );
};

export default memo(SwapActionsState);
