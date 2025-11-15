import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IEarnAlert,
  IEarnManagePageResponse,
} from '@onekeyhq/shared/types/staking';

import { EarnAlert } from '../../../components/ProtocolDetails/EarnAlert';
import { EarnText } from '../../../components/ProtocolDetails/EarnText';
import { useHandleSwap } from '../../../hooks/useHandleSwap';

interface IUSDEManageContentProps {
  managePageData: IEarnManagePageResponse;
  networkId: string;
  alertsStake: IEarnAlert[];
  onHistory?: () => void;
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
  alertsStake,
  onHistory,
  earnAccount,
}: IUSDEManageContentProps) {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const { handleSwap } = useHandleSwap();

  const holdings = managePageData?.holdings;
  const receiveAction = managePageData?.receive;
  const tradeAction = managePageData?.trade;
  const historyActionItem = managePageData?.history;

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
    } catch (error) {
      console.error('handleTrade error:', error);
    }
  }, [handleSwap, networkId, token]);

  if (!holdings) {
    return null;
  }

  return (
    <>
      <YStack px="$5" gap="$5">
        {/* Header with History button */}
        <XStack jc="space-between" ai="center" pt="$4">
          <SizableText size="$headingMd" color="$text">
            Holdings
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

        {/* Action Buttons */}
        <XStack gap="$3">
          {receiveAction ? (
            <YStack flex={1}>
              <Button onPress={handleReceive} disabled={receiveAction.disabled}>
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
      </YStack>

      {/* Alerts */}
      {alertsStake && alertsStake.length > 0 ? (
        <YStack px="$5" py="$3">
          <EarnAlert alerts={alertsStake} />
        </YStack>
      ) : null}
    </>
  );
}
