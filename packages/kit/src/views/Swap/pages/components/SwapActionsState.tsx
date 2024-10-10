import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  EPageType,
  Icon,
  Page,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
  usePageType,
} from '@onekeyhq/components';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
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
  const [currentQuoteRes] = useSwapQuoteCurrentSelectAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const { cleanQuoteInterval, quoteAction } = useSwapActions().current;
  const swapActionState = useSwapActionState();
  const quoteLoading = useSwapQuoteLoading();
  const handleApprove = useCallback(() => {
    if (swapActionState.shoutResetApprove) {
      Dialog.confirm({
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
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
        icon: 'ErrorOutline',
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
    if (swapActionState.isRefreshQuote) {
      void quoteAction(
        swapFromAddressInfo?.address,
        swapFromAddressInfo?.accountInfo?.account?.id,
      );
    } else {
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
    }
  }, [
    cleanQuoteInterval,
    handleApprove,
    onBuildTx,
    onWrapped,
    quoteAction,
    swapActionState.isApprove,
    swapActionState.isRefreshQuote,
    swapActionState.isWrapped,
    swapFromAddressInfo?.accountInfo?.account?.id,
    swapFromAddressInfo?.address,
  ]);

  const onActionHandlerBefore = useCallback(() => {
    if (!swapActionState.isRefreshQuote && currentQuoteRes?.quoteShowTip) {
      Dialog.confirm({
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
        onConfirm: () => {
          onActionHandler();
        },
        title: currentQuoteRes?.quoteShowTip.title ?? '',
        description: currentQuoteRes.quoteShowTip.detail ?? '',
        icon:
          (currentQuoteRes?.quoteShowTip.icon as IKeyOfIcons) ??
          'ChecklistBoxOutline',
        renderContent: currentQuoteRes.quoteShowTip?.link ? (
          <Button
            variant="tertiary"
            icon="QuestionmarkOutline"
            onPress={() => {
              if (currentQuoteRes.quoteShowTip?.link) {
                openUrlExternal(currentQuoteRes.quoteShowTip?.link);
              }
            }}
          >
            {intl.formatMessage({ id: ETranslations.global_learn_more })}
          </Button>
        ) : undefined,
      });
    } else {
      onActionHandler();
    }
  }, [
    currentQuoteRes?.quoteShowTip,
    intl,
    onActionHandler,
    swapActionState.isRefreshQuote,
  ]);

  const approveStepComponent = useMemo(
    () =>
      swapActionState.isApprove && !quoteLoading ? (
        <XStack
          gap="$1"
          {...(pageType === EPageType.modal && !md ? {} : { pb: '$5' })}
        >
          <Popover
            title={intl.formatMessage({ id: ETranslations.global_approve })}
            placement="top-start"
            renderContent={
              <SizableText
                size="$bodyLg"
                $gtMd={{
                  size: '$bodyMd',
                  pt: '$5',
                }}
                pb="$5"
                px="$5"
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
    [
      fromToken?.symbol,
      intl,
      md,
      pageType,
      quoteLoading,
      swapActionState.isApprove,
    ],
  );

  const actionComponent = useMemo(
    () => (
      <Stack
        flex={1}
        {...(pageType === EPageType.modal && !md
          ? {
              flexDirection: 'row',
              justifyContent:
                swapActionState.isApprove && !quoteLoading
                  ? 'space-between'
                  : 'flex-end',
              alignItems: 'center',
            }
          : {})}
      >
        {approveStepComponent}
        <Button
          onPress={onActionHandlerBefore}
          size={pageType === EPageType.modal && !md ? 'medium' : 'large'}
          variant="primary"
          disabled={swapActionState.disabled || swapActionState.isLoading}
          loading={swapActionState.isLoading}
        >
          {swapActionState.label}
        </Button>
      </Stack>
    ),
    [
      approveStepComponent,
      md,
      onActionHandlerBefore,
      pageType,
      quoteLoading,
      swapActionState.disabled,
      swapActionState.isApprove,
      swapActionState.isLoading,
      swapActionState.label,
    ],
  );

  return (
    <YStack p="$5">
      {pageType !== EPageType.modal && !md ? (
        actionComponent
      ) : (
        <Page.Footer
          {...(pageType === EPageType.modal && !md
            ? { buttonContainerProps: { flex: 1 } }
            : {})}
          confirmButton={actionComponent}
        />
      )}
    </YStack>
  );
};

export default memo(SwapActionsState);
