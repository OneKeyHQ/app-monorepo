import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ITableColumn } from '@onekeyhq/components';
import {
  Icon,
  NATIVE_HIT_SLOP,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { CommunityRecognizedBadge } from '@onekeyhq/kit/src/views/Market/components/CommunityRecognizedBadge';
import { MarketStarV2 } from '@onekeyhq/kit/src/views/Market/components/MarketStarV2';
import {
  MARKET_LIST_NAME_COLUMN_WIDTH,
  MARKET_LIST_STAR_COLUMN_WIDTH,
  MARKET_LIST_STAR_SLOT_WIDTH,
} from '@onekeyhq/kit/src/views/Market/marketDesktopLayoutConstants';
import { MarketHoverRevealLine } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketHoverRevealLine';
import {
  MARKET_CELL_LINE_GAP,
  MARKET_CELL_SECONDARY_LINE_HEIGHT,
  MarketCellPrimary,
  MarketCellSecondary,
  MarketIdentityCell,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketListCell';
import { MarketSplitSortHeader } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketSplitSortHeader';
import type {
  IMarketSortOrder,
  IMarketSortState,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketSplitSortHeader';
import type { IMarketTimeRangeValue } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  ECopyFrom,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';

import { Txns } from '../../components/Txns';
import { getTokenAgeInfo } from '../../utils/tokenListHelpers';

import type { IMarketToken } from '../../MarketTokenData';
import type { GestureResponderEvent } from 'react-native';

const EMPTY_MARKET_VALUE = '--';

// The token age and the contract address share one line-height window and the
// pair slides up on hover, so the age is pushed out by the address rather than
// dissolving underneath it. 20px is the `$bodyMd` line box both lines use — the
// same subtitle size the Stocks table first column uses.
const TOKEN_SECONDARY_LINE_HEIGHT = MARKET_CELL_SECONDARY_LINE_HEIGHT;

// The age reads at full strength; the address that replaces it on hover is
// the design's regular, subdued face.
const AGE_TEXT_COLOR = '$text';
const ADDRESS_TEXT_PROPS = {
  size: '$bodySm',
  color: '$textSubdued',
} as const;

const TOKEN_AGE_TRANSLATION_MAP = {
  hour: ETranslations.dexmarket_token_age_h,
  day: ETranslations.dexmarket_token_age_d,
  month: ETranslations.dexmarket_token_age_m,
  year: ETranslations.dexmarket_token_age_y,
} as const;

function MarketValue({
  value,
  currency,
  subdued,
}: {
  value: number;
  currency?: boolean;
  subdued?: boolean;
}) {
  if (!Number.isFinite(value) || value === 0) {
    return (
      <SizableText
        size={subdued ? '$bodySm' : '$bodyLgMedium'}
        color={subdued ? '$textSubdued' : '$text'}
      >
        {EMPTY_MARKET_VALUE}
      </SizableText>
    );
  }

  return (
    <NumberSizeableText
      size={subdued ? '$bodySm' : '$bodyLgMedium'}
      color={subdued ? '$textSubdued' : '$text'}
      formatter="marketCap"
      formatterOptions={
        currency ? { currency: '$', capAtMaxT: true } : undefined
      }
    >
      {value}
    </NumberSizeableText>
  );
}

/**
 * Shortened contract address plus a copy button. Kept as its own component
 * because a column `render` callback is a plain function and cannot use hooks.
 */
function TokenContractAddressLine({ address }: { address: string }) {
  const { copyText } = useClipboard();

  const handleCopy = useCallback(
    (event: GestureResponderEvent) => {
      // Pressing anywhere on the row navigates to the token detail page.
      event.stopPropagation();
      copyText(address);
      defaultLogger.dex.actions.dexCopyCA({
        copyFrom: ECopyFrom.Homepage,
        copiedContent: address,
      });
    },
    [address, copyText],
  );

  return (
    <XStack
      height={TOKEN_SECONDARY_LINE_HEIGHT}
      alignItems="center"
      gap="$0.5"
      minWidth={0}
    >
      <MarketCellSecondary {...ADDRESS_TEXT_PROPS}>
        {accountUtils.shortenAddress({
          address,
          leadingLength: 6,
          trailingLength: 4,
        })}
      </MarketCellSecondary>
      <Stack
        cursor="pointer"
        hitSlop={NATIVE_HIT_SLOP}
        hoverStyle={{ opacity: 0.75 }}
        pressStyle={{ opacity: 0.5 }}
        onPress={handleCopy}
      >
        <Icon name="Copy3Outline" size="$3.5" color="$iconSubdued" />
      </Stack>
    </XStack>
  );
}

/**
 * Name-column subtitle for the Trending desktop table. It normally shows the
 * token age; while the row is hovered it slides up to reveal the copyable
 * contract address.
 *
 * The swap is CSS-only: the data row carries a Tamagui `group`, so both lines
 * render once and only the sliding wrapper reacts to the group's hover state.
 * Row-level JS hover state would mean a setState per row on every pointer move,
 * and the shared Table component exposes no row hover hook to piggyback on.
 */
function TrendingTokenSecondaryLine({
  address,
  ageLabel,
}: {
  address: string;
  ageLabel?: string;
}) {
  const ageLine = (
    <XStack
      height={TOKEN_SECONDARY_LINE_HEIGHT}
      alignItems="center"
      minWidth={0}
    >
      <MarketCellSecondary color={AGE_TEXT_COLOR}>
        {ageLabel ?? EMPTY_MARKET_VALUE}
      </MarketCellSecondary>
    </XStack>
  );

  if (!address) {
    return ageLine;
  }

  // With no age there is nothing to slide away from, so the address stands on
  // its own and its copy button stays reachable.
  if (!ageLabel) {
    return <TokenContractAddressLine address={address} />;
  }

  return (
    <MarketHoverRevealLine
      lineHeight={TOKEN_SECONDARY_LINE_HEIGHT}
      resting={ageLine}
      revealed={<TokenContractAddressLine address={address} />}
    />
  );
}

export function useTrendingColumnsDesktop({
  networkId,
  timeRange = '1h',
  sort,
  onSort,
}: {
  networkId?: string;
  timeRange?: IMarketTimeRangeValue;
  sort: IMarketSortState;
  onSort: (field: string, order: IMarketSortOrder) => void;
}): ITableColumn<IMarketToken>[] {
  const intl = useIntl();

  return useMemo(
    () => [
      {
        title: (
          <SizableText
            width={MARKET_LIST_STAR_SLOT_WIDTH}
            textAlign="center"
            size="$bodySmMedium"
            color="$textSubdued"
          >
            #
          </SizableText>
        ),
        dataIndex: 'star',
        // No right padding: the column's trailing space IS the design's 6px
        // gap to the name group, so the next column starts its logo flush.
        columnProps: { flexShrink: 0, pl: '$2', pr: 0 },
        columnWidth: MARKET_LIST_STAR_COLUMN_WIDTH,
        render: (_: unknown, record: IMarketToken) => (
          // The same centred slot the plain-icon lists use. `MarketStarV2` is an
          // `IconButton` whose box is wider than its glyph, but centring the box
          // centres the glyph, so it lands on the shared 12px offset.
          <Stack
            width={MARKET_LIST_STAR_SLOT_WIDTH}
            alignItems="center"
            justifyContent="center"
          >
            <MarketStarV2
              chainId={record.chainId || networkId || ''}
              contractAddress={record.address}
              from={EWatchlistFrom.Homepage}
              tokenSymbol={record.symbol}
              size="small"
              customIconSize="$4"
              isNative={record.isNative}
            />
          </Stack>
        ),
        renderSkeleton: () => (
          <Skeleton width={24} height={24} borderRadius="$full" />
        ),
      },
      {
        title: `${intl.formatMessage({
          id: ETranslations.global_name,
        })}/${intl.formatMessage({
          id: ETranslations.dexmarket_token_age,
        })}`,
        dataIndex: 'nameTokenAge',
        columnWidth: MARKET_LIST_NAME_COLUMN_WIDTH,
        render: (_: unknown, record: IMarketToken) => {
          const ageInfo = getTokenAgeInfo(record.firstTradeTime);
          const ageLabel = ageInfo
            ? intl.formatMessage(
                { id: TOKEN_AGE_TRANSLATION_MAP[ageInfo.unit] },
                { amount: ageInfo.amount },
              )
            : EMPTY_MARKET_VALUE;

          return (
            <MarketIdentityCell
              logo={
                <Token
                  size="lg"
                  borderRadius="$full"
                  tokenImageUri={record.tokenImageUri}
                  tokenImageUris={record.tokenImageUris}
                  networkImageUri={record.networkLogoUri}
                  fallbackIcon="CryptoCoinOutline"
                />
              }
              primary={
                <XStack alignItems="center" gap="$1" minWidth={0}>
                  <MarketCellPrimary flexShrink={1}>
                    {record.symbol}
                  </MarketCellPrimary>
                  {record.communityRecognized ? (
                    <CommunityRecognizedBadge />
                  ) : null}
                </XStack>
              }
              secondary={
                <TrendingTokenSecondaryLine
                  address={record.address}
                  ageLabel={ageLabel}
                />
              }
            />
          );
        },
        renderSkeleton: () => (
          <XStack alignItems="center" gap="$3">
            <Skeleton width={40} height={40} borderRadius="$full" />
            <YStack gap="$1">
              <Skeleton width={80} height={16} />
              <Skeleton width={40} height={12} />
            </YStack>
          </XStack>
        ),
      },
      {
        // Two sort controls in one column, per the design. The table sorts by
        // a single `dataIndex`, so this column opts out of its sorting (see
        // `TRENDING_CLIENT_SORT_FIELDS`) and drives the list state itself.
        title: (
          <MarketSplitSortHeader
            segments={[
              { field: 'marketCap', label: 'MCap' },
              {
                field: 'price',
                label: `/${intl.formatMessage({
                  id: ETranslations.global_price,
                })}`,
              },
            ]}
            sort={sort}
            onSort={onSort}
          />
        ),
        dataIndex: 'marketCapPrice',
        columnProps: { flex: 1.25 },
        render: (_: unknown, record: IMarketToken) => (
          <YStack gap={MARKET_CELL_LINE_GAP}>
            <MarketValue value={record.marketCap} currency />
            <NumberSizeableText
              size="$bodySm"
              color="$textSubdued"
              formatter={record.price > 1_000_000 ? 'marketCap' : 'price'}
              formatterOptions={{ currency: '$', capAtMaxT: true }}
            >
              {record.price}
            </NumberSizeableText>
          </YStack>
        ),
        renderSkeleton: () => (
          <YStack gap="$1">
            <Skeleton width={80} height={16} />
            <Skeleton width={64} height={12} />
          </YStack>
        ),
      },
      {
        title: `${timeRange} Change`,
        dataIndex: 'change24h',
        columnProps: { flex: 1 },
        render: (value: number, record: IMarketToken) => {
          if (record.priceChangeRaw === '-') {
            return <SizableText size="$bodyLgMedium">--</SizableText>;
          }
          const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
            priceChange: value,
          });
          return (
            <NumberSizeableText
              size="$bodyLgMedium"
              color={changeColor}
              formatter="priceChange"
              formatterOptions={{ showPlusMinusSigns }}
            >
              {value}
            </NumberSizeableText>
          );
        },
        renderSkeleton: () => <Skeleton width={60} height={16} />,
      },
      {
        title: intl.formatMessage({ id: ETranslations.dexmarket_liquidity }),
        dataIndex: 'liquidity',
        columnProps: { flex: 1 },
        render: (value: number) => <MarketValue value={value} currency />,
        renderSkeleton: () => <Skeleton width={80} height={16} />,
      },
      {
        title: `${timeRange} ${intl.formatMessage({
          id: ETranslations.dexmarket_txns,
        })}`,
        dataIndex: 'transactions',
        columnProps: { flex: 1 },
        render: (value: number, record: IMarketToken) => (
          <Txns transactions={value} walletInfo={record.walletInfo} />
        ),
        renderSkeleton: () => (
          <YStack gap="$1">
            <Skeleton width={50} height={14} />
            <Skeleton width={64} height={12} />
          </YStack>
        ),
      },
      {
        title: `${timeRange} Volume`,
        dataIndex: 'turnover',
        columnProps: { flex: 1 },
        render: (value: number) => <MarketValue value={value} currency />,
        renderSkeleton: () => <Skeleton width={90} height={16} />,
      },
    ],
    [intl, networkId, onSort, sort, timeRange],
  );
}
