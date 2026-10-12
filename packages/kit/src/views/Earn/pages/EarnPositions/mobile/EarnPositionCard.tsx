import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { DeFiPositionHealthFactorRow } from '@onekeyhq/kit/src/components/DeFi/DeFiPositionHealthFactorRow';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IEarnPortfolioPosition,
  IEarnPositionManageTarget,
} from '@onekeyhq/shared/types/earn/portfolioPositions';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import {
  WrappedActionButton,
  usePortfolioPendingTxs,
} from '../../../components/PortfolioTabContent';
import { useStakingPendingTxsByInfo } from '../../../hooks/useStakingPendingTxs';
import { EarnTestIDs } from '../../../testIDs';

import {
  hasPositionDetailPage,
  positionPendingTag,
  toPositionCancel,
  toPositionClaim,
  toPositionRewardClaim,
} from './myPortfolio.utils';
import { showPositionClaimSheet } from './PositionRewardsClaimSheet';

import type {
  IEarnPositionSectionView,
  IEarnPositionView,
} from './earnPositionModel';
import type { IPositionClaimSheetItem } from './PositionRewardsClaimSheet';
import type { IStakePendingTx } from '../../../hooks/useStakingPendingTxs';

export type IEarnPositionCardHandlers = {
  /** opens the position's own Earn detail page (EarnNavigation.pushToEarnProtocolDetails) */
  onManage?: (target: IEarnPositionManageTarget) => void;
};

/**
 * A withdrawal in progress the provider lets be called back (Native) runs
 * the cancel the wide layout ran on that row, through the same button, on
 * the row itself.
 */
function PositionCancelButton({ source }: { source: IEarnPortfolioPosition }) {
  const action = toPositionCancel(source);
  if (!action) {
    return null;
  }
  return (
    <WrappedActionButton
      asset={action.asset}
      reward={action.reward}
      rewardSymbol={action.rewardSymbol}
      buttonProps={{ size: 'small', variant: 'secondary' }}
    />
  );
}

/** "Deposited | Balance" and the token rows under it (figma 30292-17826). */
function PositionSection({
  section,
  networkId,
  onPress,
}: {
  section: IEarnPositionSectionView;
  networkId: string;
  onPress?: () => void;
}) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });
  return (
    <YStack gap="$1">
      <XStack ai="center" jc="space-between" px="$1" pt="$2" pb="$1">
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {section.title}
        </SizableText>
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_balance })}
        </SizableText>
      </XStack>
      {section.assets.map((asset, index) => (
        <XStack
          key={`${section.key}-${asset.symbol}-${index}`}
          ai="center"
          jc="space-between"
          gap="$3"
          minHeight={44}
          px="$1"
          cursor={onPress ? 'pointer' : undefined}
          onPress={onPress}
        >
          <XStack ai="center" gap="$2" flex={1} minWidth={0}>
            <Token
              size="md"
              tokenImageUri={asset.meta?.logoUrl}
              showNetworkIcon
              networkId={networkId}
            />
            <YStack flexShrink={1} minWidth={0}>
              <SizableText size="$bodyMdMedium" numberOfLines={1}>
                {asset.symbol}
              </SizableText>
              {/* a withdrawal in progress: when the funds free up, if the provider knows */}
              {asset.unlockAt ? (
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {`${intl.formatMessage({
                    id: ETranslations.earn_unlock_time,
                  })}: ${formatDate(new Date(asset.unlockAt), {
                    hideTimeForever: true,
                  })}`}
                </SizableText>
              ) : null}
            </YStack>
          </XStack>
          <YStack ai="flex-end" flexShrink={0}>
            <ProtocolValueCell
              value={asset.value}
              currencySymbol={currencyInfo.symbol}
              priceUnavailableLabel={priceUnavailableLabel}
              isUnavailable={isProtocolAssetValueUnavailable(asset)}
              size="$bodyMdMedium"
              textAlign="right"
              numberOfLines={1}
            />
            <NumberSizeableTextWrapper
              hideValue
              size="$bodySm"
              color="$textSubdued"
              formatter="balance"
              numberOfLines={1}
            >
              {asset.amount}
            </NumberSizeableTextWrapper>
          </YStack>
          {asset.cancelSource ? (
            <PositionCancelButton source={asset.cancelSource} />
          ) : null}
        </XStack>
      ))}
    </YStack>
  );
}

/**
 * The PnL under the card value (figma 30490-21077): "+$0.84 (+1.69%)",
 * the server's numbers formatted here, green up and red down. A server that
 * only sends the styled texts (before 6.6.1) still gets them; a provider
 * that reports "Total earned" instead keeps that line, subdued.
 */
function PositionPnlLine({ position }: { position: IEarnPortfolioPosition }) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const { pnl, investment } = position.earn;
  if (pnl) {
    const fiat = new BigNumber(pnl.fiatValue);
    let color = '$textSubdued';
    if (fiat.gt(0)) {
      color = '$textSuccess';
    } else if (fiat.lt(0)) {
      color = '$textCritical';
    }
    const percent =
      pnl.percent === undefined
        ? undefined
        : numberFormat(pnl.percent, {
            formatter: 'priceChange',
            formatterOptions: { showPlusMinusSigns: true },
          });
    return (
      <XStack ai="center" gap="$1">
        <NumberSizeableText
          size="$bodySm"
          color={color}
          formatter="value"
          formatterOptions={{
            currency: currencyInfo.symbol,
            showPlusMinusSigns: true,
          }}
          numberOfLines={1}
        >
          {pnl.fiatValue}
        </NumberSizeableText>
        {percent ? (
          <SizableText size="$bodySm" color={color} numberOfLines={1}>
            {`(${percent})`}
          </SizableText>
        ) : null}
      </XStack>
    );
  }
  const { netPnl, netPnlFiatValue, totalReward } = investment;
  if (netPnl) {
    return (
      <XStack ai="center" gap="$1">
        <EarnText size="$bodySm" text={netPnlFiatValue} />
        <EarnText size="$bodySm" text={netPnl} />
      </XStack>
    );
  }
  if (totalReward) {
    return (
      <XStack ai="center" gap="$1">
        <EarnText
          size="$bodySm"
          color="$textSubdued"
          text={totalReward.description}
        />
        <EarnText
          size="$bodySm"
          color="$textSubdued"
          text={{
            text: intl.formatMessage({
              id: ETranslations.earn_referral_total_earned,
            }),
          }}
        />
      </XStack>
    );
  }
  return null;
}

/**
 * Everything the card's Claim collects: the principal out of its cooldown
 * and every reward with an enabled claim, each as the row the sheet shows
 * and the claim the wide layout runs on it.
 */
function buildClaimItems(
  position: IEarnPositionView,
): IPositionClaimSheetItem[] {
  const items: IPositionClaimSheetItem[] = [];
  position.principalClaims.forEach((source) => {
    const claim = toPositionClaim(source);
    const asset = source.assets[0];
    if (!claim || !asset) {
      return;
    }
    const amount = source.assets
      .reduce((sum, entry) => sum.plus(entry.amount), new BigNumber(0))
      .toFixed();
    const value = source.assets.reduce((sum, entry) => sum + entry.value, 0);
    items.push({
      key: source.groupId,
      networkId: source.networkId,
      symbol: asset.symbol,
      logoUrl: asset.meta?.logoUrl,
      amount,
      value: source.assets.some(isProtocolAssetValueUnavailable)
        ? undefined
        : value,
      claim,
    });
  });
  position.claimableRewards.forEach((reward, index) => {
    items.push({
      key: `${position.key}:reward:${index}`,
      networkId: position.source.networkId,
      symbol: reward.symbol,
      logoUrl: reward.meta?.logoUrl,
      amount: reward.amount,
      value: isProtocolAssetValueUnavailable(reward) ? undefined : reward.value,
      claim: toPositionRewardClaim(position.source, reward),
    });
  });
  return items;
}

/**
 * Claim on a card (figma 30490-21882): one thing to collect goes straight
 * to the confirm page through the claim button the wide layout runs on that
 * row; several open the Claimable rewards sheet, one Claim per row. The
 * sheet's button spins while any claim of this holding is in flight, the
 * same tag the claim stamps on its transaction, so a claim cannot be sent
 * twice before the reward leaves the data.
 */
function PositionClaimButton({
  position,
  items,
}: {
  position: IEarnPositionView;
  items: IPositionClaimSheetItem[];
}) {
  const intl = useIntl();
  const { onRefresh } = usePortfolioPendingTxs();
  const tag = positionPendingTag(position.source);
  const pendingTxsFilter = useCallback(
    (tx: IStakePendingTx) =>
      tx.stakingInfo.label === EEarnLabels.Claim &&
      Boolean(tx.stakingInfo.tags?.includes(tag)),
    [tag],
  );
  const { filteredTxs: pendingTxs = [] } = useStakingPendingTxsByInfo({
    filter: pendingTxsFilter,
  });
  const openSheet = useCallback(() => {
    showPositionClaimSheet({ items, onRefresh });
  }, [items, onRefresh]);

  if (items.length === 1) {
    const { claim } = items[0];
    return (
      <WrappedActionButton
        asset={claim.asset}
        reward={claim.reward}
        rewardSymbol={claim.rewardSymbol}
        buttonProps={{ size: 'medium', variant: 'secondary', flex: 1 }}
      />
    );
  }
  const isPending = pendingTxs.length > 0;
  return (
    <Button
      testID={EarnTestIDs.portfolioClaimButton}
      flex={1}
      size="medium"
      variant="secondary"
      loading={isPending}
      disabled={isPending}
      onPress={openSheet}
    >
      {intl.formatMessage({ id: ETranslations.earn_claim })}
    </Button>
  );
}

/**
 * One holding, the wallet DeFi Portfolio card in the Earn design (figma
 * 29180-108096, 30292-17104 and 30490-21077): badge and name, the value
 * with its PnL under it, an optional health factor line, one block per
 * section (deposited, claimable, unstaking with its unlock time and its
 * Cancel where the provider lets it be called back, borrowed, rewards) and
 * the buttons: Manage or Unstake into the detail page while something still
 * sits in the vault, Claim beside it for the principal out of its cooldown
 * and the rewards with a claim (Claim alone once that is all that is left).
 */
function EarnPositionCardCmp({
  position,
  onManage,
}: { position: IEarnPositionView } & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const { value, meta, source, action, hasDeposit, hasUnstaking } = position;
  const canOpen =
    Boolean(action) && Boolean(onManage) && hasPositionDetailPage(source);
  const openDetail =
    canOpen && action ? () => onManage?.(action.target) : undefined;
  const claimItems = useMemo(() => buildClaimItems(position), [position]);
  const hasClaim = claimItems.length > 0;
  // Manage while something still sits in the vault; once only the principal
  // to collect or the rewards are left, Claim alone (figma 30490-21882).
  // Without any claim the way to the detail page stays.
  const showManage = canOpen && (hasDeposit || hasUnstaking || !hasClaim);

  return (
    <YStack
      gap="$2"
      p="$3"
      borderRadius="$3"
      borderWidth="$px"
      borderColor="$borderSubdued"
      bg="$bg"
      testID={EarnTestIDs.portfolioItem(source.protocolName)}
    >
      <XStack ai="flex-start" jc="space-between" gap="$2">
        <XStack ai="center" gap="$2" flex={1} minWidth={0} minHeight={28}>
          {/* one color for every badge: Locked is a state, not a warning */}
          <Badge badgeType="success" badgeSize="sm" flexShrink={0}>
            <Badge.Text>{position.badgeLabel}</Badge.Text>
          </Badge>
          {position.name ? (
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              numberOfLines={1}
              flex={1}
            >
              {position.name}
            </SizableText>
          ) : null}
        </XStack>
        <YStack ai="flex-end" flexShrink={0}>
          <XStack ai="center" minHeight={28}>
            <ProtocolValueCell
              value={value.value}
              currencySymbol={currencyInfo.symbol}
              priceUnavailableLabel={intl.formatMessage({
                id: ETranslations.wallet_price_unavailable,
              })}
              partialPriceUnavailableLabel={intl.formatMessage({
                id: ETranslations.wallet_partial_price_unavailable,
              })}
              isUnavailable={!value.hasAvailableValue}
              showPriceUnavailableTooltip={
                value.hasAvailableValue && value.hasUnavailableValue
              }
              size="$bodyLgMedium"
              textAlign="right"
              numberOfLines={1}
            />
          </XStack>
          {hasDeposit ? <PositionPnlLine position={source} /> : null}
        </YStack>
      </XStack>

      {meta?.kind === 'healthFactor' ? (
        <DeFiPositionHealthFactorRow healthFactor={meta.healthFactor} />
      ) : null}

      {position.sections.map((section) => (
        <PositionSection
          key={section.key}
          section={section}
          networkId={source.networkId}
          onPress={openDetail}
        />
      ))}

      {showManage || hasClaim ? (
        <XStack gap="$2">
          {showManage ? (
            <Button
              testID="earn-btn"
              flex={1}
              size="medium"
              variant="secondary"
              onPress={openDetail}
            >
              {intl.formatMessage({
                id:
                  action?.kind === 'unstake'
                    ? ETranslations.defi_unstake
                    : ETranslations.global_manage,
              })}
            </Button>
          ) : null}
          {hasClaim ? (
            <PositionClaimButton position={position} items={claimItems} />
          ) : null}
        </XStack>
      ) : null}
    </YStack>
  );
}

export const EarnPositionCard = memo(EarnPositionCardCmp);
