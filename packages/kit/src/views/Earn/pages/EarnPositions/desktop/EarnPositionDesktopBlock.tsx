import { Fragment, memo, useState } from 'react';

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
import { DeFiPositionHealthFactorRow } from '@onekeyhq/kit/src/components/DeFi/DeFiPositionHealthFactorRow';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ProtocolAssetBalanceText } from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/ProtocolAssetBalanceText';
import {
  BALANCE_FLEX_WITHOUT_REWARDS,
  POSITION_COLUMN_WIDTH,
  PROTOCOL_TABLE_COLUMN_GAP,
  USD_FLEX_WITHOUT_REWARDS,
} from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/ProtocolUnifiedTable';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EarnTestIDs } from '../../../testIDs';
import {
  DaysLeftText,
  EffectiveDepositText,
  PendingBadge,
  RowAction,
  daysLeftOf,
} from '../mobile/EarnHoldingSections';
import { PositionPnlLine, useHoldingRedeem } from '../mobile/EarnPositionCard';
import { isCheckRow } from '../mobile/earnPositionModel';
import {
  hasPositionDetailPage,
  holdingRowActionOf,
} from '../mobile/myPortfolio.utils';

import type { IEarnHoldingRedeem } from '../mobile/EarnHoldingSections';
import type { IEarnPositionCardHandlers } from '../mobile/EarnPositionCard';
import type {
  IEarnPositionSectionAsset,
  IEarnPositionSectionView,
  IEarnPositionView,
} from '../mobile/earnPositionModel';

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];
// Wide enough for the longest row action ("Sell Early") or the Pending badge
const ACTION_COLUMN_WIDTH = 112;

function HoldingTableRow({
  asset,
  section,
  redeem,
}: {
  asset: IEarnPositionSectionAsset;
  section: IEarnPositionSectionView;
  redeem?: IEarnHoldingRedeem;
}) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });
  const action = holdingRowActionOf({
    kind: section.kind,
    asset,
    redeemable: Boolean(redeem),
  });
  const button =
    action?.kind === 'redeem' || action?.kind === 'button' ? action : undefined;
  // Lista's reward is unknown until Check reveals it: the name alone
  const isCheck = isCheckRow(asset);
  const days = daysLeftOf(asset.unlockAt);
  return (
    <XStack
      px="$2"
      py="$2"
      ai="center"
      minHeight={52}
      gap={PROTOCOL_TABLE_COLUMN_GAP}
    >
      <XStack
        width={POSITION_COLUMN_WIDTH}
        flexShrink={0}
        minWidth={0}
        ai="center"
        gap="$2"
      >
        <Token size="sm" tokenImageUri={asset.meta?.logoUrl} />
        <SizableText
          size="$bodyMdMedium"
          numberOfLines={1}
          flex={1}
          minWidth={0}
        >
          {asset.symbol}
        </SizableText>
      </XStack>
      <YStack
        flex={BALANCE_FLEX_WITHOUT_REWARDS}
        flexBasis={0}
        minWidth={0}
        gap="$0.5"
      >
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
      <Stack
        flex={USD_FLEX_WITHOUT_REWARDS}
        flexBasis={0}
        minWidth={0}
        ai="flex-end"
      >
        {isCheck ? null : (
          <ProtocolValueCell
            value={asset.value}
            currencySymbol={currencyInfo.symbol}
            priceUnavailableLabel={priceUnavailableLabel}
            isUnavailable={isProtocolAssetValueUnavailable(asset)}
            size="$bodyMdMedium"
            textAlign="right"
            numberOfLines={1}
            fontVariant={TABULAR_NUMS}
          />
        )}
      </Stack>
      <XStack width={ACTION_COLUMN_WIDTH} flexShrink={0} jc="flex-end">
        {button ? (
          <RowAction action={button} symbol={asset.symbol} redeem={redeem} />
        ) : null}
        {action?.kind === 'pending' ? <PendingBadge asset={asset} /> : null}
      </XStack>
    </XStack>
  );
}

/**
 * A holding's panels as the wallet DeFi Portfolio's sectioned table: a
 * subdued header strip per panel (its title, Balance, Value), then a line
 * per token with the row's own action at the end, where the phone puts it.
 * The effective deposit hangs under the deposit rows' balances.
 */
function HoldingSectionsTable({
  position,
  redeem,
}: {
  position: IEarnPositionView;
  redeem?: IEarnHoldingRedeem;
}) {
  const intl = useIntl();
  const { effectiveDeposit } = position;
  const balanceLabel = intl.formatMessage({ id: ETranslations.global_balance });
  const valueLabel = intl.formatMessage({ id: ETranslations.global_value });
  return (
    <YStack>
      {position.sections.map((section, sectionIndex) => (
        <Fragment key={section.key}>
          <XStack
            px="$2"
            py="$2"
            mt={sectionIndex === 0 ? '$0' : '$2'}
            ai="center"
            bg="$bgSubdued"
            gap={PROTOCOL_TABLE_COLUMN_GAP}
          >
            <Stack width={POSITION_COLUMN_WIDTH} flexShrink={0} minWidth={0}>
              <SizableText
                size="$bodySmMedium"
                color="$textSubdued"
                numberOfLines={1}
              >
                {section.title}
              </SizableText>
            </Stack>
            <Stack
              flex={BALANCE_FLEX_WITHOUT_REWARDS}
              flexBasis={0}
              minWidth={0}
            >
              <SizableText size="$bodySmMedium" color="$textSubdued">
                {balanceLabel}
              </SizableText>
            </Stack>
            <Stack
              flex={USD_FLEX_WITHOUT_REWARDS}
              flexBasis={0}
              minWidth={0}
              ai="flex-end"
            >
              <SizableText size="$bodySmMedium" color="$textSubdued">
                {valueLabel}
              </SizableText>
            </Stack>
            <Stack width={ACTION_COLUMN_WIDTH} flexShrink={0} />
          </XStack>
          {section.assets.map((asset, index) => (
            <HoldingTableRow
              key={`${section.key}-${asset.symbol}-${index}`}
              asset={asset}
              section={section}
              redeem={redeem}
            />
          ))}
          {effectiveDeposit &&
          (section.kind === 'deposited' || section.kind === 'supplied') ? (
            <XStack px="$2" pb="$2" gap={PROTOCOL_TABLE_COLUMN_GAP}>
              <Stack width={POSITION_COLUMN_WIDTH} flexShrink={0} />
              <XStack
                flex={BALANCE_FLEX_WITHOUT_REWARDS}
                flexBasis={0}
                minWidth={0}
                ai="center"
                columnGap="$2"
                flexWrap="wrap"
              >
                <EffectiveDepositText effectiveDeposit={effectiveDeposit} />
              </XStack>
              <Stack
                flex={USD_FLEX_WITHOUT_REWARDS}
                flexBasis={0}
                minWidth={0}
              />
              <Stack width={ACTION_COLUMN_WIDTH} flexShrink={0} />
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
 * the phone card.
 */
function EarnPositionDesktopBlockCmp({
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
  const redeem = useHoldingRedeem(position, onRedeem);
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
              onPress: openDetail,
              onHoverIn: () => setIsHovered(true),
              onHoverOut: () => setIsHovered(false),
              cursor: 'pointer',
              pressStyle: { opacity: 0.6 },
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
        <XStack ai="center" gap="$3" flexShrink={0}>
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
            {openDetail ? (
              <Icon
                name="ChevronRightSmallOutline"
                size="$5"
                color={isLit ? '$icon' : '$iconSubdued'}
              />
            ) : null}
          </XStack>
        </XStack>
      </XStack>
      {meta?.kind === 'healthFactor' ? (
        <DeFiPositionHealthFactorRow healthFactor={meta.healthFactor} />
      ) : null}
      <HoldingSectionsTable position={position} redeem={redeem} />
    </YStack>
  );
}

export const EarnPositionDesktopBlock = memo(EarnPositionDesktopBlockCmp);
