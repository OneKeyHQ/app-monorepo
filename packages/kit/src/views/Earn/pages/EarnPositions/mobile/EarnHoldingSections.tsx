import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { DottedUnderlineText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/DottedUnderline';
import { EarnTooltip } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnPositionEffectiveDeposit } from '@onekeyhq/shared/types/earn/portfolioPositions';

import {
  WrappedActionButton,
  getRewardButtonText,
} from '../../../components/PortfolioTabContent';
import { EarnTestIDs } from '../../../testIDs';

import { isCheckRow } from './earnPositionModel';
import { holdingRowActionOf } from './myPortfolio.utils';

import type {
  IEarnPositionSectionAsset,
  IEarnPositionSectionView,
  IEarnPositionView,
} from './earnPositionModel';
import type { IEarnHoldingRowAction } from './myPortfolio.utils';

/**
 * The deposit row's Redeem: the page decides where it goes and when it is
 * off. A press that first reads what its page needs returns the read, and
 * the button waits on it.
 */
export type IEarnHoldingRedeem = {
  label: string;
  disabled?: boolean;
  onPress: () => void | Promise<void>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// The small button is 30 pt tall; the slop brings its tap area to 44 pt,
// and out to the panel's edge on the right.
const ROW_ACTION_HIT_SLOP = { top: 7, bottom: 7, left: 8, right: 12 };
// Where a row's text starts: past the token logo ($8) and its gap ($2). A
// line that hangs under a row (days left, effective deposits) starts here.
const ROW_TEXT_INSET = '$10';

/** Whole days until a withdrawal frees up, counted up; none once the date has passed. */
function daysLeftOf(unlockAt: number | undefined): number | undefined {
  if (!unlockAt) {
    return undefined;
  }
  const days = Math.ceil((unlockAt - Date.now()) / DAY_MS);
  return days > 0 ? days : undefined;
}

function DaysLeftText({ days }: { days: number }) {
  const intl = useIntl();
  return (
    <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
      {intl.formatMessage(
        { id: ETranslations.earn_number_days_left },
        { number: days },
      )}
    </SizableText>
  );
}

/**
 * A reward the user cannot claim yet: the detail page's badge, in the slot
 * a button would take, which opens the reason when the server gave one. The
 * badge is 20 pt tall; padding that the negative margins take back makes
 * its tap area 44 pt without moving it.
 */
function PendingBadge({ asset }: { asset: IEarnPositionSectionAsset }) {
  const intl = useIntl();
  const badge = (
    <Badge badgeType="info" badgeSize="sm">
      <Badge.Text>
        {intl.formatMessage({ id: ETranslations.global_pending })}
      </Badge.Text>
    </Badge>
  );
  if (!asset.tooltip) {
    return badge;
  }
  return (
    <EarnTooltip
      title={asset.symbol}
      tooltip={asset.tooltip}
      renderTrigger={
        <Stack py="$3" my="$-3" px="$2" mx="$-2">
          {badge}
        </Stack>
      }
    />
  );
}

type IRowButton = Extract<IEarnHoldingRowAction, { kind: 'redeem' | 'button' }>;

/**
 * A row's Redeem, Claim, Check or Cancel: the app's small secondary button,
 * the same for every action. Several rows of a panel can read "Claim", so a
 * screen reader hears the token as well.
 */
function RowAction({
  action,
  symbol,
  redeem,
}: {
  action: IRowButton;
  symbol: string;
  redeem?: IEarnHoldingRedeem;
}) {
  // A Redeem that reads the detail before it opens (the order picker's)
  // shows the button busy until then, and never past this row's life.
  const [isOpening, setIsOpening] = useState(false);
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );
  const handleRedeem = useCallback(() => {
    const opening = redeem?.onPress();
    if (!(opening instanceof Promise)) {
      return;
    }
    setIsOpening(true);
    void opening.finally(() => {
      if (mountedRef.current) {
        setIsOpening(false);
      }
    });
  }, [redeem]);
  if (action.kind === 'redeem') {
    if (!redeem) {
      return null;
    }
    return (
      <Button
        testID={EarnTestIDs.portfolioRedeemButton}
        size="small"
        variant="secondary"
        hitSlop={ROW_ACTION_HIT_SLOP}
        aria-label={`${redeem.label} ${symbol}`}
        disabled={redeem.disabled}
        loading={isOpening}
        onPress={handleRedeem}
      >
        {redeem.label}
      </Button>
    );
  }
  const { claim } = action;
  const label = getRewardButtonText(claim.reward.button)?.text;
  return (
    <WrappedActionButton
      asset={claim.asset}
      reward={claim.reward}
      rewardSymbol={claim.rewardSymbol}
      buttonProps={{
        hitSlop: ROW_ACTION_HIT_SLOP,
        'aria-label': label ? `${label} ${symbol}` : undefined,
      }}
    />
  );
}

/**
 * The part of the deposit that came through OneKey (Spark): a line hung
 * under the deposit row, flush with its text the way a withdrawal's days
 * left are (the margin takes back the row's padding and the panel's gap;
 * the padding below gives a row's back). The label is the way to its
 * explanation, padded to a finger's height; the amount hides with the
 * balances.
 */
function EffectiveDepositRow({
  effectiveDeposit,
}: {
  effectiveDeposit: IEarnPositionEffectiveDeposit;
}) {
  const { label, tooltip } = effectiveDeposit;
  return (
    <XStack
      pl={ROW_TEXT_INSET}
      mt="$-2"
      pb="$1"
      ai="center"
      columnGap="$2"
      flexWrap="wrap"
    >
      {tooltip ? (
        <EarnTooltip
          title={label.text}
          tooltip={tooltip}
          renderTrigger={
            <Stack py="$3" my="$-3">
              <DottedUnderlineText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {label.text}
              </DottedUnderlineText>
            </Stack>
          }
        />
      ) : (
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {label.text}
        </SizableText>
      )}
      <NumberSizeableTextWrapper
        hideValue
        size="$bodySmMedium"
        formatter="balance"
        formatterOptions={{ tokenSymbol: effectiveDeposit.symbol }}
        numberOfLines={1}
      >
        {effectiveDeposit.amount}
      </NumberSizeableTextWrapper>
    </XStack>
  );
}

/**
 * One asset of a panel (product 10-14): the token's amount and name over
 * its value on the left, and the row's one button, or its Pending badge,
 * alone on the right. With every number on the left, a button never pushes
 * a number aside. The logo and the button center on the amount and value;
 * a withdrawal's days left hang under them, so a taller row keeps that
 * alignment, and the same padding on every row keeps rows apart however
 * many lines they have. Lista's reward is unknown until Check reveals it,
 * so that row shows the name alone.
 */
function PositionRow({
  asset,
  action,
  networkId,
  redeem,
}: {
  asset: IEarnPositionSectionAsset;
  action: IEarnHoldingRowAction | undefined;
  networkId: string;
  redeem?: IEarnHoldingRedeem;
}) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const isCheck = isCheckRow(asset);
  const days = daysLeftOf(asset.unlockAt);
  const button =
    action?.kind === 'redeem' || action?.kind === 'button' ? action : undefined;
  return (
    <YStack py="$1">
      <XStack ai="center" gap="$3" minHeight={36}>
        <XStack ai="center" gap="$2" flex={1} minWidth={0}>
          <Token
            size="md"
            tokenImageUri={asset.meta?.logoUrl}
            showNetworkIcon
            networkId={networkId}
          />
          <YStack flexShrink={1} minWidth={0}>
            {isCheck ? (
              <SizableText size="$bodyMdMedium" numberOfLines={1}>
                {asset.symbol}
              </SizableText>
            ) : (
              <>
                <NumberSizeableTextWrapper
                  hideValue
                  size="$bodyMdMedium"
                  formatter="balance"
                  formatterOptions={{ tokenSymbol: asset.symbol }}
                  numberOfLines={1}
                >
                  {asset.amount}
                </NumberSizeableTextWrapper>
                <ProtocolValueCell
                  value={asset.value}
                  currencySymbol={currencyInfo.symbol}
                  priceUnavailableLabel={intl.formatMessage({
                    id: ETranslations.wallet_price_unavailable,
                  })}
                  isUnavailable={isProtocolAssetValueUnavailable(asset)}
                  size="$bodySm"
                  color="$textSubdued"
                  justifyContent="flex-start"
                  numberOfLines={1}
                />
              </>
            )}
          </YStack>
        </XStack>
        {button ? (
          <RowAction action={button} symbol={asset.symbol} redeem={redeem} />
        ) : null}
        {action?.kind === 'pending' ? <PendingBadge asset={asset} /> : null}
      </XStack>
      {days ? (
        <Stack pl={ROW_TEXT_INSET}>
          <DaysLeftText days={days} />
        </Stack>
      ) : null}
    </YStack>
  );
}

/**
 * One panel of a holding: its title on top, the token rows under it, each
 * with its own status and action, and the effective deposit hung under the
 * deposit rows (Spark).
 */
function HoldingSection({
  section,
  position,
  redeem,
}: {
  section: IEarnPositionSectionView;
  position: IEarnPositionView;
  redeem?: IEarnHoldingRedeem;
}) {
  const { effectiveDeposit, source } = position;
  return (
    <YStack gap="$1" px="$3" py="$2" borderRadius="$3" bg="$bgSubdued">
      <SizableText size="$bodySmMedium" color="$textSubdued" py="$1">
        {section.title}
      </SizableText>
      {section.assets.map((asset, index) => (
        <PositionRow
          key={`${section.key}-${asset.symbol}-${index}`}
          asset={asset}
          action={holdingRowActionOf({
            kind: section.kind,
            asset,
            redeemable: Boolean(redeem),
          })}
          networkId={source.networkId}
          redeem={redeem}
        />
      ))}
      {effectiveDeposit &&
      (section.kind === 'deposited' || section.kind === 'supplied') ? (
        <EffectiveDepositRow effectiveDeposit={effectiveDeposit} />
      ) : null}
    </YStack>
  );
}

/**
 * A holding's panels, shared by the My portfolio card and the detail
 * page's Portfolio tab (product 10-14: the two must be the same): Deposited
 * or Supplied with the effective deposit under it, Borrowed, Rewards,
 * Pending withdrawal and Claimable, each row with what can be done with it
 * right there (product 10-15: every row the user can act on carries its
 * action). The card hands in its Redeem (`redeem`), the detail page its
 * footer's, so the row opens the position picker where the provider redeems
 * per position. Claims, Check and Cancel
 * run through the buttons the server sent, and refresh through the
 * PortfolioPendingTxsProvider the page wraps this in.
 */
export function EarnHoldingSections({
  position,
  redeem,
}: {
  position: IEarnPositionView;
  redeem?: IEarnHoldingRedeem;
}) {
  return (
    <YStack gap="$3">
      {position.sections.map((section) => (
        <HoldingSection
          key={section.key}
          section={section}
          position={position}
          redeem={redeem}
        />
      ))}
    </YStack>
  );
}
