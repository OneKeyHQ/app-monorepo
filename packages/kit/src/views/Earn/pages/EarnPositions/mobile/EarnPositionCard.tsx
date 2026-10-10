import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
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
import type {
  IEarnPortfolioPosition,
  IEarnPositionManageTarget,
} from '@onekeyhq/shared/types/earn/portfolioPositions';

import { WrappedActionButton } from '../../../components/PortfolioTabContent';
import { EarnTestIDs } from '../../../testIDs';

import {
  hasPositionDetailPage,
  toPositionCancel,
  toPositionClaim,
} from './myPortfolio.utils';

import type {
  IEarnPositionSectionView,
  IEarnPositionView,
} from './earnPositionModel';

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

/** The PnL line product asked to keep, read off the investment the position came from. */
function PositionPnlLine({ position }: { position: IEarnPortfolioPosition }) {
  const intl = useIntl();
  const { netPnl, netPnlFiatValue, totalReward } = position.earn.investment;
  if (netPnl) {
    return (
      <XStack ai="center" gap="$1" px="$1">
        <EarnText size="$bodySm" text={netPnlFiatValue} />
        <EarnText size="$bodySm" text={netPnl} />
      </XStack>
    );
  }
  if (totalReward) {
    return (
      <XStack ai="center" gap="$1" px="$1">
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
      buttonProps={{
        size: 'medium',
        variant: kind === 'claim' ? 'primary' : 'secondary',
      }}
    />
  );
}

/**
 * One position, the wallet DeFi Portfolio card in the Earn design (figma
 * 29180-108096 and 30292-17104): badge and name, the position value, an
 * optional health factor line, one block per section (deposited, borrowed,
 * rewards; a locked card shows its withdrawal, a claimable card the
 * principal to collect), the PnL line on the active card and the single
 * action: Manage or Unstake into the detail page, Claim, or Cancel on a
 * withdrawal that can be called back.
 */
function EarnPositionCardCmp({
  position,
  onManage,
}: { position: IEarnPositionView } & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const { value, meta, source, action } = position;
  const opensDetail = action?.kind === 'manage' || action?.kind === 'unstake';
  const canOpen =
    opensDetail && Boolean(onManage) && hasPositionDetailPage(source);
  const openDetail =
    canOpen && opensDetail ? () => onManage?.(action.target) : undefined;

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
      <XStack ai="center" jc="space-between" gap="$2" minHeight={28}>
        <XStack ai="center" gap="$2" flex={1} minWidth={0}>
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

      {position.stage === 'active' && position.variant !== 'rewards' ? (
        <PositionPnlLine position={source} />
      ) : null}

      {canOpen ? (
        <Button
          testID="earn-btn"
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
      {action?.kind === 'claim' || action?.kind === 'cancel' ? (
        <PositionRowButton position={source} kind={action.kind} />
      ) : null}
    </YStack>
  );
}

export const EarnPositionCard = memo(EarnPositionCardCmp);
