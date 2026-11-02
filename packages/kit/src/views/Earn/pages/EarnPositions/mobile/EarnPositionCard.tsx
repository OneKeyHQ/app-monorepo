import { memo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Badge, Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { DeFiPositionHealthFactorRow } from '@onekeyhq/kit/src/components/DeFi/DeFiPositionHealthFactorRow';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IEarnPortfolioPosition,
  IEarnPositionManageTarget,
} from '@onekeyhq/shared/types/earn/portfolioPositions';

import { EarnTestIDs } from '../../../testIDs';

import { EarnHoldingSections } from './EarnHoldingSections';
import {
  canRedeemFromCard,
  hasPositionDetailPage,
  sellsEarly,
} from './myPortfolio.utils';

import type { IEarnHoldingRedeem } from './EarnHoldingSections';
import type { IEarnPositionView } from './earnPositionModel';

export type IEarnPositionCardHandlers = {
  /** opens the position's own Earn detail page (EarnNavigation.pushToEarnProtocolDetails) */
  onManage?: (target: IEarnPositionManageTarget) => void;
  /**
   * Opens the withdrawal of the position's principal, where the detail
   * page's Redeem goes; `byOrder` for a provider that picks an order rather
   * than an amount. May read first, and then returns the read.
   */
  onRedeem?: (
    target: IEarnPositionManageTarget,
    options: { byOrder: boolean },
  ) => void | Promise<void>;
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
  const [{ hideValue }] = useSettingsValuePersistAtom();
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
    // The value formatter reads every negative as "under a cent", so a
    // loss is formatted as its size and signed here: "-$1.20", and under a
    // cent either way "< +$0.01" / "< -$0.01". Hidden with the balances.
    const size = numberFormat(fiat.abs().toFixed(), {
      formatter: 'value',
      formatterOptions: { currency: currencyInfo.symbol },
    });
    const sign = fiat.lt(0) ? '-' : '+';
    const fiatText = size.startsWith('< ')
      ? `< ${sign}${size.slice(2)}`
      : `${sign}${size}`;
    return (
      <XStack ai="center" gap="$1">
        <SizableText size="$bodySm" color={color} numberOfLines={1}>
          {hideValue ? '****' : fiatText}
        </SizableText>
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
 * One holding (product 10-14): badge, name, value and a chevron on the
 * header line, which opens the detail page, the PnL under it, an optional
 * health factor line, then the panels, each row with its own action. No
 * Manage or Claim under the card: every action sits on its row.
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
  // Redeem, or Sell early for a Pendle PT before maturity, as the detail
  // page's footer reads; the manage page sells the PT on its withdraw tab.
  // Off, not gone, when the server says the page's own Redeem would be
  // (withdrawals switched off, nothing withdrawable), as the page keeps it.
  const redeem: IEarnHoldingRedeem | undefined =
    onRedeem && canRedeemFromCard(position)
      ? {
          label: intl.formatMessage({
            id: sellsEarly(source)
              ? ETranslations.defi_sell_early
              : ETranslations.earn_redeem,
          }),
          disabled: source.earn.redeem?.disabled,
          onPress: () =>
            onRedeem(source.earn.manage, {
              byOrder: Boolean(source.earn.redeem?.byOrder),
            }),
        }
      : undefined;

  return (
    <YStack gap="$3" testID={EarnTestIDs.portfolioItem(source.protocolName)}>
      <YStack
        {...(openDetail
          ? {
              onPress: openDetail,
              cursor: 'pointer',
              pressStyle: { opacity: 0.6 },
            }
          : {})}
      >
        <XStack ai="center" jc="space-between" gap="$2" minHeight={28}>
          <XStack ai="center" gap="$2" flex={1} minWidth={0}>
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
          <XStack ai="center" gap="$1" flexShrink={0}>
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
            {openDetail ? (
              <Icon
                name="ChevronRightSmallOutline"
                size="$5"
                color="$iconSubdued"
              />
            ) : null}
          </XStack>
        </XStack>
        {hasDeposit ? (
          // Right-aligned under the value (the padding skips the chevron),
          // on a line of its own: a long "Total earned" takes the room under
          // the name instead of squeezing the badge and name out.
          <XStack jc="flex-end" pr={openDetail ? '$6' : undefined}>
            <PositionPnlLine position={source} />
          </XStack>
        ) : null}
      </YStack>

      {meta?.kind === 'healthFactor' ? (
        <DeFiPositionHealthFactorRow healthFactor={meta.healthFactor} />
      ) : null}

      <EarnHoldingSections position={position} redeem={redeem} />
    </YStack>
  );
}

export const EarnPositionCard = memo(EarnPositionCardCmp);
