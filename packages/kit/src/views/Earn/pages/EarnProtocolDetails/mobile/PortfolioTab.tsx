import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { EarnActionIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IEarnTokenInfo,
  IProtocolInfo,
  IStakeEarnDetail,
} from '@onekeyhq/shared/types/staking';

import { EarnTestIDs } from '../../../testIDs';

import type { GestureResponderEvent } from 'react-native';

type IMobilePortfolio = NonNullable<IStakeEarnDetail['mobilePortfolio']>;
type IPortfolioGroup = IMobilePortfolio['groups'][number];
type IPortfolioRow = IPortfolioGroup['items'][number];

function TransactionLink({
  networkId,
  txHash,
}: {
  networkId: string;
  txHash: string;
}) {
  // The row itself opens the position details, so the hash must not bubble.
  const onPress = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      void openTransactionDetailsUrl({ networkId, txid: txHash });
    },
    [networkId, txHash],
  );

  return (
    <XStack ai="center" gap="$1" cursor="pointer" onPress={onPress}>
      <SizableText size="$bodySm" color="$textSubdued">
        {`${txHash.slice(0, 6)}…${txHash.slice(-4)}`}
      </SizableText>
      <Icon name="OpenOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}

// The server speaks the full EBadgeColor set; 'danger' is the one value the
// Badge component does not have a variant for.
function toBadgeType(badgeType: string): IBadgeType {
  return badgeType === 'danger' ? 'critical' : (badgeType as IBadgeType);
}

function PortfolioRow({
  item,
  networkId,
  protocolInfo,
  tokenInfo,
  onPress,
  onRedeem,
}: {
  item: IPortfolioRow;
  networkId: string;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
  onPress?: () => void;
  onRedeem?: () => void;
}) {
  const intl = useIntl();
  return (
    <XStack
      minHeight={40}
      ai="center"
      jc="space-between"
      gap="$3"
      {...(onPress ? { onPress, cursor: 'pointer' } : {})}
    >
      <XStack ai="center" gap="$2.5" flex={1} minWidth={0}>
        <Token size="sm" tokenImageUri={item.token.info.logoURI} />
        <YStack flex={1} minWidth={0} gap="$0.5">
          <EarnText text={item.title} size="$bodyLgMedium" numberOfLines={1} />
          {item.txHash ? (
            <TransactionLink networkId={networkId} txHash={item.txHash} />
          ) : (
            <EarnText
              text={item.description}
              size="$bodySm"
              color={item.description?.color || '$textSubdued'}
              numberOfLines={1}
            />
          )}
        </YStack>
      </XStack>
      <XStack ai="center" gap="$2" flexShrink={0}>
        {item.buttons?.map((button, index) => (
          <EarnActionIcon
            key={index}
            title={item.title.text}
            actionIcon={button}
            protocolInfo={protocolInfo}
            tokenInfo={tokenInfo}
            token={item.token.info}
          />
        ))}
        {/* Rewards the user cannot act on state their stage here instead of
            under a section heading of their own (figma 29180-111458). */}
        {item.badge ? (
          <Badge badgeType={toBadgeType(item.badge.badgeType)}>
            <Badge.Text>{item.badge.text.text}</Badge.Text>
          </Badge>
        ) : null}
        {/* Rewards carry a Claim button, so the principal gets the matching
            action rather than leaving the footer as the only way to redeem. */}
        {onRedeem ? (
          <Button
            testID={EarnTestIDs.portfolioRedeemButton}
            size="small"
            variant="secondary"
            onPress={onRedeem}
          >
            {intl.formatMessage({ id: ETranslations.earn_redeem })}
          </Button>
        ) : null}
      </XStack>
    </XStack>
  );
}

export function PortfolioTab({
  portfolio,
  networkId,
  symbol,
  provider,
  vault,
  protocolInfo,
  tokenInfo,
}: {
  portfolio: IMobilePortfolio;
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const accountId = protocolInfo?.earnAccount?.accountId;

  // Same destination as the page footer's Redeem, so the two cannot drift.
  const openRedeem = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.ManagePosition,
      params: {
        networkId,
        symbol,
        provider,
        vault,
        tab: 'withdraw',
        tokenImageUri: tokenInfo?.token?.logoURI,
      },
    });
  }, [
    navigation,
    networkId,
    symbol,
    provider,
    vault,
    tokenInfo?.token?.logoURI,
  ]);

  // Only the distributed rows carry a history entry worth opening; the other
  // rows describe live state that this page already shows in full.
  const openPositionDetails = useCallback(() => {
    if (!accountId) {
      return;
    }
    navigation.push(EModalStakingRoutes.PortfolioDetails, {
      accountId,
      networkId,
      symbol,
      provider,
    });
  }, [navigation, accountId, networkId, symbol, provider]);

  return (
    <YStack gap="$6">
      {portfolio.summary?.items?.length ? (
        <YStack gap="$2">
          <SizableText size="$headingMd" color="$text">
            {intl.formatMessage({
              id: ETranslations.wallet_defi_position_module_investment,
            })}
          </SizableText>
          {/* GridItem is already two-per-row on phone; the server sends exactly
              the two cells the design shows, 24h earnings then APY. */}
          <XStack flexWrap="wrap" m="$-3">
            {portfolio.summary.items.map((cell, index) => (
              <GridItem
                key={cell.title?.text || `summary-${index}`}
                title={cell.title}
                description={cell.description}
                actionIcon={cell.button}
                tooltip={cell.tooltip}
                type={cell.type}
              />
            ))}
          </XStack>
        </YStack>
      ) : null}

      {portfolio.groups.map((group) => (
        <YStack
          key={group.key}
          gap="$3"
          bg="$bgSubdued"
          borderRadius="$3"
          p="$4"
        >
          <EarnText text={group.title} size="$bodyMd" color="$textSubdued" />
          {group.items.map((item, index) => (
            <PortfolioRow
              key={`${group.key}-${index}`}
              item={item}
              networkId={networkId}
              protocolInfo={protocolInfo}
              tokenInfo={tokenInfo}
              onPress={
                item.status === 'distributed' && accountId
                  ? openPositionDetails
                  : undefined
              }
              onRedeem={
                item.redeemable && portfolio.capabilities.redeem
                  ? openRedeem
                  : undefined
              }
            />
          ))}
        </YStack>
      ))}
    </YStack>
  );
}
