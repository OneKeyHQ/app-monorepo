import { memo, useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

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
  useIsKeyboardShown,
  useMedia,
  usePageType,
} from '@onekeyhq/components';
import {
  useSwapActions,
  useSwapEnableRecipientAddressAtom,
  useSwapFromTokenAmountAtom,
  useSwapProviderSupportReceiveAddressAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  ESwapDirectionType,
  SwapPercentageInputStageForNative,
} from '@onekeyhq/shared/types/swap/types';

import SwapPercentageStageBadge from '../../components/SwapPercentageStageBadge';
import {
  useSwapAddressInfo,
  useSwapRecipientAddressInfo,
} from '../../hooks/useSwapAccount';
import {
  useSwapActionState,
  useSwapSlippagePercentageModeInfo,
} from '../../hooks/useSwapState';

interface ISwapActionsStateProps {
  onBuildTx: () => void;
  onWrapped: () => void;
  onApprove: (
    amount: string,
    isMax?: boolean,
    shoutResetApprove?: boolean,
  ) => void;
  onOpenRecipientAddress: () => void;
  onSelectPercentageStage?: (stage: number) => void;
}

function PageFooter({
  onSelectPercentageStage,
  actionComponent,
  pageType,
  md,
}: {
  onSelectPercentageStage?: (stage: number) => void;
  pageType: EPageType;
  md: boolean;
  actionComponent: React.JSX.Element;
}) {
  const isShow = useIsKeyboardShown();
  const intl = useIntl();
  return (
    <Page.Footer>
      <Page.FooterActions
        {...(pageType === EPageType.modal && !md
          ? { buttonContainerProps: { flex: 1 } }
          : {})}
        confirmButton={actionComponent}
      />
      {isShow ? (
        <XStack
          alignItems="center"
          gap="$1"
          justifyContent="space-around"
          bg="$bgSubdued"
          h="$10"
        >
          <>
            {SwapPercentageInputStageForNative.map((stage) => (
              <SwapPercentageStageBadge
                badgeSize="lg"
                key={`swap-percentage-input-stage-${stage}`}
                stage={stage}
                onSelectStage={onSelectPercentageStage}
              />
            ))}
            <Button
              size="small"
              variant="tertiary"
              onPress={() => {
                Keyboard.dismiss();
              }}
            >
              {intl.formatMessage({
                id: ETranslations.global_confirm,
              })}
            </Button>
          </>
        </XStack>
      ) : null}
    </Page.Footer>
  );
}

const SwapActionsState = ({
  onBuildTx,
  onApprove,
  onWrapped,
  onOpenRecipientAddress,
  onSelectPercentageStage,
}: ISwapActionsStateProps) => {
  const intl = useIntl();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromAmount] = useSwapFromTokenAmountAtom();
  const [currentQuoteRes] = useSwapQuoteCurrentSelectAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const { cleanQuoteInterval, quoteAction } = useSwapActions().current;
  const swapActionState = useSwapActionState();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const swapSlippageRef = useRef(slippageItem);
  const [swapProviderSupportReceiveAddress] =
    useSwapProviderSupportReceiveAddressAtom();
  const [swapEnableRecipientAddress] = useSwapEnableRecipientAddressAtom();
  const [{ swapBatchApproveAndSwap }] = useSettingsPersistAtom();
  const swapRecipientAddressInfo = useSwapRecipientAddressInfo(
    swapEnableRecipientAddress,
  );
  if (swapSlippageRef.current !== slippageItem) {
    swapSlippageRef.current = slippageItem;
  }
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
        swapSlippageRef.current,
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
            size="small"
            alignSelf="flex-start"
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

  const shouldShowRecipient = useMemo(
    () =>
      swapEnableRecipientAddress &&
      swapProviderSupportReceiveAddress &&
      fromToken &&
      toToken &&
      currentQuoteRes?.toTokenInfo.networkId === toToken.networkId,
    [
      swapEnableRecipientAddress,
      currentQuoteRes?.toTokenInfo.networkId,
      swapProviderSupportReceiveAddress,
      fromToken,
      toToken,
    ],
  );

  const approveStepComponent = useMemo(() => {
    if (swapActionState.isApprove && !swapBatchApproveAndSwap) {
      return (
        <XStack
          gap="$1"
          {...(pageType === EPageType.modal && !md ? {} : { pb: '$4' })}
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
      );
    }
    return null;
  }, [
    fromToken?.symbol,
    intl,
    md,
    pageType,
    swapActionState.isApprove,
    swapBatchApproveAndSwap,
  ]);

  const recipientComponent = useMemo(() => {
    if (swapActionState.isApprove && !swapBatchApproveAndSwap) {
      return null;
    }
    if (shouldShowRecipient) {
      return (
        <XStack
          gap="$1"
          {...(pageType === EPageType.modal && !md
            ? { flex: 1 }
            : { pb: '$4' })}
        >
          <Stack>
            <Icon name="AddedPeopleOutline" w="$5" h="$5" />
          </Stack>
          <XStack flex={1} flexWrap="wrap" gap="$1">
            <SizableText flexShrink={0} size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.swap_page_recipient_send_to,
              })}
            </SizableText>
            <SizableText
              flexShrink={0}
              size="$bodyMd"
              cursor="pointer"
              textDecorationLine="underline"
              onPress={onOpenRecipientAddress}
            >
              {swapRecipientAddressInfo?.showAddress ??
                intl.formatMessage({
                  id: ETranslations.swap_page_recipient_add,
                })}
            </SizableText>
            {swapRecipientAddressInfo?.showAddress ? (
              <SizableText
                numberOfLines={1}
                flexShrink={0}
                size="$bodyMd"
                color="$textSubdued"
              >
                {`(${
                  !swapRecipientAddressInfo?.isExtAccount
                    ? `${
                        swapRecipientAddressInfo?.accountInfo?.walletName ?? ''
                      }-${
                        swapRecipientAddressInfo?.accountInfo?.accountName ?? ''
                      }`
                    : intl.formatMessage({
                        id: ETranslations.swap_page_recipient_external_account,
                      })
                })`}
              </SizableText>
            ) : null}
          </XStack>
        </XStack>
      );
    }
    return null;
  }, [
    intl,
    md,
    onOpenRecipientAddress,
    pageType,
    shouldShowRecipient,
    swapActionState.isApprove,
    swapBatchApproveAndSwap,
    swapRecipientAddressInfo?.accountInfo?.accountName,
    swapRecipientAddressInfo?.accountInfo?.walletName,
    swapRecipientAddressInfo?.isExtAccount,
    swapRecipientAddressInfo?.showAddress,
  ]);

  const haveTips = useMemo(
    () =>
      shouldShowRecipient ||
      (swapActionState.isApprove && !swapBatchApproveAndSwap),
    [shouldShowRecipient, swapActionState.isApprove, swapBatchApproveAndSwap],
  );

  const actionComponent = useMemo(
    () => (
      <Stack
        flex={1}
        {...(pageType === EPageType.modal && !md
          ? {
              flexDirection: 'row',
              justifyContent: haveTips ? 'space-between' : 'flex-end',
              alignItems: 'center',
            }
          : {})}
      >
        {approveStepComponent}
        {recipientComponent}
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
      haveTips,
      md,
      onActionHandlerBefore,
      pageType,
      recipientComponent,
      swapActionState.disabled,
      swapActionState.isLoading,
      swapActionState.label,
    ],
  );

  return (
    <>
      {pageType !== EPageType.modal && !md ? (
        actionComponent
      ) : (
        <PageFooter
          onSelectPercentageStage={onSelectPercentageStage}
          actionComponent={actionComponent}
          pageType={pageType}
          md={md}
        />
      )}
    </>
  );
};

export default memo(SwapActionsState);
