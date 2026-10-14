import { useIntl } from 'react-intl';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { DottedUnderlineText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/DottedUnderline';
import { EarnTooltip } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IEarnPositionEffectiveDeposit } from '@onekeyhq/shared/types/earn/portfolioPositions';

import { WrappedActionButton } from '../../../components/PortfolioTabContent';
import { EarnTestIDs } from '../../../testIDs';

import { holdingRowActionOf } from './myPortfolio.utils';

import type {
  IEarnPositionSectionAsset,
  IEarnPositionSectionView,
  IEarnPositionView,
} from './earnPositionModel';

/** The principal row's Redeem: the page decides where it goes and when it is off. */
export type IEarnHoldingRedeem = {
  label: string;
  disabled?: boolean;
  onPress: () => void;
};

/**
 * The part of the deposit that came through OneKey (Spark), under the
 * tokens of the Deposited panel: the label marked as the way to its
 * explanation, the token amount on the right, hidden with the balances.
 */
function EffectiveDepositRow({
  effectiveDeposit,
}: {
  effectiveDeposit: IEarnPositionEffectiveDeposit;
}) {
  const { label, tooltip } = effectiveDeposit;
  return (
    <XStack ai="center" jc="space-between" gap="$3" minHeight={32}>
      {tooltip ? (
        <EarnTooltip
          title={label.text}
          tooltip={tooltip}
          renderTrigger={
            <DottedUnderlineText
              size="$bodyMd"
              color="$textSubdued"
              numberOfLines={1}
            >
              {label.text}
            </DottedUnderlineText>
          }
        />
      ) : (
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
          {label.text}
        </SizableText>
      )}
      <NumberSizeableTextWrapper
        hideValue
        size="$bodyMdMedium"
        formatter="balance"
        formatterOptions={{ tokenSymbol: effectiveDeposit.symbol }}
        numberOfLines={1}
      >
        {effectiveDeposit.amount}
      </NumberSizeableTextWrapper>
    </XStack>
  );
}

/** The row's own button: Redeem on the principal, the server's button (claim, Check, cancel) on the rest. */
function RowAction({
  kind,
  asset,
  index,
  redeem,
}: {
  kind: IEarnPositionSectionView['kind'];
  asset: IEarnPositionSectionAsset;
  index: number;
  redeem?: IEarnHoldingRedeem;
}) {
  const action = holdingRowActionOf({ kind, asset, index });
  if (!action) {
    return null;
  }
  if (action.kind === 'redeem') {
    return redeem ? (
      <Button
        testID={EarnTestIDs.portfolioRedeemButton}
        size="small"
        variant="secondary"
        disabled={redeem.disabled}
        onPress={redeem.onPress}
      >
        {redeem.label}
      </Button>
    ) : null;
  }
  const { claim } = action;
  return (
    <WrappedActionButton
      asset={claim.asset}
      reward={claim.reward}
      rewardSymbol={claim.rewardSymbol}
    />
  );
}

/**
 * One block of a holding (product 10-12): "Deposited | Amount" on a panel of
 * its own, the token rows under it, fiat over amount, then the row's own
 * button. A pending withdrawal row says when the funds free up, if the
 * provider knows; a reward the user cannot claim yet reads Pending, with the
 * explanation behind an info icon.
 */
function HoldingSection({
  section,
  networkId,
  redeem,
  onRowPress,
  footer,
}: {
  section: IEarnPositionSectionView;
  networkId: string;
  redeem?: IEarnHoldingRedeem;
  onRowPress?: () => void;
  /** a line under the token rows (the effective deposit, on Deposited) */
  footer?: React.ReactNode;
}) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });
  return (
    <YStack gap="$1" px="$3" py="$2" borderRadius="$3" bg="$bgSubdued">
      <XStack ai="center" jc="space-between" py="$1">
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {section.title}
        </SizableText>
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.wallet_defi_portfolio_column_amount,
          })}
        </SizableText>
      </XStack>
      {section.assets.map((asset, index) => (
        <XStack
          key={`${section.key}-${asset.symbol}-${index}`}
          ai="center"
          jc="space-between"
          gap="$3"
          minHeight={44}
          cursor={onRowPress ? 'pointer' : undefined}
          onPress={onRowPress}
        >
          <XStack ai="center" gap="$2" flex={1} minWidth={0}>
            <Token
              size="md"
              tokenImageUri={asset.meta?.logoUrl}
              showNetworkIcon
              networkId={networkId}
            />
            <YStack flexShrink={1} minWidth={0}>
              <XStack ai="center" gap="$1">
                <SizableText
                  size="$bodyMdMedium"
                  numberOfLines={1}
                  flexShrink={1}
                >
                  {asset.symbol}
                </SizableText>
                {/* why a reward is not claimable yet, as the detail page explains it */}
                {asset.tooltip ? <EarnTooltip tooltip={asset.tooltip} /> : null}
              </XStack>
              {/* a reward still accruing, or settled with the principal */}
              {asset.status === 'pending' ? (
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {intl.formatMessage({ id: ETranslations.global_pending })}
                </SizableText>
              ) : null}
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
          <RowAction
            kind={section.kind}
            asset={asset}
            index={index}
            redeem={redeem}
          />
        </XStack>
      ))}
      {footer}
    </YStack>
  );
}

/**
 * A holding's sections, shared by the My portfolio card and the detail
 * page's Portfolio tab (product 10-14: the two must be the same): Deposited
 * or Supplied with the effective deposit under it, Borrowed, Rewards,
 * Pending withdrawal and Redeemable, each row with what can be done with it
 * right there. The page owns Redeem (`redeem`), since only it knows where
 * the withdrawal goes; claims, Check and cancel run through the buttons the
 * server sent. Claims refresh through the PortfolioPendingTxsProvider the
 * page wraps this in.
 */
export function EarnHoldingSections({
  position,
  redeem,
  onRowPress,
}: {
  position: IEarnPositionView;
  redeem?: IEarnHoldingRedeem;
  /** the card opens the detail page from a row; the detail page passes none */
  onRowPress?: () => void;
}) {
  const { effectiveDeposit, source } = position;
  return (
    <>
      {position.sections.map((section) => (
        <HoldingSection
          key={section.key}
          section={section}
          networkId={source.networkId}
          redeem={redeem}
          onRowPress={onRowPress}
          footer={
            effectiveDeposit &&
            (section.kind === 'deposited' || section.kind === 'supplied') ? (
              <EffectiveDepositRow effectiveDeposit={effectiveDeposit} />
            ) : undefined
          }
        />
      ))}
    </>
  );
}
