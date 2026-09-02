import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { EarnActionIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IEarnTokenInfo,
  IProtocolInfo,
  IStakeEarnDetail,
} from '@onekeyhq/shared/types/staking';

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

function PortfolioRow({
  item,
  networkId,
  protocolInfo,
  tokenInfo,
  onPress,
}: {
  item: IPortfolioRow;
  networkId: string;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
  onPress?: () => void;
}) {
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
      </XStack>
    </XStack>
  );
}

export function PortfolioTab({
  portfolio,
  networkId,
  symbol,
  provider,
  protocolInfo,
  tokenInfo,
}: {
  portfolio: IMobilePortfolio;
  networkId: string;
  symbol: string;
  provider: string;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const accountId = protocolInfo?.earnAccount?.accountId;

  // Only the distributed rows carry a history entry worth opening; the other
  // groups describe live state that this page already shows in full.
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
                group.key === 'distributed' && accountId
                  ? openPositionDetails
                  : undefined
              }
            />
          ))}
        </YStack>
      ))}
    </YStack>
  );
}
