import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Divider,
  IconButton,
  Page,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import {
  ECheckAmountActionType,
  type IEarnAlert,
  type IEarnManagePageResponse,
} from '@onekeyhq/shared/types/staking';

import { EarnActionIcon } from '../../../components/ProtocolDetails/EarnActionIcon';
import { EarnAlert } from '../../../components/ProtocolDetails/EarnAlert';
import { EarnText } from '../../../components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../../components/ProtocolDetails/EarnTooltip';
import { showKYCDialog } from '../../../components/ProtocolDetails/showKYCDialog';
import { useHandleSwap } from '../../../hooks/useHandleSwap';

interface IUSDEManageContentProps {
  managePageData: IEarnManagePageResponse;
  networkId: string;
  symbol: ISupportedSymbol;
  provider: string;
  vault?: string;
  alertsHolding: IEarnAlert[];
  onHistory?: () => void;
  showApyDetail?: boolean;
  isInModalContext?: boolean;
  onActionSuccess?: () => void;
  earnAccount?: {
    walletId: string;
    accountId: string;
    networkId: string;
    accountAddress: string;
    account: INetworkAccount;
  } | null;
}

export function USDEManageContent({
  managePageData,
  networkId,
  symbol,
  provider,
  vault,
  alertsHolding,
  onHistory,
  showApyDetail = false,
  isInModalContext = false,
  onActionSuccess,
  earnAccount,
}: IUSDEManageContentProps) {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const { handleSwap } = useHandleSwap();

  const holdings = managePageData?.holdings;
  const receiveAction = managePageData?.receive;
  const tradeAction = managePageData?.trade;
  const historyActionItem = managePageData?.history;
  const activateAction = managePageData?.activate;

  const isWatchingAccount = useMemo(
    () =>
      earnAccount?.accountId
        ? accountUtils.isWatchingAccount({ accountId: earnAccount.accountId })
        : false,
    [earnAccount?.accountId],
  );

  // Extract the balance amount from holdings.title to use for rewards calculation
  const holdingsAmount = useMemo(
    () => earnUtils.extractAmountFromText(holdings?.title),
    [holdings?.title],
  );

  // Fetch transaction confirmation to get rewards information
  const { result: transactionConfirmation } = usePromiseResult(async () => {
    if (!earnAccount?.accountAddress || !holdingsAmount) {
      return undefined;
    }

    const amountBN = new BigNumber(holdingsAmount);
    if (amountBN.isNaN() || amountBN.lte(0)) {
      return undefined;
    }

    try {
      const resp =
        await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
          networkId,
          provider,
          symbol,
          vault: vault || '',
          accountAddress: earnAccount.accountAddress,
          action: ECheckAmountActionType.STAKING,
          amount: holdingsAmount,
        });
      return resp;
    } catch (error) {
      console.error('Failed to fetch transaction confirmation:', error);
      return undefined;
    }
  }, [
    earnAccount?.accountAddress,
    networkId,
    symbol,
    provider,
    vault,
    holdingsAmount,
  ]);

  // Convert holdings token to IToken format
  const token = useMemo(() => {
    if (!holdings?.token) return null;
    return {
      ...holdings.token,
      isNative: false,
    };
  }, [holdings?.token]);

  const handleReceive = useCallback(() => {
    if (!token || !earnAccount) return;

    appNavigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveToken,
      params: {
        networkId,
        accountId: earnAccount.accountId,
        walletId: earnAccount.walletId,
        token,
      },
    });
  }, [appNavigation, networkId, earnAccount, token]);

  const handleTrade = useCallback(async () => {
    if (!token) return;

    try {
      await handleSwap({
        token,
        networkId,
      });
      onActionSuccess?.();
    } catch (error) {
      console.error('handleTrade error:', error);
    }
  }, [handleSwap, networkId, token, onActionSuccess]);

  const handleActivate = useCallback(() => {
    if (!activateAction) return;

    showKYCDialog({
      actionData: activateAction,
      onConfirm: async (checkboxStates: boolean[]) => {
        if (checkboxStates.every(Boolean)) {
          const resp =
            await backgroundApiProxy.serviceStaking.verifyRegisterSignMessage({
              networkId,
              provider,
              symbol,
              accountAddress: earnAccount?.accountAddress ?? '',
              signature: '',
              message: '',
            });
          if (resp.toast) {
            Toast.success({
              title: resp.toast.text.text,
            });
          }
          onActionSuccess?.();
        }
      },
    });
  }, [
    activateAction,
    networkId,
    provider,
    symbol,
    earnAccount?.accountAddress,
    onActionSuccess,
  ]);

  if (!holdings) {
    return null;
  }

  return (
    <>
      <YStack px="$5" gap="$5">
        {/* Header with History button */}
        <XStack jc="space-between" ai="center">
          <SizableText size="$headingMd" color="$text">
            {intl.formatMessage({ id: ETranslations.earn_holdings })}
          </SizableText>
          {historyActionItem && !historyActionItem.disabled ? (
            <IconButton
              icon="ClockTimeHistoryOutline"
              onPress={() => onHistory?.()}
              variant="tertiary"
            />
          ) : null}
        </XStack>

        {/* Holdings Section */}
        <YStack gap="$2">
          {/* Tags */}
          {holdings.tags && holdings.tags.length > 0 ? (
            <XStack gap="$2">
              {holdings.tags.map((tag, index) => (
                <Badge key={index} badgeType={tag.badge} badgeSize="lg">
                  {tag.tag}
                </Badge>
              ))}
            </XStack>
          ) : null}

          {/* Title with Token Icon on the right */}
          <XStack jc="space-between" ai="center">
            <YStack gap="$1" flex={1}>
              <EarnText text={holdings.title} size="$heading3xl" />
              <EarnText
                text={holdings.description}
                size="$bodyMd"
                color="$textSubdued"
              />
            </YStack>
            <Token
              size="lg"
              tokenImageUri={holdings.token?.logoURI}
              networkImageUri={holdings.network?.logoURI}
            />
          </XStack>
        </YStack>

        {/* APY Detail Section */}
        {showApyDetail && transactionConfirmation?.apyDetail ? (
          <XStack gap="$1" ai="center" mb="$3.5">
            <EarnText
              text={transactionConfirmation.apyDetail.description}
              size="$headingLg"
              color="$textSuccess"
            />
            <EarnActionIcon
              title={transactionConfirmation.apyDetail.title.text}
              actionIcon={transactionConfirmation.apyDetail.button}
            />
          </XStack>
        ) : null}

        {/* Rewards Section */}
        {!isEmpty(transactionConfirmation?.rewards) ? (
          <>
            <Divider />
            <YStack gap="$1.5">
              <XStack ai="center" gap="$1">
                <EarnText
                  text={transactionConfirmation?.title}
                  color="$textSubdued"
                  size="$bodyMd"
                  boldTextProps={{
                    size: '$bodyMdMedium',
                  }}
                />
              </XStack>
              {transactionConfirmation?.rewards.map((reward) => {
                return (
                  <XStack
                    key={reward.title.text}
                    gap="$1"
                    ai="flex-start"
                    mt="$1.5"
                    flexWrap="wrap"
                  >
                    <XStack gap="$1" flex={1} flexWrap="wrap" ai="center">
                      <EarnText text={reward.title} />
                      <XStack gap="$1" flex={1} flexWrap="wrap" ai="center">
                        <EarnText text={reward.description} flexShrink={1} />
                        <EarnTooltip tooltip={reward.tooltip} />
                      </XStack>
                    </XStack>
                  </XStack>
                );
              })}
            </YStack>
          </>
        ) : null}

        {/* Alerts */}
        {alertsHolding && alertsHolding.length > 0 ? (
          <EarnAlert alerts={alertsHolding} />
        ) : null}

        {/* Activate Button - not in modal */}
        {!isInModalContext && activateAction ? (
          <Button
            variant="primary"
            onPress={handleActivate}
            disabled={
              !earnAccount?.accountAddress ||
              activateAction.disabled ||
              isWatchingAccount
            }
          >
            {activateAction.text?.text || ''}
          </Button>
        ) : null}

        {/* Action Buttons - not in modal */}
        {!isInModalContext && !activateAction ? (
          <XStack gap="$3">
            {receiveAction ? (
              <YStack flex={1}>
                <Button
                  onPress={handleReceive}
                  disabled={receiveAction.disabled}
                >
                  {receiveAction.text?.text || ''}
                </Button>
              </YStack>
            ) : null}
            {tradeAction ? (
              <YStack flex={1}>
                <Button
                  variant="primary"
                  onPress={() => void handleTrade()}
                  disabled={tradeAction.disabled}
                >
                  {tradeAction.text?.text || ''}
                </Button>
              </YStack>
            ) : null}
          </XStack>
        ) : null}
      </YStack>

      {/* Footer - in modal */}
      {isInModalContext ? (
        <Page.Footer>
          {activateAction ? (
            <Page.FooterActions
              onConfirmText={activateAction.text?.text || ''}
              confirmButtonProps={{
                onPress: handleActivate,
                disabled:
                  !earnAccount?.accountAddress ||
                  activateAction.disabled ||
                  isWatchingAccount,
              }}
            />
          ) : (
            <Page.FooterActions
              onCancelText={receiveAction?.text?.text || ''}
              onConfirmText={tradeAction?.text?.text || ''}
              cancelButtonProps={{
                onPress: handleReceive,
                disabled: receiveAction?.disabled,
              }}
              confirmButtonProps={{
                onPress: () => void handleTrade(),
                disabled: tradeAction?.disabled,
              }}
            />
          )}
        </Page.Footer>
      ) : null}
    </>
  );
}
