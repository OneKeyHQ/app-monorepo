import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { type IntlShape, useIntl } from 'react-intl';

import type {
  ETableSortType,
  IKeyOfIcons,
  ITableColumn,
  ITableColumnSortContext,
} from '@onekeyhq/components';
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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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
import type { GestureResponderEvent } from 'react-native';

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

// Figma (24967-41343): the fixed left block pairs a 40px star cell (row px 8 +
// button px 4 + 16px icon + px 4) with the name cell. 240px leaves 186px for
// the text block after the 40px token and its 14px gap - enough for the
// age/address subtitle, with long symbols truncated by ellipsis.
const REDESIGN_STAR_COLUMN_WIDTH = 40;
const REDESIGN_NAME_COLUMN_WIDTH = 240;
const REDESIGN_STAR_ICON_SIZE = '$4';

// Figma: 14px sort glyph sitting 2px after the label. Rendered here (rather
// than by Column) so the label and the icon form a single hit target.
// Must be a size token — Icon ignores raw numbers and falls back to 24px.
const REDESIGN_SORT_ICON_SIZE = '$3.5';

function renderRedesignSortIcon(order: ETableSortType | undefined) {
  let iconName: IKeyOfIcons = 'ChevronGrabberVerOutline';
  if (order === 'desc') {
    iconName = 'ChevronDownSmallOutline';
  } else if (order === 'asc') {
    iconName = 'ChevronTopSmallOutline';
  }
  return (
    <Icon
      name={iconName}
      size={REDESIGN_SORT_ICON_SIZE}
      color={order ? '$iconActive' : '$iconSubdued'}
    />
  );
}

function renderRedesignHeaderTitle({
  label,
  tooltip,
  sortContext,
}: {
  label: string;
  tooltip?: string;
  sortContext: ITableColumnSortContext;
}) {
  const { order, onSortPress } = sortContext;
  const titleRow = (
    <XStack alignItems="center" gap={2} userSelect="none">
      <SizableText
        size="$bodySmMedium"
        color="$textSubdued"
        {...(tooltip
          ? {
              textDecorationLine: 'underline' as const,
              style: {
                textDecorationStyle: 'dotted',
                textUnderlinePosition: 'from-font',
              } as any,
            }
          : null)}
      >
        {label}
      </SizableText>
      {onSortPress ? renderRedesignSortIcon(order) : null}
    </XStack>
  );

  if (!tooltip) {
    return titleRow;
  }

  // Tooltip wraps the whole row: hovering anywhere on it explains the metric,
  // and pressing anywhere on it sorts (the Tooltip trigger owns the press, so
  // the handler must be forwarded here rather than left to the Column).
  return (
    <LazyTooltip
      placement="top"
      onPress={onSortPress}
      renderTrigger={titleRow}
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

// Figma (24967-41343): the address pairs with a 14px copy glyph 2px after it;
// the pair is one hover/press target with a pointer cursor.
const REDESIGN_COPY_ICON_SIZE = '$3.5';

function RedesignAddressWithCopy({
  address,
  shortAddress,
  copyFrom,
}: {
  address: string;
  shortAddress: string;
  copyFrom: ECopyFrom;
}) {
  const { copyText } = useClipboard();
  const handleCopy = useCallback(
    (e: GestureResponderEvent) => {
      // The row itself navigates to the detail page; copying must not.
      e.stopPropagation();
      copyText(address);
      defaultLogger.dex.actions.dexCopyCA({
        copyFrom,
        copiedContent: address,
      });
    },
    [address, copyFrom, copyText],
  );

  return (
    <XStack
      alignItems="center"
      gap={2}
      minWidth={0}
      cursor="pointer"
      hoverStyle={{ opacity: 0.75 }}
      pressStyle={{ opacity: 0.6 }}
      hitSlop={NATIVE_HIT_SLOP}
      onPress={handleCopy}
      role="button"
    >
      <SizableText
        size="$bodySm"
        color="$textDisabled"
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {shortAddress}
      </SizableText>
      <Icon
        name="Copy3Outline"
        size={REDESIGN_COPY_ICON_SIZE}
        color="$iconDisabled"
        flexShrink={0}
      />
    </XStack>
  );
}

function renderRedesignTokenIdentity(
  record: IMarketToken,
  intl: IntlShape,
  showReasonTag: boolean,
  copyFrom: ECopyFrom,
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
            <RedesignAddressWithCopy
              address={record.address}
              shortAddress={shortAddress}
              copyFrom={copyFrom}
            />
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
        columnWidth: redesignEnabled ? REDESIGN_STAR_COLUMN_WIDTH : 50,
        render: (_: unknown, record: IMarketToken, index?: number) => {
          if (!shouldRenderRichCell(index)) {
            return (
              <Stack pl={redesignEnabled ? '$3' : '$2'}>
                <Stack width={24} height={24} />
              </Stack>
            );
          }

          return (
            <Stack pl={redesignEnabled ? '$3' : '$2'}>
              {record.perpsCoin ? (
                <MarketPerpsStarV2 perpsCoin={record.perpsCoin} size="small" />
              ) : (
                <MarketStarV2
                  chainId={record.chainId || networkId || ''}
                  contractAddress={record.address}
                  from={watchlistFrom || EWatchlistFrom.Homepage}
                  tokenSymbol={record.symbol}
                  size="small"
                  customIconSize={
                    redesignEnabled ? REDESIGN_STAR_ICON_SIZE : undefined
                  }
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
          if (redesignEnabled) return REDESIGN_NAME_COLUMN_WIDTH;
          if (hasStock && showStockSubtitle) return 240;
          return 200;
        })(),
        render: (_: unknown, record: IMarketToken, index?: number) => {
          const renderRichCell = shouldRenderRichCell(index);
          if (!renderRichCell) {
            return renderLightweightTokenIdentity(record);
          }

          if (redesignEnabled && !record.perpsCoin) {
            return renderRedesignTokenIdentity(
              record,
              intl,
              gtXl,
              copyFrom || ECopyFrom.Homepage,
            );
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
            const dataIndex = String(column.dataIndex);
            if (dataIndex === 'star' || typeof column.title !== 'string') {
              return column;
            }
            const label = column.title;
            const tooltip = REDESIGN_HEADER_TOOLTIPS[dataIndex];
            return {
              ...column,
              renderTitle: (
                _sortIcon: ReactNode,
                sortContext: ITableColumnSortContext,
              ) => renderRedesignHeaderTitle({ label, tooltip, sortContext }),
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
