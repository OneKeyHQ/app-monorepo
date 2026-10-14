import { memo } from 'react';

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
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IEarnPortfolioPosition,
  IEarnPositionManageTarget,
} from '@onekeyhq/shared/types/earn/portfolioPositions';

import { EarnTestIDs } from '../../../testIDs';

import { EarnHoldingSections } from './EarnHoldingSections';
import { cardRedeemKindOf, hasPositionDetailPage } from './myPortfolio.utils';

import type { IEarnHoldingRedeem } from './EarnHoldingSections';
import type { IEarnPositionView } from './earnPositionModel';

export type IEarnPositionCardHandlers = {
  /** opens the position's own Earn detail page (EarnNavigation.pushToEarnProtocolDetails) */
  onManage?: (target: IEarnPositionManageTarget) => void;
  /** opens the withdrawal of the position's principal, where the detail page's Redeem goes */
  onRedeem?: (target: IEarnPositionManageTarget) => void;
};

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
 * One holding, laid out the way product set it on 10-12: badge and name,
 * the value with its PnL under it, an optional health factor line, then
 * the holding's sections as the detail page shows them (product 10-14), each
 * row with its own button (Redeem, Claim, Check, Cancel), and Manage into
 * the detail page.
 */
function EarnPositionCardCmp({
  position,
  onManage,
  onRedeem,
}: { position: IEarnPositionView } & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const { value, meta, source, action, hasDeposit } = position;
  const canOpen =
    Boolean(action) && Boolean(onManage) && hasPositionDetailPage(source);
  const openDetail =
    canOpen && action ? () => onManage?.(action.target) : undefined;
  const redeemKind = cardRedeemKindOf(position);
  const redeem: IEarnHoldingRedeem | undefined =
    redeemKind && onRedeem
      ? {
          label: intl.formatMessage({
            id:
              redeemKind === 'sellEarly'
                ? ETranslations.defi_sell_early
                : ETranslations.earn_redeem,
          }),
          onPress: () => onRedeem(source.earn.manage),
        }
      : undefined;

  return (
    <YStack gap="$3" testID={EarnTestIDs.portfolioItem(source.protocolName)}>
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

      <EarnHoldingSections
        position={position}
        redeem={redeem}
        onRowPress={openDetail}
      />

      {canOpen ? (
        <Button
          testID="earn-btn"
          size="medium"
          variant="secondary"
          onPress={openDetail}
        >
          {intl.formatMessage({ id: ETranslations.global_manage })}
        </Button>
      ) : null}
    </YStack>
  );
}

export const EarnPositionCard = memo(EarnPositionCardCmp);
