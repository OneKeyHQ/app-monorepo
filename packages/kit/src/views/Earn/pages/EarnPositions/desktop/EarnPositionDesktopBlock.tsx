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
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { buildKeyboardPressProps } from '../../../components/desktopHome/earnDesktopPressable';
import { EarnTestIDs } from '../../../testIDs';
import {
  LendingCardScope,
  LendingCollateralLine,
  LendingHealthLine,
} from '../EarnLendingActions';
import { EarnPositionHealthFactorRow } from '../EarnPositionHealthFactorRow';
import {
  DaysLeftText,
  EffectiveDepositText,
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

/** The row's button or Pending badge, where the table's placement puts it */
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
          {columns.placement === 'name' && actionNode ? (
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
              textAlign={columns.placement === 'name' ? 'right' : 'left'}
              justifyContent={
                columns.placement === 'name' ? 'flex-end' : 'flex-start'
              }
              numberOfLines={1}
              fontVariant={TABULAR_NUMS}
            />
          )}
        </Stack>
        {columns.trailing && actionNode ? (
          <XStack {...columns.trailing}>{actionNode}</XStack>
        ) : null}
      </XStack>
      <LendingCollateralLine asset={asset} pl={ROW_TEXT_INSET} />
    </YStack>
  );
}

/**
 * A holding's panels as the wallet DeFi Portfolio's sectioned table: a
 * subdued header strip per panel (its title, Amount, Value), then a line
 * per token, the row's own action where the placement puts it (demo 11-03:
 * beside the name, or at the card's edge) and no room held for rows
 * without one. The effective deposit hangs under the deposit rows'
 * balances, a lending supply's collateral switch under its name. The wide
 * detail page shows its holding with the same table
 */
export function HoldingSectionsTable({
  position,
  redeem,
  endInset,
}: {
  position: IEarnPositionView;
  redeem?: IEarnHoldingRedeem;
  /** the room kept at the right: the chevron after the total above it */
  endInset?: number;
}) {
  const intl = useIntl();
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
  // The first column names what the tokens are (Deposited, Supplied); this
  // one says how many: never a bare "Balance", which elsewhere is the
  // wallet's (demo 10-29)
  const balanceLabel = intl.formatMessage({
    id: ETranslations.content__amount,
  });
  const valueLabel = intl.formatMessage({ id: ETranslations.global_value });
  return (
    <YStack>
      {sections.map(({ section, rows }, sectionIndex) => (
        <Fragment key={section.key}>
          <XStack
            {...columns.inset}
            py="$2"
            mt={sectionIndex === 0 ? '$0' : '$2'}
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
                {section.title}
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
    </YStack>
  );
}

/**
 * One holding in the wide layout: the phone card's header line on one row
 * (badge and name, then the PnL, the value and the way to the detail page,
 * the whole line opening it), the health factor of a loan, and the panels
 * as a table. The same view, the same Redeem and the same row actions as
 * the phone card. A lending market's card read from the market also has
 * the market's E-Mode on its Health Factor line (demo 11-03).
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
  const canOpen =
    Boolean(action) && Boolean(onManage) && hasPositionDetailPage(source);
  const openDetail =
    canOpen && action ? () => onManage?.(action.target) : undefined;
  const redeem = useHoldingRedeem(position, onRedeem, onWarmRedeem);
  const lendingMarket = lendingMarketOf(position);
  // The values end under the header's own, its chevron's room kept
  const table = (
    <HoldingSectionsTable
      position={position}
      redeem={redeem}
      endInset={TOTAL_CHEVRON_SLOT}
    />
  );
  // The name and chevron brighten on hover, as the DeFi home's tile titles do
  const [isHovered, setIsHovered] = useState(false);
  const isLit = Boolean(openDetail) && isHovered;

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
            {/* Without a detail page the chevron's place stays, so every
                value in the card ends on one edge */}
            {openDetail ? (
              <Icon
                name="ChevronRightSmallOutline"
                size="$5"
                color={isLit ? '$icon' : '$iconSubdued'}
              />
            ) : (
              <Stack w="$5" />
            )}
          </XStack>
        </XStack>
      </XStack>
      {lendingMarket ? (
        <LendingCardScope market={lendingMarket}>
          <LendingHealthLine meta={meta} />
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
