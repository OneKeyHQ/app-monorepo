import { useMemo } from 'react';
import type { ReactNode } from 'react';

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
import {
  MarketPerpsStarV2,
  MarketStarV2,
} from '@onekeyhq/kit/src/views/Market/components/MarketStarV2';
import {
  LeverageBadge,
  PerpDexBadge,
  StockSourceLogo,
  SubtitleText,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import {
  MARKET_LIST_METRIC_COLUMN_PROPS,
  MARKET_LIST_NAME_COLUMN_WIDTH,
  MARKET_LIST_STAR_COLUMN_WIDTH,
  MARKET_LIST_STAR_SLOT_WIDTH,
} from '@onekeyhq/kit/src/views/Market/marketDesktopLayoutConstants';
import { MarketHoverRevealLine } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketHoverRevealLine';
import {
  EMPTY_MARKET_VALUE,
  MARKET_CELL_LOGO_GAP,
  MARKET_CELL_PRIMARY_SIZE,
  MARKET_CELL_SUBTITLE_LINE_HEIGHT,
  MARKET_CELL_SUBTITLE_SIZE,
  MarketCellPrimary,
  MarketIdentityCell,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketListCell';
import { TokenContractAddressLine } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenAgeAddressLine';
import { MarketVariantLogoGroup } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketVariantLogoGroup';
import { MARKET_FIXED_24H_RANGE } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ECopyFrom,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';

import { getMarketWatchlistRowKind } from '../../utils/marketWatchlistRowKind';

import type { IMarketToken } from '../../MarketTokenData';
import type { IntlShape } from 'react-intl';

function WatchlistMetricValue({
  value,
  formatter,
}: {
  value: number;
  formatter: 'price' | 'marketCap';
}) {
  // A market cap or volume of 0 means the API had nothing; a price of 0 is
  // still a price.
  const isMissing =
    !Number.isFinite(value) || (formatter === 'marketCap' && value === 0);
  if (isMissing) {
    return (
      <SizableText size={MARKET_CELL_PRIMARY_SIZE}>
        {EMPTY_MARKET_VALUE}
      </SizableText>
    );
  }

  return (
    <NumberSizeableText
      size={MARKET_CELL_PRIMARY_SIZE}
      formatter={
        formatter === 'price' && value > 1_000_000 ? 'marketCap' : formatter
      }
      formatterOptions={{ currency: '$', capAtMaxT: true }}
    >
      {value}
    </NumberSizeableText>
  );
}

function WatchlistChangeValue({
  value,
  priceChangeRaw,
}: {
  value: number;
  priceChangeRaw?: string;
}) {
  if (priceChangeRaw === '-' || !Number.isFinite(value)) {
    return (
      <SizableText size={MARKET_CELL_PRIMARY_SIZE}>
        {EMPTY_MARKET_VALUE}
      </SizableText>
    );
  }

  const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
    priceChange: value,
  });
  return (
    <NumberSizeableText
      size={MARKET_CELL_PRIMARY_SIZE}
      color={changeColor}
      formatter="priceChangeCapped"
      formatterOptions={{ showPlusMinusSigns }}
    >
      {value}
    </NumberSizeableText>
  );
}

/** The Stocks table's resting company line, also used by top-coin listings. */
function ListingSubtitle({ children }: { children: string }) {
  return (
    <SizableText
      height={MARKET_CELL_SUBTITLE_LINE_HEIGHT}
      size={MARKET_CELL_SUBTITLE_SIZE}
      color="$textSubdued"
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {children}
    </SizableText>
  );
}

function ListingSymbol({ children }: { children: string }) {
  return (
    <SizableText
      size={MARKET_CELL_PRIMARY_SIZE}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {children}
    </SizableText>
  );
}

function ListingLogo({ uri }: { uri: string }) {
  return (
    <Token
      size="lg"
      borderRadius="$full"
      tokenImageUri={uri}
      fallbackIcon="CryptoCoinOutline"
    />
  );
}

/**
 * The Stocks and Top Coins first-column frame, which spot token rows share so
 * every non-perps row reads the same: the 24px symbol line sits directly on the
 * 20px subtitle line with no gap between them.
 */
function ListingIdentityCell({
  logo,
  primary,
  subtitle,
}: {
  logo: ReactNode;
  primary: ReactNode;
  subtitle: ReactNode;
}) {
  return (
    <XStack
      width="100%"
      minWidth={0}
      overflow="hidden"
      alignItems="center"
      gap={MARKET_CELL_LOGO_GAP}
    >
      {logo}
      <YStack flex={1} minWidth={0} justifyContent="center">
        {primary}
        {subtitle}
      </YStack>
    </XStack>
  );
}

/** Stocks-table first column: ticker over the company name, variants on hover. */
export function WatchlistStockIdentity({
  record,
  intl,
}: {
  record: IMarketToken;
  intl: IntlShape;
}) {
  const variants = record.stockVariants;
  return (
    <ListingIdentityCell
      logo={<ListingLogo uri={record.tokenImageUri} />}
      primary={<ListingSymbol>{record.symbol}</ListingSymbol>}
      subtitle={
        <MarketHoverRevealLine
          lineHeight={MARKET_CELL_SUBTITLE_LINE_HEIGHT}
          resting={<ListingSubtitle>{record.name}</ListingSubtitle>}
          revealed={
            variants?.length ? (
              <XStack
                height={MARKET_CELL_SUBTITLE_LINE_HEIGHT}
                alignItems="center"
                gap="$1"
                minWidth={0}
              >
                <SizableText
                  size={MARKET_CELL_SUBTITLE_SIZE}
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {intl.formatMessage(
                    { id: ETranslations.market_number_tokens },
                    { number: variants.length },
                  )}
                </SizableText>
                <MarketVariantLogoGroup variants={variants} />
              </XStack>
            ) : undefined
          }
        />
      }
    />
  );
}

/** Top Coins first column: upper-cased symbol over the asset name. */
export function WatchlistAssetIdentity({ record }: { record: IMarketToken }) {
  return (
    <ListingIdentityCell
      logo={<ListingLogo uri={record.tokenImageUri} />}
      primary={<ListingSymbol>{record.symbol.toUpperCase()}</ListingSymbol>}
      subtitle={
        record.name ? <ListingSubtitle>{record.name}</ListingSubtitle> : null
      }
    />
  );
}

/** Perps-table first column: name with leverage and DEX badges over the subtitle. */
export function WatchlistPerpsIdentity({ record }: { record: IMarketToken }) {
  const { dexLabel } = parseDexCoin(record.perpsCoin ?? '');
  return (
    <MarketIdentityCell
      logo={
        <Token
          size="lg"
          borderRadius="$full"
          tokenImageUri={record.tokenImageUri}
          tokenImageUris={record.tokenImageUris}
          fallbackIcon="CryptoCoinOutline"
        />
      }
      primary={
        <XStack alignItems="center" gap="$1" minWidth={0}>
          <MarketCellPrimary flexShrink={1} userSelect="none">
            {record.symbol}
          </MarketCellPrimary>
          {record.maxLeverage ? (
            <LeverageBadge leverage={record.maxLeverage} />
          ) : null}
          <PerpDexBadge dexLabel={dexLabel} />
        </XStack>
      }
      secondary={
        record.perpsSubtitle ? (
          // The list tables run their subtitle at the row's own secondary
          // size rather than the badge default.
          <SubtitleText
            subtitle={record.perpsSubtitle}
            size={MARKET_CELL_SUBTITLE_SIZE}
          />
        ) : null
      }
    />
  );
}

/**
 * A spot token's subtitle reads like the listing rows beside it: the full name
 * at rest, the copyable contract address sliding in on hover. The name shows
 * even when it repeats the symbol, so every row keeps the same shape; only a
 * token with no name lets the address take the line.
 */
export function WatchlistTokenSubtitle({
  name,
  address,
  copyFrom,
}: {
  name: string;
  address: string;
  copyFrom: ECopyFrom;
}) {
  const displayName = name.trim();
  const addressLine = address ? (
    <TokenContractAddressLine
      address={address}
      copyFrom={copyFrom}
      lineHeight={MARKET_CELL_SUBTITLE_LINE_HEIGHT}
      size={MARKET_CELL_SUBTITLE_SIZE}
    />
  ) : undefined;

  if (!displayName) {
    return addressLine ?? null;
  }

  return (
    <MarketHoverRevealLine
      lineHeight={MARKET_CELL_SUBTITLE_LINE_HEIGHT}
      resting={<ListingSubtitle>{displayName}</ListingSubtitle>}
      revealed={addressLine}
    />
  );
}

/** Spot token first column: symbol with badges over the name/address line. */
export function WatchlistTokenIdentity({
  record,
  copyFrom,
}: {
  record: IMarketToken;
  copyFrom: ECopyFrom;
}) {
  return (
    <ListingIdentityCell
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
          <MarketCellPrimary flexShrink={1}>{record.symbol}</MarketCellPrimary>
          <StockSourceLogo stock={record.stock} />
          {record.communityRecognized ? <CommunityRecognizedBadge /> : null}
        </XStack>
      }
      subtitle={
        <WatchlistTokenSubtitle
          name={record.name}
          address={record.address}
          copyFrom={copyFrom}
        />
      }
    />
  );
}

/**
 * Desktop columns for the Favorites table. Every non-perps row shares the
 * Stocks / Top Coins first-column frame (symbol over a name subtitle, with a
 * hover reveal where there is something to reveal), perps rows mirror the
 * Perps table, and the metric columns are the fixed
 * `Price / 24h change / MCap / 24h volume` set from the design. The watchlist
 * is ordered by drag, so no header sorts.
 */
export function useWatchlistColumnsDesktop({
  networkId,
  watchlistFrom = EWatchlistFrom.Homepage,
  copyFrom = ECopyFrom.Homepage,
  hiddenDesktopColumns,
}: {
  networkId?: string;
  watchlistFrom?: EWatchlistFrom;
  copyFrom?: ECopyFrom;
  hiddenDesktopColumns?: readonly string[];
}): ITableColumn<IMarketToken>[] {
  const intl = useIntl();

  return useMemo(() => {
    const columns: ITableColumn<IMarketToken>[] = [
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
        render: (_: unknown, record: IMarketToken) => {
          return (
            <Stack
              width={MARKET_LIST_STAR_SLOT_WIDTH}
              alignItems="center"
              justifyContent="center"
            >
              {record.perpsCoin ? (
                <MarketPerpsStarV2
                  perpsCoin={record.perpsCoin}
                  size="small"
                  customIconSize="$4"
                />
              ) : (
                <MarketStarV2
                  assetId={record.assetId}
                  stockId={record.stockId}
                  chainId={record.chainId || networkId || ''}
                  contractAddress={record.address}
                  from={watchlistFrom}
                  tokenSymbol={record.symbol}
                  size="small"
                  customIconSize="$4"
                  isNative={record.isNative}
                />
              )}
            </Stack>
          );
        },
        renderSkeleton: () => (
          <Skeleton width={24} height={24} borderRadius="$full" />
        ),
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_name }),
        dataIndex: 'name',
        columnWidth: MARKET_LIST_NAME_COLUMN_WIDTH,
        // No left padding: the star column already spends the shared star-to-
        // logo distance, so the logo starts on this column's edge.
        columnProps: { flexShrink: 0, pl: 0, pr: '$2' },
        render: (_: unknown, record: IMarketToken) => {
          switch (getMarketWatchlistRowKind(record)) {
            case 'perps':
              return <WatchlistPerpsIdentity record={record} />;
            case 'stock':
              return <WatchlistStockIdentity record={record} intl={intl} />;
            case 'asset':
              return <WatchlistAssetIdentity record={record} />;
            default:
              return (
                <WatchlistTokenIdentity record={record} copyFrom={copyFrom} />
              );
          }
        },
        renderSkeleton: () => (
          <XStack alignItems="center" gap={MARKET_CELL_LOGO_GAP}>
            <Skeleton width={40} height={40} borderRadius="$full" />
            <YStack gap="$1">
              <Skeleton width={80} height={16} />
              <Skeleton width={60} height={12} />
            </YStack>
          </XStack>
        ),
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_price }),
        dataIndex: 'price',
        columnProps: MARKET_LIST_METRIC_COLUMN_PROPS,
        render: (_: unknown, record: IMarketToken) => (
          <WatchlistMetricValue value={record.price} formatter="price" />
        ),
        renderSkeleton: () => <Skeleton width={70} height={16} />,
      },
      {
        title: intl.formatMessage(
          { id: ETranslations.market_change_in_range },
          { range: MARKET_FIXED_24H_RANGE },
        ),
        dataIndex: 'change24h',
        columnProps: MARKET_LIST_METRIC_COLUMN_PROPS,
        render: (_: unknown, record: IMarketToken) => (
          <WatchlistChangeValue
            value={record.change24h}
            priceChangeRaw={record.priceChangeRaw}
          />
        ),
        renderSkeleton: () => <Skeleton width={60} height={16} />,
      },
      {
        title: intl.formatMessage({ id: ETranslations.market_mcap }),
        dataIndex: 'marketCap',
        columnProps: MARKET_LIST_METRIC_COLUMN_PROPS,
        render: (_: unknown, record: IMarketToken) => (
          <WatchlistMetricValue
            value={record.marketCap}
            formatter="marketCap"
          />
        ),
        renderSkeleton: () => <Skeleton width={80} height={16} />,
      },
      {
        title: intl.formatMessage(
          { id: ETranslations.market_volume_in_range },
          { range: MARKET_FIXED_24H_RANGE },
        ),
        dataIndex: 'turnover',
        columnProps: MARKET_LIST_METRIC_COLUMN_PROPS,
        render: (_: unknown, record: IMarketToken) => (
          <WatchlistMetricValue value={record.turnover} formatter="marketCap" />
        ),
        renderSkeleton: () => <Skeleton width={90} height={16} />,
      },
    ];

    if (!hiddenDesktopColumns?.length) {
      return columns;
    }

    return columns.filter(
      (column) => !hiddenDesktopColumns.includes(String(column.dataIndex)),
    );
  }, [copyFrom, hiddenDesktopColumns, intl, networkId, watchlistFrom]);
}
