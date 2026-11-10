import { Fragment, memo, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { DEFI_PORTFOLIO_DETAIL_POSITION_NAME_COLOR } from '@onekeyhq/kit/src/components/DeFi/defiPortfolioDetailStyleUtils';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ProtocolAssetBalanceText } from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/ProtocolAssetBalanceText';
import { PROTOCOL_TABLE_COLUMN_GAP } from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/ProtocolUnifiedTable';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { buildKeyboardPressProps } from '../../../components/desktopHome/earnDesktopPressable';
import { EarnTestIDs } from '../../../testIDs';
import {
  LendingAlerts,
  LendingCardScope,
  LendingCollateralLine,
  LendingHealthLine,
  LendingHistoryButton,
  LendingPendingBadge,
  useLendingCardRewards,
} from '../EarnLendingActions';
import { EarnPositionHealthFactorRow } from '../EarnPositionHealthFactorRow';
import {
  DaysLeftText,
  EffectiveDepositText,
  LendingRewardAction,
  PendingBadge,
  RowAction,
  daysLeftOf,
  rowButtonOf,
} from '../mobile/EarnHoldingSections';
import { PositionPnlLine, useHoldingRedeem } from '../mobile/EarnPositionCard';
import { isCheckRow } from '../mobile/earnPositionModel';
import {
  hasPositionDetailPage,
  holdingRowActionOf,
  isLoanPositionCard,
  lendingMarketOf,
} from '../mobile/myPortfolio.utils';

import {
  TOTAL_CHEVRON_SLOT,
  positionTableColumns,
} from './positionTableLayout';

import type { IPositionTableColumns } from './positionTableLayout';
import type { IEarnHoldingRedeem } from '../mobile/EarnHoldingSections';
import type { IEarnPositionCardHandlers } from '../mobile/EarnPositionCard';
import type {
  IEarnPositionSectionAsset,
  IEarnPositionView,
} from '../mobile/earnPositionModel';
import type { IEarnHoldingRowAction } from '../mobile/myPortfolio.utils';

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];
// Where a row's text starts past its token (sm, $6) and their gap ($2): the
// lines hung under a row start here
const ROW_TEXT_INSET = '$8';

/** The row's button or Pending badge, at the end of its first column */
function HoldingRowAction({
  asset,
  action,
  redeem,
}: {
  asset: IEarnPositionSectionAsset;
  action: IEarnHoldingRowAction | undefined;
  redeem?: IEarnHoldingRedeem;
}) {
  const button = rowButtonOf(action);
  if (button) {
    return (
      <RowAction
        action={button}
        symbol={asset.symbol}
        tokenAddress={asset.address}
        redeem={redeem}
      />
    );
  }
  return action?.kind === 'pending' ? <PendingBadge asset={asset} /> : null;
}

function HoldingTableRow({
  asset,
  action,
  columns,
  redeem,
}: {
  asset: IEarnPositionSectionAsset;
  action: IEarnHoldingRowAction | undefined;
  columns: IPositionTableColumns;
  redeem?: IEarnHoldingRedeem;
}) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });
  // Lista's reward is unknown until Check reveals it: the name alone
  const isCheck = isCheckRow(asset);
  const days = daysLeftOf(asset.unlockAt);
  const actionNode = action ? (
    <HoldingRowAction asset={asset} action={action} redeem={redeem} />
  ) : null;
  return (
    <YStack {...columns.inset} py="$2" gap="$1">
      <XStack ai="center" minHeight={36} gap={PROTOCOL_TABLE_COLUMN_GAP}>
        <XStack {...columns.first} ai="center" gap="$2">
          <Token size="sm" tokenImageUri={asset.meta?.logoUrl} />
          <SizableText
            size="$bodyMdMedium"
            numberOfLines={1}
            flex={1}
            minWidth={0}
          >
            {asset.symbol}
          </SizableText>
          {actionNode ? (
            <XStack flexShrink={0} ml="$1">
              {actionNode}
            </XStack>
          ) : null}
        </XStack>
        <YStack {...columns.second} gap="$0.5">
          {isCheck ? null : (
            // The amount alone: the Value column beside it has the figure
            <ProtocolAssetBalanceText
              asset={asset}
              currencySymbol={currencyInfo.symbol}
              priceUnavailableLabel={priceUnavailableLabel}
              showFiatValue={false}
            />
          )}
          {days ? <DaysLeftText days={days} /> : null}
        </YStack>
        <Stack {...columns.value}>
          {isCheck ? null : (
            <ProtocolValueCell
              value={asset.value}
              currencySymbol={currencyInfo.symbol}
              priceUnavailableLabel={priceUnavailableLabel}
              isUnavailable={isProtocolAssetValueUnavailable(asset)}
              size="$bodyMdMedium"
              textAlign="right"
              justifyContent="flex-end"
              numberOfLines={1}
              fontVariant={TABULAR_NUMS}
            />
          )}
        </Stack>
      </XStack>
      <LendingCollateralLine asset={asset} pl={ROW_TEXT_INSET} />
    </YStack>
  );
}

/** A panel's header strip: its title, then what the two columns hold */
function SectionStrip({
  title,
  columns,
  isFirst,
}: {
  title: string;
  columns: IPositionTableColumns;
  isFirst: boolean;
}) {
  const intl = useIntl();
  // The first column names what the tokens are (Deposited, Supplied); this
  // one says how many: never a bare "Balance", which elsewhere is the
  // wallet's (demo 10-29)
  const balanceLabel = intl.formatMessage({
    id: ETranslations.content__amount,
  });
  const valueLabel = intl.formatMessage({ id: ETranslations.global_value });
  return (
    <XStack
      {...columns.inset}
      py="$2"
      mt={isFirst ? '$0' : '$2'}
      ai="center"
      bg="$bgSubdued"
      gap={PROTOCOL_TABLE_COLUMN_GAP}
    >
      <Stack {...columns.first}>
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          numberOfLines={1}
        >
          {title}
        </SizableText>
      </Stack>
      <Stack {...columns.second}>
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          numberOfLines={1}
        >
          {balanceLabel}
        </SizableText>
      </Stack>
      <Stack {...columns.value}>
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          numberOfLines={1}
        >
          {valueLabel}
        </SizableText>
      </Stack>
    </XStack>
  );
}

/**
 * A lending market's rewards as the table's last panel (demo 11-10): a line
 * per reward as the panels above have theirs, Claim beside its name as
 * every row's button sits, its amount and what it is worth. Nothing while
 * there is nothing to claim
 */
function LendingRewardsTableSection({
  columns,
}: {
  columns: IPositionTableColumns;
}) {
  const intl = useIntl();
  const rewards = useLendingCardRewards();
  if (!rewards) {
    return null;
  }
  return (
    <>
      <SectionStrip
        title={
          rewards.rewards.title ||
          intl.formatMessage({ id: ETranslations.earn_rewards })
        }
        columns={columns}
        isFirst={false}
      />
      <YStack testID="earn-portfolio-lending-rewards">
        {rewards.rewards.rows.map((row) => (
          <XStack
            key={row.key}
            {...columns.inset}
            py="$2"
            ai="center"
            minHeight={52}
            gap={PROTOCOL_TABLE_COLUMN_GAP}
          >
            <XStack {...columns.first} ai="center" gap="$2">
              <Token size="sm" tokenImageUri={row.logoURI} />
              <SizableText
                size="$bodyMdMedium"
                numberOfLines={1}
                flex={1}
                minWidth={0}
              >
                {row.symbol}
              </SizableText>
              <XStack flexShrink={0} ml="$1">
                <LendingRewardAction row={row} rewards={rewards} />
              </XStack>
            </XStack>
            <YStack {...columns.second}>
              <EarnText
                size="$bodyMd"
                color="$text"
                numberOfLines={1}
                fontVariant={TABULAR_NUMS}
                text={row.amount}
              />
            </YStack>
            <Stack {...columns.value}>
              {row.value ? (
                <EarnText
                  size="$bodyMdMedium"
                  color="$text"
                  textAlign="right"
                  numberOfLines={1}
                  fontVariant={TABULAR_NUMS}
                  text={row.value}
                />
              ) : null}
            </Stack>
          </XStack>
        ))}
      </YStack>
    </>
  );
}

/**
 * A holding's panels as the wallet DeFi Portfolio's sectioned table: a
 * subdued header strip per panel (its title, Amount, Value), then a line
 * per token, the row's own action beside its name (demo 11-03) and no room
 * held for rows
 * without one. The effective deposit hangs under the deposit rows'
 * balances, a lending supply's collateral switch under its name. The wide
 * detail page shows its holding with the same table
 */
export function HoldingSectionsTable({
  position,
  redeem,
  endInset,
  hasLendingRewards = false,
}: {
  position: IEarnPositionView;
  redeem?: IEarnHoldingRedeem;
  /** the room kept at the right: the chevron after the total above it */
  endInset?: number;
  /** a lending market's card: its rewards as the last panel */
  hasLendingRewards?: boolean;
}) {
  const { effectiveDeposit } = position;
  // Every row's action once, so the table knows whether it has any
  const sections = useMemo(
    () =>
      position.sections.map((section) => ({
        section,
        rows: section.assets.map((asset) => ({
          asset,
          action: holdingRowActionOf({
            kind: section.kind,
            asset,
            redeemable: Boolean(redeem),
          }),
        })),
      })),
    [position.sections, redeem],
  );
  const columns = positionTableColumns({
    hasActions: sections.some(({ rows }) =>
      rows.some(({ action }) => Boolean(action)),
    ),
    endInset,
  });
  return (
    <YStack>
      {sections.map(({ section, rows }, sectionIndex) => (
        <Fragment key={section.key}>
          <SectionStrip
            title={section.title}
            columns={columns}
            isFirst={sectionIndex === 0}
          />
          {rows.map(({ asset, action }, index) => (
            <HoldingTableRow
              key={`${section.key}-${asset.symbol}-${index}`}
              asset={asset}
              action={action}
              columns={columns}
              redeem={redeem}
            />
          ))}
          {effectiveDeposit &&
          (section.kind === 'deposited' || section.kind === 'supplied') ? (
            <XStack {...columns.inset} pb="$2" gap={PROTOCOL_TABLE_COLUMN_GAP}>
              <Stack {...columns.first} />
              <XStack
                flex={1}
                minWidth={0}
                ai="center"
                columnGap="$2"
                flexWrap="wrap"
              >
                <EffectiveDepositText effectiveDeposit={effectiveDeposit} />
              </XStack>
            </XStack>
          ) : null}
        </Fragment>
      ))}
      {hasLendingRewards ? (
        <LendingRewardsTableSection columns={columns} />
      ) : null}
    </YStack>
  );
}

/**
 * One holding in the wide layout: the phone card's header line on one row
 * (badge and name, then the PnL, the value and the way to the detail page,
 * the whole line opening it), the health factor of a loan, and the panels
 * as a table. The same view, the same Redeem and the same row actions as
 * the phone card. A lending market's card read from the market carries
 * what the market's own page did (demo 11-03, 11-10): History where the
 * others have their chevron, the transactions still out beside the name,
 * the Net APY, E-Mode and bonus on the Health Factor line, the market's
 * warnings, and its rewards as the table's last panel.
 */
function EarnPositionDesktopBlockCmp({
  position,
  onManage,
  onRedeem,
  onWarmRedeem,
}: { position: IEarnPositionView } & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const { value, meta, source, action, hasDeposit } = position;
  // The name and chevron brighten on hover, as the DeFi home's tile titles do
  const [isHovered, setIsHovered] = useState(false);
  // A loan's card has no page of its own on web (demo 11-10)
  const canOpen =
    Boolean(action) &&
    Boolean(onManage) &&
    hasPositionDetailPage(source) &&
    (platformEnv.isNative || !isLoanPositionCard(position));
  const openDetail =
    canOpen && action ? () => onManage?.(action.target) : undefined;
  const isLit = Boolean(openDetail) && isHovered;
  const redeem = useHoldingRedeem(position, onRedeem, onWarmRedeem);
  const lendingMarket = lendingMarketOf(position);
  // The values end under the header's own, its chevron's room kept
  const table = (
    <HoldingSectionsTable
      position={position}
      redeem={redeem}
      endInset={TOTAL_CHEVRON_SLOT}
      hasLendingRewards={Boolean(lendingMarket)}
    />
  );
  // After the value: the way to the detail page, a lending market's
  // History in its place, or the room alone, so every value in the card
  // ends on one edge
  let headerEnd = <Stack w="$5" />;
  if (openDetail) {
    headerEnd = (
      <Icon
        name="ChevronRightSmallOutline"
        size="$5"
        color={isLit ? '$icon' : '$iconSubdued'}
      />
    );
  } else if (lendingMarket) {
    headerEnd = <LendingHistoryButton market={lendingMarket} />;
  }
  return (
    <YStack gap="$2" testID={EarnTestIDs.portfolioItem(source.protocolName)}>
      <XStack
        ai="center"
        gap="$3"
        minHeight={32}
        {...(openDetail
          ? {
              role: 'button',
              onPress: openDetail,
              onHoverIn: () => setIsHovered(true),
              onHoverOut: () => setIsHovered(false),
              cursor: 'pointer',
              pressStyle: { opacity: 0.6 },
              ...buildKeyboardPressProps(openDetail, 2),
            }
          : {})}
      >
        <XStack ai="center" gap="$2" flex={1} minWidth={0}>
          <Badge badgeType="success" badgeSize="sm" flexShrink={0}>
            <Badge.Text>{position.badgeLabel}</Badge.Text>
          </Badge>
          {position.name ? (
            <SizableText
              size="$bodyMdMedium"
              color={
                isLit ? '$text' : DEFI_PORTFOLIO_DETAIL_POSITION_NAME_COLOR
              }
              numberOfLines={1}
              flexShrink={1}
            >
              {position.name}
            </SizableText>
          ) : null}
          {lendingMarket ? (
            <LendingPendingBadge market={lendingMarket} />
          ) : null}
        </XStack>
        {/* The PnL keeps clear of the value, so the two read apart */}
        <XStack ai="center" gap="$6" flexShrink={0}>
          {hasDeposit ? <PositionPnlLine position={source} /> : null}
          <XStack ai="center" gap="$1">
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
              fontVariant={TABULAR_NUMS}
            />
            {headerEnd}
          </XStack>
        </XStack>
      </XStack>
      {lendingMarket ? (
        <LendingCardScope market={lendingMarket}>
          <LendingHealthLine meta={meta} />
          <LendingAlerts />
          {table}
        </LendingCardScope>
      ) : (
        <>
          {meta?.kind === 'healthFactor' ? (
            <EarnPositionHealthFactorRow meta={meta} />
          ) : null}
          {table}
        </>
      )}
    </YStack>
  );
}

export const EarnPositionDesktopBlock = memo(EarnPositionDesktopBlockCmp);
