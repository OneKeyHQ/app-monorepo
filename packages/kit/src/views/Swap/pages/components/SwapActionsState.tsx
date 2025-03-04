import { memo, useCallback, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
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
  useSwapFromTokenAmountAtom,
  useSwapProviderSupportReceiveAddressAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  EProtocolOfExchange,
  ESwapDirectionType,
  ESwapQuoteKind,
  SwapPercentageInputStageForNative,
} from '@onekeyhq/shared/types/swap/types';

import SwapPercentageStageBadge from '../../components/SwapPercentageStageBadge';
import TransactionLossNetworkFeeExceedDialog from '../../components/TransactionLossNetworkFeeExceedDialog';
import {
  useSwapAddressInfo,
  useSwapRecipientAddressInfo,
} from '../../hooks/useSwapAccount';
import {
  useSwapActionState,
  useSwapBatchTransfer,
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

function PercentageStageOnKeyboard({
  onSelectPercentageStage,
}: {
  onSelectPercentageStage?: (stage: number) => void;
}) {
  const isShow = useIsKeyboardShown();
  return isShow ? (
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
            borderRadius={0}
            onSelectStage={onSelectPercentageStage}
            flex={1}
            justifyContent="center"
            alignItems="center"
            h="$10"
          />
        ))}
        <Button
          icon="CheckLargeOutline"
          flex={1}
          h="$10"
          size="small"
          justifyContent="center"
          borderRadius={0}
          alignItems="center"
          variant="tertiary"
          onPress={() => {
            Keyboard.dismiss();
          }}
        />
      </>
    </XStack>
  ) : null;
}

function PageFooter({
  actionComponent,
  pageType,
  md,
  onSelectPercentageStage,
}: {
  onSelectPercentageStage?: (stage: number) => void;
  pageType: EPageType;
  md: boolean;
  actionComponent: React.JSX.Element;
}) {
  return (
    <Page.Footer>
      <Page.FooterActions
        {...(pageType === EPageType.modal && !md
          ? { buttonContainerProps: { flex: 1 } }
          : {})}
        confirmButton={actionComponent}
      />
      <PercentageStageOnKeyboard
        onSelectPercentageStage={onSelectPercentageStage}
      />
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
  const [swapToAmount] = useSwapToTokenAmountAtom();
  const swapSlippageRef = useRef(slippageItem);
  const [swapProviderSupportReceiveAddress] =
    useSwapProviderSupportReceiveAddressAtom();
  const [{ swapEnableRecipientAddress }] = useSettingsAtom();
  const isBatchTransfer = useSwapBatchTransfer(
    swapFromAddressInfo.networkId,
    swapFromAddressInfo.accountInfo?.account?.id,
    currentQuoteRes?.providerDisableBatchTransfer,
  );
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
          onApprove(fromAmount.value, swapActionState.approveUnLimit, true);
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
      onApprove(fromAmount.value, swapActionState.approveUnLimit);
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
        undefined,
        undefined,
        currentQuoteRes?.kind ?? ESwapQuoteKind.SELL,
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
    currentQuoteRes?.kind,
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
    if (swapActionState.isRefreshQuote) {
      onActionHandler();
      return;
    }
    if (currentQuoteRes?.quoteShowTip) {
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
    } else if (
      currentQuoteRes?.networkCostExceedInfo &&
      !currentQuoteRes.allowanceResult
    ) {
      let percentage = currentQuoteRes.networkCostExceedInfo?.exceedPercent;
      const netCost = new BigNumber(
        currentQuoteRes.networkCostExceedInfo?.cost ?? '0',
      );
      if (
        currentQuoteRes.protocol === EProtocolOfExchange.LIMIT &&
        netCost.gt(0)
      ) {
        const toRealAmount = new BigNumber(swapToAmount.value);
        const calculateNetworkCostExceedPercent =
          netCost.dividedBy(toRealAmount);
        if (calculateNetworkCostExceedPercent.lte(new BigNumber(0.1))) {
          onActionHandler();
          return;
        }
        percentage = calculateNetworkCostExceedPercent
          .multipliedBy(100)
          .toFixed(2);
      }
      Dialog.confirm({
        title: intl.formatMessage({
          id: ETranslations.swap_network_cost_dialog_title,
        }),
        icon: 'ErrorSolid',
        renderContent: (
          <TransactionLossNetworkFeeExceedDialog
            protocol={currentQuoteRes.protocol ?? EProtocolOfExchange.SWAP}
            networkCostExceedInfo={{
              ...currentQuoteRes.networkCostExceedInfo,
              exceedPercent: percentage,
            }}
          />
        ),
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
        onConfirm: () => {
          onActionHandler();
        },
      });
    } else {
      onActionHandler();
    }
  }, [
    currentQuoteRes?.allowanceResult,
    currentQuoteRes?.networkCostExceedInfo,
    currentQuoteRes?.protocol,
    currentQuoteRes?.quoteShowTip,
    intl,
    onActionHandler,
    swapActionState.isRefreshQuote,
    swapToAmount.value,
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
    if (swapActionState.isApprove && !isBatchTransfer) {
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
    isBatchTransfer,
  ]);

  const recipientComponent = useMemo(() => {
    if (swapActionState.isApprove && !isBatchTransfer) {
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
    isBatchTransfer,
    swapRecipientAddressInfo?.accountInfo?.accountName,
    swapRecipientAddressInfo?.accountInfo?.walletName,
    swapRecipientAddressInfo?.isExtAccount,
    swapRecipientAddressInfo?.showAddress,
  ]);

  const haveTips = useMemo(
    () =>
      shouldShowRecipient || (swapActionState.isApprove && !isBatchTransfer),
    [shouldShowRecipient, swapActionState.isApprove, isBatchTransfer],
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

  const actionComponentCoverFooter = useMemo(
    () => (
      <>
        {actionComponent}
        <Page.Footer>
          <PercentageStageOnKeyboard
            onSelectPercentageStage={onSelectPercentageStage}
          />
        </Page.Footer>
      </>
    ),
    [actionComponent, onSelectPercentageStage],
  );

  return (
    <>
      {pageType === EPageType.modal && !md ? (
        <PageFooter
          onSelectPercentageStage={onSelectPercentageStage}
          actionComponent={actionComponent}
          pageType={pageType}
          md={md}
        />
      ) : (
        actionComponentCoverFooter
      )}
    </>
  );
};

export default memo(SwapActionsState);
