import { memo, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  NATIVE_HIT_SLOP,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import { getTokenAgeLabel } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenColumns/tokenAgeLabel';
import { MarketTestIDs } from '@onekeyhq/kit/src/views/Market/testIDs';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';

import { CommunityRecognizedBadge } from '../../../components/CommunityRecognizedBadge';
import { StockSourceLogo } from '../../../components/PerpsBadges';
import { prewarmMarketTokenImages } from '../../utils/marketDetailImagePreload';

import {
  TOKEN_SELECTOR_COLUMN_PADDING,
  TOKEN_SELECTOR_NAME_COLUMN_WIDTH,
  TOKEN_SELECTOR_NAME_GAP,
  TOKEN_SELECTOR_ROW_HEIGHT,
  TOKEN_SELECTOR_STAR_COLUMN_WIDTH,
} from './constants';
import { SelectorTokenStar } from './selectorStar';
import { SelectorPriceChangeCell } from './selectorTable';

import type {
  IMarketTokenSelectorColumns,
  IMarketTokenSelectorMetricColumn,
} from './constants';
import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { GestureResponderEvent } from 'react-native';

/**
 * What the line under the symbol carries. Trending and Robinhood rows show the
 * token age then the copyable contract address; Favorites and Top Coins show
 * the full name (stock listings lead it with their market badges); search
 * results show the full name followed by the address.
 */
export type IMarketTokenSelectorSubtitleVariant =
  | 'ageAddress'
  | 'name'
  // Search results: the full name, then the copyable address.
  | 'nameAddress';

interface IMarketTokenSelectorRowProps {
  item: IMarketToken & { selectorSubtitle?: string; marketAssetId?: string };
  networkId?: string;
  onPress: (item: IMarketToken) => void;
  subtitleVariant?: IMarketTokenSelectorSubtitleVariant;
  columns: IMarketTokenSelectorColumns;
  nameColumnWidth?: number;
}

const PRICE_LARGE_THRESHOLD = 1_000_000;
const METRIC_TEXT_SIZE = '$bodyMdMedium' as const;
const SUBTITLE_LINE_HEIGHT = 16;

function MissingValue() {
  return (
    <SizableText size={METRIC_TEXT_SIZE} color="$textSubdued">
      --
    </SizableText>
  );
}

const MarketTokenSelectorRow = memo(
  ({
    item,
    networkId,
    onPress,
    subtitleVariant = 'name',
    columns,
    nameColumnWidth = TOKEN_SELECTOR_NAME_COLUMN_WIDTH,
  }: IMarketTokenSelectorRowProps) => {
    const { copyText } = useClipboard();

    const prewarmTokenImages = useCallback(() => {
      prewarmMarketTokenImages(item);
    }, [item]);

    const handlePress = useCallback(() => {
      prewarmTokenImages();
      onPress(item);
    }, [onPress, item, prewarmTokenImages]);

    const priceFormatter = useMemo(() => {
      if (new BigNumber(item.price).gte(PRICE_LARGE_THRESHOLD)) {
        return 'marketCap' as const;
      }
      return 'price' as const;
    }, [item.price]);

    const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
      priceChange: item.change24h,
    });

    // Trending list items arrive with an empty networkLogoUri (the shared list
    // hook only fills it when a single network is selected), so the chain
    // corner badge resolves from the item's own networkId instead. Top Coins
    // rows carry a synthetic 'coingecko' id that resolves to nothing, which is
    // correct — aggregate assets show no chain badge.
    const networkLogoUri = useNetworkLogoUri({
      logoUri: item.networkLogoUri,
      networkId: item.networkId,
    });

    const intl = useIntl();
    const shortenedAddress = item.address
      ? accountUtils.shortenAddress({
          address: item.address,
          leadingLength: 6,
          trailingLength: 4,
        })
      : '';

    const renderMetric = (metric: IMarketTokenSelectorMetricColumn) => {
      switch (metric) {
        case 'price':
          return Number.isFinite(item.price) ? (
            <NumberSizeableText
              size={METRIC_TEXT_SIZE}
              formatter={priceFormatter}
              formatterOptions={{ currency: '$', capAtMaxT: true }}
            >
              {String(item.price)}
            </NumberSizeableText>
          ) : (
            <MissingValue />
          );
        case 'change':
          return item.priceChangeRaw === undefined ||
            item.priceChangeRaw === '-' ? (
            <MissingValue />
          ) : (
            <NumberSizeableText
              size={METRIC_TEXT_SIZE}
              formatter="priceChangeCapped"
              formatterOptions={{ showPlusMinusSigns }}
              color={changeColor}
            >
              {String(item.change24h)}
            </NumberSizeableText>
          );
        case 'priceChange':
          return (
            <SelectorPriceChangeCell
              price={Number.isFinite(item.price) ? item.price : undefined}
              change={
                item.priceChangeRaw === undefined || item.priceChangeRaw === '-'
                  ? undefined
                  : item.change24h
              }
            />
          );
        case 'marketCap':
          return item.marketCap ? (
            <NumberSizeableText
              size={METRIC_TEXT_SIZE}
              formatter="marketCap"
              formatterOptions={{ currency: '$', capAtMaxT: true }}
            >
              {String(item.marketCap)}
            </NumberSizeableText>
          ) : (
            <MissingValue />
          );
        case 'liquidity':
          return item.liquidity ? (
            <NumberSizeableText
              size={METRIC_TEXT_SIZE}
              formatter="marketCap"
              formatterOptions={{ currency: '$' }}
            >
              {String(item.liquidity)}
            </NumberSizeableText>
          ) : (
            <MissingValue />
          );
        case 'turnover':
        default:
          return item.turnover ? (
            <NumberSizeableText
              size={METRIC_TEXT_SIZE}
              formatter="marketCap"
              formatterOptions={{ currency: '$' }}
            >
              {String(item.turnover)}
            </NumberSizeableText>
          ) : (
            <MissingValue />
          );
      }
    };

    const addressElement = shortenedAddress ? (
      <XStack alignItems="center" gap="$0.5" flexShrink={0}>
        <SizableText size="$bodySm" color="$textDisabled" numberOfLines={1}>
          {shortenedAddress}
        </SizableText>
        <Stack
          cursor="pointer"
          hitSlop={NATIVE_HIT_SLOP}
          hoverStyle={{ opacity: 0.75 }}
          pressStyle={{ opacity: 0.5 }}
          onPress={(e: GestureResponderEvent) => {
            e.stopPropagation();
            copyText(item.address);
          }}
        >
          <Icon name="Copy3Outline" size="$3.5" color="$iconSubdued" />
        </Stack>
      </XStack>
    ) : null;

    let subtitle: ReactNode = null;
    if (subtitleVariant === 'nameAddress') {
      const displayName = item.name.trim();
      subtitle =
        displayName || addressElement ? (
          <XStack
            height={SUBTITLE_LINE_HEIGHT}
            alignItems="center"
            gap="$1.5"
            minWidth={0}
          >
            {displayName ? (
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
                flexShrink={1}
              >
                {displayName}
              </SizableText>
            ) : null}
            {addressElement}
          </XStack>
        ) : null;
    } else if (subtitleVariant === 'ageAddress') {
      const ageLabel = getTokenAgeLabel(intl, item.firstTradeTime);
      subtitle =
        ageLabel || shortenedAddress ? (
          <XStack
            height={SUBTITLE_LINE_HEIGHT}
            alignItems="center"
            gap="$1.5"
            minWidth={0}
          >
            {ageLabel ? (
              <SizableText size="$bodySmMedium" flexShrink={0}>
                {ageLabel}
              </SizableText>
            ) : null}
            {addressElement}
          </XStack>
        ) : null;
    } else {
      const displayName = (item.selectorSubtitle ?? item.name).trim();
      const stockTags = item.stockTags?.filter(Boolean) ?? [];
      subtitle =
        displayName || stockTags.length > 0 ? (
          <XStack
            height={SUBTITLE_LINE_HEIGHT}
            alignItems="center"
            gap="$1.5"
            minWidth={0}
          >
            {stockTags.map((tag) => (
              <Badge
                key={tag}
                badgeType="default"
                badgeSize="sm"
                px="$1"
                py="$0.5"
                flexShrink={0}
              >
                <Badge.Text size="$bodyXs" lineHeight={12}>
                  {tag}
                </Badge.Text>
              </Badge>
            ))}
            {displayName ? (
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
                flexShrink={1}
              >
                {displayName}
              </SizableText>
            ) : null}
          </XStack>
        ) : null;
    }

    return (
      <XStack
        testID={MarketTestIDs.tokenRow(item.symbol)}
        onPress={handlePress}
        onPressIn={prewarmTokenImages}
        onHoverIn={prewarmTokenImages}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        borderRadius="$3"
        borderCurve="continuous"
        width="100%"
        height={TOKEN_SELECTOR_ROW_HEIGHT}
        minHeight={TOKEN_SELECTOR_ROW_HEIGHT}
        cursor="default"
        alignItems="center"
      >
        {/* Token info cell */}
        <XStack
          width={nameColumnWidth}
          flexShrink={0}
          px={TOKEN_SELECTOR_COLUMN_PADDING}
          gap={TOKEN_SELECTOR_NAME_GAP}
          alignItems="center"
          justifyContent="flex-start"
          // No overflow:hidden here — the chain corner badge hangs 4px past
          // the token frame and would be clipped on single-line rows; text
          // truncation is handled by minWidth/numberOfLines instead.
          minWidth={0}
        >
          <Stack
            width={TOKEN_SELECTOR_STAR_COLUMN_WIDTH}
            alignItems="center"
            justifyContent="center"
          >
            <SelectorTokenStar item={item} networkId={networkId} />
          </Stack>
          <XStack flex={1} minWidth={0} alignItems="center" gap="$3">
            <Token
              size="md"
              tokenImageUri={item.tokenImageUri}
              tokenImageUris={item.tokenImageUris}
              networkImageUri={networkLogoUri}
            />
            <YStack flex={1} minWidth={0} gap="$1" justifyContent="center">
              <XStack alignItems="center" gap="$1">
                <SizableText size="$headingSm" numberOfLines={1} flexShrink={1}>
                  {item.symbol}
                </SizableText>
                {item.communityRecognized ? <CommunityRecognizedBadge /> : null}
                <StockSourceLogo stock={item.stock} />
              </XStack>
              {subtitle}
            </YStack>
          </XStack>
        </XStack>

        {columns.metrics.map((metric) => (
          <XStack
            key={metric}
            flex={columns.flex[metric] ?? 1}
            flexBasis={0}
            minWidth={0}
            px={TOKEN_SELECTOR_COLUMN_PADDING}
            alignItems="center"
            justifyContent="flex-end"
          >
            {renderMetric(metric)}
          </XStack>
        ))}
      </XStack>
    );
  },
);

MarketTokenSelectorRow.displayName = 'MarketTokenSelectorRow';

export { MarketTokenSelectorRow };
export type { IMarketTokenSelectorRowProps };
