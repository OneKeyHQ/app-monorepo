import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ITableColumn } from '@onekeyhq/components';
import {
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { CommunityRecognizedBadge } from '@onekeyhq/kit/src/views/Market/components/CommunityRecognizedBadge';
import { MarketStarV2 } from '@onekeyhq/kit/src/views/Market/components/MarketStarV2';
import {
  MARKET_LIST_NAME_COLUMN_WIDTH,
  MARKET_LIST_STAR_COLUMN_WIDTH,
  MARKET_LIST_STAR_SLOT_WIDTH,
} from '@onekeyhq/kit/src/views/Market/marketDesktopLayoutConstants';
import {
  EMPTY_MARKET_VALUE,
  MARKET_CELL_LINE_GAP,
  MarketCellPrimary,
  MarketIdentityCell,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketListCell';
import { MarketSplitSortHeader } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketSplitSortHeader';
import type {
  IMarketSortOrder,
  IMarketSortState,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketSplitSortHeader';
import { MarketTokenAgeAddressLine } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenAgeAddressLine';
import type { IMarketTimeRangeValue } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ECopyFrom,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';

import { Txns } from '../../components/Txns';

import { getTokenAgeLabel } from './tokenAgeLabel';
import { WatchlistTokenIdentity } from './useWatchlistColumnsDesktop';

import type { IMarketToken } from '../../MarketTokenData';

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

export function useTrendingColumnsDesktop({
  networkId,
  timeRange = '1h',
  sort,
  onSort,
  hideTokenAge = false,
  copyFrom = ECopyFrom.Homepage,
}: {
  networkId?: string;
  timeRange?: IMarketTimeRangeValue;
  sort: IMarketSortState;
  onSort: (field: string, order: IMarketSortOrder) => void;
  /** Lists whose rows carry no `firstTradeTime` (banner detail) title the
   *  column "Name" and render the watchlist's spot-token cell: the token
   *  name at rest, the contract address on hover. */
  hideTokenAge?: boolean;
  copyFrom?: ECopyFrom;
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
              assetId={record.assetId}
              stockId={record.stockId}
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
        title: hideTokenAge
          ? intl.formatMessage({ id: ETranslations.global_name })
          : `${intl.formatMessage({
              id: ETranslations.global_name,
            })}/${intl.formatMessage({
              id: ETranslations.dexmarket_token_age,
            })}`,
        dataIndex: 'nameTokenAge',
        columnWidth: MARKET_LIST_NAME_COLUMN_WIDTH,
        render: (_: unknown, record: IMarketToken) => {
          if (hideTokenAge) {
            return (
              <WatchlistTokenIdentity record={record} copyFrom={copyFrom} />
            );
          }
          const ageLabel = getTokenAgeLabel(intl, record.firstTradeTime);

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
                <MarketTokenAgeAddressLine
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
              {
                field: 'marketCap',
                label: intl.formatMessage({ id: ETranslations.market_mcap }),
              },
              {
                field: 'price',
                // The slash is the separator between the two sort controls, so
                // it needs air on the label side rather than sitting flush.
                label: `/ ${intl.formatMessage({
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
              {Number.isFinite(record.price) ? record.price : '--'}
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
        title: intl.formatMessage(
          { id: ETranslations.market_change_in_range },
          { range: timeRange },
        ),
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
              formatter="priceChangeCapped"
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
        title: intl.formatMessage(
          { id: ETranslations.market_txns_in_range },
          { range: timeRange },
        ),
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
        title: intl.formatMessage(
          { id: ETranslations.market_volume_in_range },
          { range: timeRange },
        ),
        dataIndex: 'turnover',
        columnProps: { flex: 1 },
        render: (value: number) => <MarketValue value={value} currency />,
        renderSkeleton: () => <Skeleton width={90} height={16} />,
      },
    ],
    [copyFrom, hideTokenAge, intl, networkId, onSort, sort, timeRange],
  );
}
