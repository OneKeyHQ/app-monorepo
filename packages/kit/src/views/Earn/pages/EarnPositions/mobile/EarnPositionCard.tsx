import { memo, useCallback } from 'react';

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
import { showPositionRewardsClaimSheet } from './PositionRewardsClaimSheet';

import type {
  IEarnClaimableReward,
  IEarnPositionSectionView,
  IEarnPositionView,
} from './earnPositionModel';
import type { IStakePendingTx } from '../../../hooks/useStakingPendingTxs';

export type IEarnPositionCardHandlers = {
  /** opens the position's own Earn detail page (EarnNavigation.pushToEarnProtocolDetails) */
  onManage?: (target: IEarnPositionManageTarget) => void;
};

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
            <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
              {asset.symbol}
            </SizableText>
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
 * A claimable position collects its principal on the card, and a locked
 * position whose withdrawal can be called back cancels it there, through
 * the button the wide layout already runs on those rows (identity, pending
 * spinner, refresh included).
 */
function PositionRowButton({
  position,
  kind,
}: {
  position: IEarnPortfolioPosition;
  kind: 'claim' | 'cancel';
}) {
  const action =
    kind === 'claim' ? toPositionClaim(position) : toPositionCancel(position);
  if (!action) {
    return null;
  }
  return (
    <WrappedActionButton
      asset={action.asset}
      reward={action.reward}
      rewardSymbol={action.rewardSymbol}
      buttonProps={{ size: 'medium', variant: 'secondary' }}
    />
  );
}

/**
 * Claim on an active card (figma 30490-21882): one reward goes straight to
 * the confirm page through the claim button the wide layout runs on that
 * row; several open the Claimable rewards sheet, one Claim per reward. The
 * sheet's button spins while any claim of this position is in flight, the
 * same tag the claim stamps on its transaction, so a claim cannot be sent
 * twice before the reward leaves the data.
 */
function RewardsClaimButton({
  position,
  rewards,
}: {
  position: IEarnPortfolioPosition;
  rewards: IEarnClaimableReward[];
}) {
  const intl = useIntl();
  const { onRefresh } = usePortfolioPendingTxs();
  const tag = positionPendingTag(position);
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
    showPositionRewardsClaimSheet({ position, rewards, onRefresh });
  }, [position, rewards, onRefresh]);

  if (rewards.length === 1) {
    const claim = toPositionRewardClaim(position, rewards[0]);
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
 * One position, the wallet DeFi Portfolio card in the Earn design (figma
 * 29180-108096, 30292-17104 and 30490-21077): badge and name, the position
 * value with its PnL under it, an optional health factor line, one block per
 * section (deposited, borrowed, rewards; a locked card shows its withdrawal,
 * a claimable card the principal to collect) and the actions: Manage or
 * Unstake into the detail page with Claim beside it when a reward can be
 * collected (Claim alone once only rewards are left), Claim on a claimable
 * card, or Cancel on a withdrawal that can be called back.
 */
function EarnPositionCardCmp({
  position,
  onManage,
}: { position: IEarnPositionView } & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const { value, meta, source, action, claimableRewards } = position;
  const opensDetail = action?.kind === 'manage' || action?.kind === 'unstake';
  const canOpen =
    opensDetail && Boolean(onManage) && hasPositionDetailPage(source);
  const openDetail =
    canOpen && opensDetail ? () => onManage?.(action.target) : undefined;
  const hasClaim = claimableRewards.length > 0;
  // Only rewards left (the principal was withdrawn): Claim alone, no Manage.
  // Without a claim the way to the detail page stays.
  const rewardsOnly = position.stage === 'active' && source.assets.length === 0;
  const showManage = canOpen && !(rewardsOnly && hasClaim);

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
          {/* one color for every stage: Locked is a state, not a warning */}
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
          {position.stage === 'active' ? (
            <PositionPnlLine position={source} />
          ) : null}
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
            <RewardsClaimButton position={source} rewards={claimableRewards} />
          ) : null}
        </XStack>
      ) : null}
      {action?.kind === 'claim' || action?.kind === 'cancel' ? (
        <PositionRowButton position={source} kind={action.kind} />
      ) : null}
    </YStack>
  );
}

export const EarnPositionCard = memo(EarnPositionCardCmp);
