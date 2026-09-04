import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Icon,
  IconButton,
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
import { MarketTestIDs } from '@onekeyhq/kit/src/views/Market/testIDs';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';

import { CommunityRecognizedBadge } from '../../../components/CommunityRecognizedBadge';
import {
  usePerpsStarV2Checked,
  useStarV2Checked,
} from '../../../components/MarketStarV2';
import { StockSourceLogo, SubtitleText } from '../../../components/PerpsBadges';
import { prewarmMarketTokenImages } from '../../utils/marketDetailImagePreload';

import {
  TOKEN_SELECTOR_COLUMN_PADDING,
  TOKEN_SELECTOR_NAME_GAP,
  TOKEN_SELECTOR_ROW_HEIGHT,
  TOKEN_SELECTOR_STAR_COLUMN_WIDTH,
} from './constants';

import type {
  IMarketTokenSelectorColumns,
  IMarketTokenSelectorMetricColumn,
} from './constants';
import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { GestureResponderEvent } from 'react-native';

interface IMarketTokenSelectorRowProps {
  item: IMarketToken & { selectorSubtitle?: string };
  networkId?: string;
  onPress: (item: IMarketToken) => void;
  showAddress?: boolean;
  columns: IMarketTokenSelectorColumns;
}

const PRICE_LARGE_THRESHOLD = 1_000_000;
const METRIC_TEXT_SIZE = '$bodyMdMedium' as const;

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
    showAddress,
    columns,
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

    // Use hooks directly + custom IconButton to match perps FavoriteButton exactly
    const spotStar = useStarV2Checked({
      chainId: item.chainId ?? networkId ?? '',
      contractAddress: item.address,
      from: EWatchlistFrom.Search,
      tokenSymbol: item.symbol,
      isNative: item.isNative,
    });
    const perpsStar = usePerpsStarV2Checked({
      perpsCoin: item.perpsCoin ?? '',
    });
    const star = item.perpsCoin ? perpsStar : spotStar;

    // Trending list items arrive with an empty networkLogoUri (the shared list
    // hook only fills it when a single network is selected), so the chain
    // corner badge resolves from the item's own networkId instead. Top Coins
    // rows carry a synthetic 'coingecko' id that resolves to nothing, which is
    // correct — aggregate assets show no chain badge.
    const networkLogoUri = useNetworkLogoUri({
      logoUri: item.networkLogoUri,
      networkId: item.networkId,
    });

    // Localized name shown as plain text on the second row, before the address.
    const localizedName =
      item.selectorSubtitle ?? item.stock?.subtitle ?? item.perpsSubtitle;
    const shortenedAddress = item.address
      ? accountUtils.shortenAddress({
          address: item.address,
          leadingLength: 6,
          trailingLength: 4,
        })
      : '';
    const showAddressRow = Boolean(showAddress && item.address);

    const starElement = useMemo(
      () => (
        <IconButton
          testID={MarketTestIDs.tokenSelectorRowStarBtn}
          icon={star.checked ? 'StarSolid' : 'StarOutline'}
          variant="tertiary"
          size="small"
          iconProps={{
            color: star.checked ? '$iconActive' : '$iconSubdued',
            size: '$4',
          }}
          onPress={star.onPress}
        />
      ),
      [star.checked, star.onPress],
    );

    const renderMetric = (metric: IMarketTokenSelectorMetricColumn) => {
      switch (metric) {
        case 'price':
          return (
            <NumberSizeableText
              size={METRIC_TEXT_SIZE}
              formatter={priceFormatter}
              formatterOptions={{ currency: '$', capAtMaxT: true }}
            >
              {String(item.price)}
            </NumberSizeableText>
          );
        case 'change':
          return item.priceChangeRaw === '-' ? (
            <MissingValue />
          ) : (
            <NumberSizeableText
              size={METRIC_TEXT_SIZE}
              formatter="priceChange"
              formatterOptions={{ showPlusMinusSigns }}
              color={changeColor}
            >
              {String(item.change24h)}
            </NumberSizeableText>
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

    return (
      <XStack
        testID={MarketTestIDs.tokenRow(item.symbol)}
        onPress={handlePress}
        onPressIn={prewarmTokenImages}
        onHoverIn={prewarmTokenImages}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        width="100%"
        height={TOKEN_SELECTOR_ROW_HEIGHT}
        minHeight={TOKEN_SELECTOR_ROW_HEIGHT}
        cursor="default"
        alignItems="center"
      >
        {/* Token info cell */}
        <XStack
          width={columns.nameColumnWidth}
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
            {starElement}
          </Stack>
          <XStack flex={1} minWidth={0} alignItems="center" gap="$2.5">
            <Token
              size="md"
              tokenImageUri={item.tokenImageUri}
              tokenImageUris={item.tokenImageUris}
              networkImageUri={networkLogoUri}
            />
            <YStack flex={1} minWidth={0} gap="$0.5" justifyContent="center">
              <XStack alignItems="center" gap="$1">
                <SizableText
                  size="$bodyMdMedium"
                  numberOfLines={1}
                  flexShrink={1}
                >
                  {item.symbol}
                </SizableText>
                {item.communityRecognized ? <CommunityRecognizedBadge /> : null}
                <StockSourceLogo stock={item.stock} />
              </XStack>
              {localizedName || showAddressRow ? (
                <XStack alignItems="center" gap="$1.5" minWidth={0}>
                  {localizedName ? (
                    <SubtitleText subtitle={localizedName} maxWidth={66} />
                  ) : null}
                  {localizedName && showAddressRow ? (
                    <SizableText
                      size="$bodySm"
                      color="$textDisabled"
                      flexShrink={0}
                    >
                      |
                    </SizableText>
                  ) : null}
                  {showAddressRow ? (
                    <XStack alignItems="center" gap="$1" flexShrink={0}>
                      <SizableText
                        size="$bodySm"
                        color="$textSubdued"
                        numberOfLines={1}
                      >
                        {shortenedAddress}
                      </SizableText>
                      <Stack
                        cursor="pointer"
                        p="$0.5"
                        borderRadius="$full"
                        hoverStyle={{ bg: '$bgHover' }}
                        pressStyle={{ bg: '$bgActive' }}
                        hitSlop={NATIVE_HIT_SLOP}
                        onPress={(e: GestureResponderEvent) => {
                          e.stopPropagation();
                          copyText(item.address);
                        }}
                      >
                        <Icon
                          name="Copy3Outline"
                          size="$3"
                          color="$iconSubdued"
                        />
                      </Stack>
                    </XStack>
                  ) : null}
                </XStack>
              ) : null}
            </YStack>
          </XStack>
        </XStack>

        {columns.metrics.map((metric) => (
          <XStack
            key={metric}
            width={columns.metricColumnWidth}
            px={TOKEN_SELECTOR_COLUMN_PADDING}
            alignItems="center"
            justifyContent="flex-start"
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
