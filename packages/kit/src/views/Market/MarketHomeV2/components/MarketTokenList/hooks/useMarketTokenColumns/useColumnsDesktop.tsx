import { useMemo } from 'react';

import { type IntlShape, useIntl } from 'react-intl';

import type { ITableColumn } from '@onekeyhq/components';
import {
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { LazyTooltip } from '@onekeyhq/components/src/actions/LazyTooltip';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { CommunityRecognizedBadge } from '@onekeyhq/kit/src/views/Market/components/CommunityRecognizedBadge';
import {
  MarketPerpsStarV2,
  MarketStarV2,
} from '@onekeyhq/kit/src/views/Market/components/MarketStarV2';
import {
  LeverageBadge,
  SubtitleText,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ECopyFrom,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';

import { TokenIdentityItem } from '../../components/TokenIdentityItem';
import { Txns } from '../../components/Txns';
import {
  getStockMarketCapValue,
  getStockPeRatioValue,
  getStockVolume24hValue,
  getTokenAgeInfo,
} from '../../utils/tokenListHelpers';

import type { IMarketToken } from '../../MarketTokenData';

const TOKEN_AGE_TRANSLATION_MAP = {
  hour: ETranslations.dexmarket_token_age_h,
  day: ETranslations.dexmarket_token_age_d,
  month: ETranslations.dexmarket_token_age_m,
  year: ETranslations.dexmarket_token_age_y,
} as const;

const EMPTY_MARKET_VALUE = '--';

// Redesign (flag-on) desktop column order: merges Name/Token Age into one
// column and drops the standalone uniqueTraders/tokenAge columns.
const REDESIGN_COLUMN_ORDER = [
  'star',
  'name',
  'price',
  'change24h',
  'marketCap',
  'liquidity',
  'transactions',
  'holders',
  'turnover',
];

// Figma: these headers carry a dotted underline plus an explainer tooltip.
// Demo copy is hardcoded English (P1-2 finalizes wording via i18n later).
const REDESIGN_HEADER_TOOLTIPS: Record<string, string> = {
  marketCap: 'Circulating market value of the token.',
  liquidity: 'Total liquidity available in pools.',
  transactions: 'Buy and sell transactions in the selected time range.',
  holders: 'Number of addresses holding the token.',
  turnover: 'Trading volume in the selected time range.',
};

function renderRedesignHeaderTitle(label: string, tooltip: string) {
  return (
    <LazyTooltip
      placement="top"
      renderTrigger={
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          textDecorationLine="underline"
          style={
            {
              textDecorationStyle: 'dotted',
              textUnderlinePosition: 'from-font',
            } as any
          }
        >
          {label}
        </SizableText>
      }
      renderContent={tooltip}
    />
  );
}

function getDefaultMarketValue(text: number) {
  return text === 0 ? EMPTY_MARKET_VALUE : text;
}

// Shared by the flag-off tokenAge column and the flag-on Name cell subtitle.
function formatTokenAgeLabel(
  intl: IntlShape,
  firstTradeTime: number | undefined,
): string | undefined {
  const ageInfo = getTokenAgeInfo(firstTradeTime);
  if (!ageInfo) {
    return undefined;
  }

  return intl.formatMessage(
    { id: TOKEN_AGE_TRANSLATION_MAP[ageInfo.unit] },
    { amount: ageInfo.amount },
  );
}

function buildRedesignShortAddress(record: IMarketToken) {
  return record.address
    ? accountUtils.shortenAddress({
        address: record.address,
        leadingLength: 6,
        trailingLength: 4,
      })
    : '';
}

function renderRedesignTokenIdentity(
  record: IMarketToken,
  intl: IntlShape,
  showReasonTag: boolean,
) {
  const ageLabel = formatTokenAgeLabel(intl, record.firstTradeTime);
  const shortAddress = buildRedesignShortAddress(record);
  return (
    <XStack
      alignItems="center"
      gap={14}
      userSelect="none"
      minWidth={0}
      overflow="hidden"
    >
      <Token
        size="lg"
        borderRadius="$full"
        tokenImageUri={record.tokenImageUri}
        tokenImageUris={record.tokenImageUris}
        networkImageUri={record.networkLogoUri}
        fallbackIcon="CryptoCoinOutline"
      />
      <YStack flex={1} minWidth={0} gap="$1">
        <XStack alignItems="center" gap="$1" minWidth={0}>
          <SizableText
            size="$bodyLgMedium"
            numberOfLines={1}
            maxWidth="$32"
            flexShrink={1}
            ellipsizeMode="tail"
          >
            {record.symbol}
          </SizableText>
          <XStack alignItems="center" gap={6} flexShrink={0}>
            {record.communityRecognized ? <CommunityRecognizedBadge /> : null}
            {showReasonTag ? (
              // Mock reason tag placeholder (P1-3 scope wires real data later).
              <XStack
                alignItems="center"
                gap="$1"
                minWidth={27}
                px="$1"
                py="$0.5"
                borderRadius="$1"
                bg="$bgHover"
              >
                <Icon name="Xbrand" size="$3" color="$iconSubdued" />
                <SizableText size="$bodyXs" color="$textSubdued">
                  #1
                </SizableText>
              </XStack>
            ) : null}
          </XStack>
        </XStack>
        <XStack alignItems="center" gap="$1" minWidth={0}>
          {ageLabel ? (
            <SizableText size="$bodySmMedium" color="$text" flexShrink={0}>
              {ageLabel}
            </SizableText>
          ) : null}
          {shortAddress ? (
            <SizableText
              size="$bodySm"
              color="$textDisabled"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {shortAddress}
            </SizableText>
          ) : null}
        </XStack>
      </YStack>
    </XStack>
  );
}

function shouldUseLightweightCell(
  index: number | undefined,
  deferRichRowAfterIndex: number | undefined,
) {
  return (
    deferRichRowAfterIndex !== undefined &&
    (index ?? 0) >= deferRichRowAfterIndex
  );
}

function formatLightweightMarketValue(value: unknown) {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    (typeof value === 'number' && !Number.isFinite(value))
  ) {
    return EMPTY_MARKET_VALUE;
  }

  const numericValue =
    typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  const absValue = Math.abs(numericValue);
  if (absValue >= 1_000_000_000) {
    return `${(numericValue / 1_000_000_000).toFixed(absValue >= 10_000_000_000 ? 0 : 1)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${(numericValue / 1_000_000).toFixed(absValue >= 10_000_000 ? 0 : 1)}M`;
  }
  if (absValue >= 1000) {
    return `${(numericValue / 1000).toFixed(absValue >= 10_000 ? 0 : 1)}K`;
  }
  if (absValue > 0 && absValue < 0.01) {
    return numericValue.toPrecision(3);
  }
  if (absValue % 1 === 0) {
    return String(numericValue);
  }
  return numericValue.toFixed(absValue >= 100 ? 1 : 2);
}

function renderLightweightText(value: unknown) {
  return (
    <SizableText size="$bodyMd" numberOfLines={1} ellipsizeMode="tail">
      {formatLightweightMarketValue(value)}
    </SizableText>
  );
}

function renderLightweightTokenIdentity(record: IMarketToken) {
  const subtitle = record.address
    ? accountUtils.shortenAddress({
        address: record.address,
        leadingLength: 6,
        trailingLength: 4,
      })
    : record.name;

  return (
    <XStack
      alignItems="center"
      gap="$3"
      userSelect="none"
      minWidth={0}
      overflow="hidden"
    >
      <Stack width={32} height={32} borderRadius="$full" bg="$bgStrong" />
      <Stack flex={1} minWidth={0}>
        <SizableText
          size="$bodyLgMedium"
          numberOfLines={1}
          maxWidth="$32"
          flexShrink={1}
          ellipsizeMode="tail"
        >
          {record.symbol}
        </SizableText>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {subtitle}
        </SizableText>
      </Stack>
    </XStack>
  );
}

export const useColumnsDesktop = (
  networkId?: string,
  isWatchlistMode?: boolean,
  hideTokenAge?: boolean,
  watchlistFrom?: EWatchlistFrom,
  copyFrom?: ECopyFrom,
  hasStock?: boolean,
  showStockSubtitle?: boolean,
  hiddenDesktopColumns?: readonly string[],
  change24hColumnTitle?: string,
  useStockMetadataColumns?: boolean,
  deferRichRowAfterIndex?: number,
  redesignEnabled?: boolean,
): ITableColumn<IMarketToken>[] => {
  const { gtLg, gtXl } = useMedia();
  const intl = useIntl();

  return useMemo<ITableColumn<IMarketToken>[]>(() => {
    const watchlistNameWidth = gtLg ? 340 : 260;
    const shouldRenderRichCell = (index?: number) =>
      !shouldUseLightweightCell(index, deferRichRowAfterIndex);

    const columns = [
      {
        title: (
          <SizableText pl="$3.5" size="$bodyMd" color="$textSubdued">
            #
          </SizableText>
        ) as any,
        dataIndex: 'star',
        columnWidth: 50,
        render: (_: unknown, record: IMarketToken, index?: number) => {
          if (!shouldRenderRichCell(index)) {
            return (
              <Stack pl="$2">
                <Stack width={24} height={24} />
              </Stack>
            );
          }

          return (
            <Stack pl="$2">
              {record.perpsCoin ? (
                <MarketPerpsStarV2 perpsCoin={record.perpsCoin} size="small" />
              ) : (
                <MarketStarV2
                  chainId={record.chainId || networkId || ''}
                  contractAddress={record.address}
                  from={watchlistFrom || EWatchlistFrom.Homepage}
                  tokenSymbol={record.symbol}
                  size="small"
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
        // Redesign merges the standalone tokenAge column into this one;
        // title is a mock hardcoded label per Figma (not localized yet).
        title: redesignEnabled
          ? 'Name/Token Age'
          : intl.formatMessage({ id: ETranslations.global_name }),
        dataIndex: 'name',
        columnWidth: (() => {
          if (isWatchlistMode) return watchlistNameWidth;
          if (hasStock && showStockSubtitle) return 240;
          return 200;
        })(),
        render: (_: unknown, record: IMarketToken, index?: number) => {
          const renderRichCell = shouldRenderRichCell(index);
          if (!renderRichCell) {
            return renderLightweightTokenIdentity(record);
          }

          if (redesignEnabled && !record.perpsCoin) {
            return renderRedesignTokenIdentity(record, intl, gtXl);
          }

          return record.perpsCoin ? (
            <XStack
              alignItems="center"
              gap="$3"
              userSelect="none"
              minWidth={0}
              overflow="hidden"
            >
              <Token
                size="md"
                borderRadius="$full"
                tokenImageUri={record.tokenImageUri}
                tokenImageUris={record.tokenImageUris}
                fallbackIcon="CryptoCoinOutline"
              />
              <Stack flex={1} minWidth={0}>
                <XStack alignItems="center" gap="$1" minWidth={0}>
                  <SizableText
                    size="$bodyLgMedium"
                    numberOfLines={1}
                    maxWidth="$32"
                    flexShrink={1}
                    ellipsizeMode="tail"
                  >
                    {record.symbol}
                  </SizableText>
                  {record.maxLeverage ? (
                    <LeverageBadge leverage={record.maxLeverage} />
                  ) : null}
                </XStack>
                {record.perpsSubtitle ? (
                  <SubtitleText subtitle={record.perpsSubtitle} />
                ) : null}
              </Stack>
            </XStack>
          ) : (
            <TokenIdentityItem
              tokenLogoURI={record.tokenImageUri}
              tokenLogoURIs={record.tokenImageUris}
              networkLogoURI={record.networkLogoUri}
              networkId={record.networkId}
              symbol={record.symbol}
              address={record.address}
              showCopyButton
              copyFrom={copyFrom || ECopyFrom.Homepage}
              communityRecognized={record.communityRecognized}
              stock={record.stock}
              showStockSubtitle={showStockSubtitle}
            />
          );
        },
        renderSkeleton: () => (
          <XStack alignItems="center" gap="$3">
            <XStack position="relative">
              <Skeleton width={32} height={32} borderRadius="$full" />
            </XStack>
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
        columnProps: { flex: 1 },
        render: (text: string, _record: IMarketToken, index?: number) => {
          if (!shouldRenderRichCell(index)) {
            return renderLightweightText(text);
          }

          return (
            <NumberSizeableText
              size="$bodyMd"
              formatter={Number(text) > 1_000_000 ? 'marketCap' : 'price'}
              formatterOptions={{ currency: '$', capAtMaxT: true }}
            >
              {text}
            </NumberSizeableText>
          );
        },
        renderSkeleton: () => <Skeleton width={70} height={16} />,
      },
      {
        title:
          change24hColumnTitle ??
          `${intl.formatMessage({
            id: ETranslations.dexmarket_token_change,
          })}(%)`,
        dataIndex: 'change24h',
        columnProps: { flex: 1 },
        render: (text: number, record: IMarketToken, index?: number) => {
          if (!shouldRenderRichCell(index)) {
            return renderLightweightText(
              record.priceChangeRaw === '-' ? EMPTY_MARKET_VALUE : text,
            );
          }

          if (record.priceChangeRaw === '-') {
            return (
              <SizableText size="$bodyMd" color="$textSubdued">
                --
              </SizableText>
            );
          }

          const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
            priceChange: text,
          });
          return (
            <NumberSizeableText
              size="$bodyMd"
              formatter="priceChange"
              color={changeColor}
              formatterOptions={{
                showPlusMinusSigns,
              }}
            >
              {text}
            </NumberSizeableText>
          );
        },
        renderSkeleton: () => <Skeleton width={60} height={16} />,
      },
      isWatchlistMode && !useStockMetadataColumns
        ? undefined
        : {
            title: intl.formatMessage({ id: ETranslations.global_market_cap }),
            dataIndex: 'marketCap',
            columnProps: { flex: 1 },
            render: (text: number, record: IMarketToken, index?: number) => {
              const value = useStockMetadataColumns
                ? (getStockMarketCapValue(record) ?? EMPTY_MARKET_VALUE)
                : getDefaultMarketValue(text);

              if (!shouldRenderRichCell(index)) {
                return renderLightweightText(value);
              }

              return (
                <NumberSizeableText
                  size="$bodyMd"
                  formatter="marketCap"
                  formatterOptions={{ currency: '$', capAtMaxT: true }}
                >
                  {value}
                </NumberSizeableText>
              );
            },
            renderSkeleton: () => <Skeleton width={80} height={16} />,
          },
      isWatchlistMode && !useStockMetadataColumns
        ? undefined
        : {
            title: useStockMetadataColumns
              ? intl.formatMessage({
                  id: ETranslations.dexmarket_stock_24h_volume,
                })
              : intl.formatMessage({ id: ETranslations.global_liquidity }),
            dataIndex: 'liquidity',
            columnProps: { flex: 1.2 },
            render: (text: number, record: IMarketToken, index?: number) => {
              const value = useStockMetadataColumns
                ? (getStockVolume24hValue(record) ?? EMPTY_MARKET_VALUE)
                : getDefaultMarketValue(text);

              if (!shouldRenderRichCell(index)) {
                return renderLightweightText(value);
              }

              return (
                <NumberSizeableText
                  size="$bodyMd"
                  formatter="marketCap"
                  formatterOptions={{ currency: '$' }}
                >
                  {value}
                </NumberSizeableText>
              );
            },
            renderSkeleton: () => <Skeleton width={100} height={16} />,
          },
      {
        title: useStockMetadataColumns
          ? intl.formatMessage({ id: ETranslations.dexmarket_stock_pe_ttm })
          : intl.formatMessage({ id: ETranslations.dexmarket_turnover }),
        dataIndex: 'turnover',
        columnProps: { flex: 1.1 },
        render: (text: number, record: IMarketToken, index?: number) => {
          const value = useStockMetadataColumns
            ? (getStockPeRatioValue(record) ?? EMPTY_MARKET_VALUE)
            : getDefaultMarketValue(text);

          if (!shouldRenderRichCell(index)) {
            return renderLightweightText(value);
          }

          return (
            <NumberSizeableText
              size="$bodyMd"
              formatter={useStockMetadataColumns ? 'value' : 'marketCap'}
              formatterOptions={
                useStockMetadataColumns ? undefined : { currency: '$' }
              }
            >
              {value}
            </NumberSizeableText>
          );
        },
        renderSkeleton: () => <Skeleton width={100} height={16} />,
      },
      isWatchlistMode
        ? undefined
        : {
            title: intl.formatMessage({ id: ETranslations.dexmarket_txns }),
            dataIndex: 'transactions',
            columnProps: { flex: 1 },
            render: (text: number, record: IMarketToken, index?: number) =>
              shouldRenderRichCell(index) ? (
                <Txns transactions={text} walletInfo={record.walletInfo} />
              ) : (
                renderLightweightText(text)
              ),
            renderSkeleton: () => (
              <YStack gap="$1" alignItems="flex-start">
                <Skeleton width={50} height={14} />
                <XStack gap="$1">
                  <Skeleton width={20} height={12} />
                  <Skeleton width={20} height={12} />
                </XStack>
              </YStack>
            ),
          },
      gtLg && !isWatchlistMode
        ? {
            title: intl.formatMessage({ id: ETranslations.dexmarket_traders }),
            dataIndex: 'uniqueTraders',
            columnProps: { flex: 1 },
            render: (text: number, _record: IMarketToken, index?: number) =>
              shouldRenderRichCell(index) ? (
                <NumberSizeableText size="$bodyMd" formatter="marketCap">
                  {text === 0 ? '--' : text}
                </NumberSizeableText>
              ) : (
                renderLightweightText(text)
              ),
            renderSkeleton: () => <Skeleton width={60} height={16} />,
          }
        : undefined,
      gtXl && !isWatchlistMode
        ? {
            title: intl.formatMessage({ id: ETranslations.dexmarket_holders }),
            dataIndex: 'holders',
            columnProps: { flex: 1 },
            render: (text: number, _record: IMarketToken, index?: number) =>
              shouldRenderRichCell(index) ? (
                <NumberSizeableText size="$bodyMd" formatter="marketCap">
                  {text === 0 ? '--' : text}
                </NumberSizeableText>
              ) : (
                renderLightweightText(text)
              ),
            renderSkeleton: () => <Skeleton width={60} height={16} />,
          }
        : undefined,
      gtXl && !isWatchlistMode && !hideTokenAge
        ? {
            title: intl.formatMessage({
              id: ETranslations.dexmarket_token_age,
            }),
            dataIndex: 'tokenAge',
            columnProps: { flex: 0.9 },
            render: (_: unknown, record: IMarketToken, index?: number) => {
              if (!shouldRenderRichCell(index)) {
                return renderLightweightText(EMPTY_MARKET_VALUE);
              }

              const ageLabel = formatTokenAgeLabel(intl, record.firstTradeTime);

              if (!ageLabel) {
                return <SizableText size="$bodyMd">--</SizableText>;
              }

              return <SizableText size="$bodyMd">{ageLabel}</SizableText>;
            },
            renderSkeleton: () => <Skeleton width={60} height={16} />,
          }
        : undefined,
    ].filter(Boolean) as ITableColumn<IMarketToken>[];

    // Redesign reorders/filters via a fixed key list rather than mutating
    // the generation above, so the flag-off path stays byte-identical.
    const orderedColumns = redesignEnabled
      ? REDESIGN_COLUMN_ORDER.map((key) =>
          columns.find((c) => String(c.dataIndex) === key),
        )
          .filter((c): c is NonNullable<typeof c> => Boolean(c))
          .map((column) => {
            const tooltip = REDESIGN_HEADER_TOOLTIPS[String(column.dataIndex)];
            if (!tooltip || typeof column.title !== 'string') {
              return column;
            }
            return {
              ...column,
              title: renderRedesignHeaderTitle(column.title, tooltip),
            };
          })
      : columns;

    if (!hiddenDesktopColumns?.length) {
      return orderedColumns;
    }

    return orderedColumns.filter(
      (column) => !hiddenDesktopColumns.includes(String(column.dataIndex)),
    );
  }, [
    change24hColumnTitle,
    copyFrom,
    deferRichRowAfterIndex,
    gtLg,
    gtXl,
    hasStock,
    hiddenDesktopColumns,
    hideTokenAge,
    intl,
    isWatchlistMode,
    networkId,
    redesignEnabled,
    showStockSubtitle,
    useStockMetadataColumns,
    watchlistFrom,
  ]);
};
