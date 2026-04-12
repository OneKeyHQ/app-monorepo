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
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { CommunityRecognizedBadge } from '../../../components/CommunityRecognizedBadge';
import {
  usePerpsStarV2Checked,
  useStarV2Checked,
} from '../../../components/MarketStarV2';
import {
  StockSourceLogo,
  SubtitleBadge,
} from '../../../components/PerpsBadges';

import {
  COLUMN_WIDTH_CHANGE,
  COLUMN_WIDTH_LIQUIDITY,
  COLUMN_WIDTH_MARKET_CAP,
  COLUMN_WIDTH_NAME,
  COLUMN_WIDTH_PRICE,
  COLUMN_WIDTH_TURNOVER,
} from './constants';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { GestureResponderEvent } from 'react-native';

interface IMarketTokenSelectorRowProps {
  item: IMarketToken;
  networkId?: string;
  onPress: (item: IMarketToken) => void;
  showAddress?: boolean;
}

const PRICE_LARGE_THRESHOLD = 1_000_000;

const MarketTokenSelectorRow = memo(
  ({ item, networkId, onPress, showAddress }: IMarketTokenSelectorRowProps) => {
    const { copyText } = useClipboard();
    const handlePress = useCallback(() => {
      onPress(item);
    }, [onPress, item]);

    const priceFormatter = useMemo(() => {
      if (new BigNumber(item.price).gte(PRICE_LARGE_THRESHOLD)) {
        return 'marketCap' as const;
      }
      return 'price' as const;
    }, [item.price]);

    const changeColor = item.change24h >= 0 ? '$textSuccess' : '$textCritical';

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

    const starElement = useMemo(
      () => (
        <IconButton
          icon={star.checked ? 'StarSolid' : 'StarOutline'}
          variant="tertiary"
          size="small"
          iconProps={{
            color: star.checked ? '$iconActive' : '$iconSubdued',
            size: '$3',
          }}
          onPress={star.onPress}
        />
      ),
      [star.checked, star.onPress],
    );

    return (
      <XStack
        onPress={handlePress}
        hoverStyle={{ bg: '$bgHover' }}
        px="$4"
        py="$3"
        cursor="default"
        alignItems="center"
      >
        {/* Token info cell */}
        <XStack
          width={COLUMN_WIDTH_NAME}
          gap="$1.5"
          alignItems="center"
          justifyContent="flex-start"
          minWidth={0}
        >
          {starElement}
          <Token
            size="xs"
            tokenImageUri={item.tokenImageUri}
            tokenImageUris={item.tokenImageUris}
            networkImageUri={item.networkLogoUri}
          />
          <YStack flex={1} minWidth={0}>
            <XStack alignItems="center" gap="$1">
              <SizableText
                size="$bodySmMedium"
                numberOfLines={1}
                flexShrink={1}
              >
                {item.symbol}
              </SizableText>
              {item.communityRecognized ? <CommunityRecognizedBadge /> : null}
              <StockSourceLogo stock={item.stock} />
              {item.stock?.subtitle ? (
                <SubtitleBadge subtitle={item.stock.subtitle} />
              ) : null}
            </XStack>
            {showAddress && item.address ? (
              <XStack alignItems="center" gap="$1">
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {accountUtils.shortenAddress({
                    address: item.address,
                    leadingLength: 6,
                    trailingLength: 4,
                  })}
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
                  <Icon name="Copy3Outline" size="$3" color="$iconSubdued" />
                </Stack>
              </XStack>
            ) : null}
          </YStack>
        </XStack>

        {/* Price cell */}
        <XStack width={COLUMN_WIDTH_PRICE} justifyContent="flex-start">
          <NumberSizeableText
            size="$bodySmMedium"
            formatter={priceFormatter}
            formatterOptions={{ currency: '$', capAtMaxT: true }}
          >
            {String(item.price)}
          </NumberSizeableText>
        </XStack>

        {/* Change 24h cell */}
        <XStack width={COLUMN_WIDTH_CHANGE} justifyContent="flex-start">
          <NumberSizeableText
            size="$bodySm"
            formatter="priceChange"
            formatterOptions={{ showPlusMinusSigns: true }}
            color={changeColor}
          >
            {String(item.change24h)}
          </NumberSizeableText>
        </XStack>

        {/* Market cap cell */}
        <XStack width={COLUMN_WIDTH_MARKET_CAP} justifyContent="flex-start">
          {item.marketCap ? (
            <NumberSizeableText
              size="$bodySm"
              formatter="marketCap"
              formatterOptions={{ currency: '$', capAtMaxT: true }}
            >
              {String(item.marketCap)}
            </NumberSizeableText>
          ) : (
            <SizableText size="$bodySm" color="$textSubdued">
              --
            </SizableText>
          )}
        </XStack>

        {/* Liquidity cell */}
        <XStack width={COLUMN_WIDTH_LIQUIDITY} justifyContent="flex-start">
          {item.liquidity ? (
            <NumberSizeableText
              size="$bodySm"
              formatter="marketCap"
              formatterOptions={{ currency: '$' }}
            >
              {String(item.liquidity)}
            </NumberSizeableText>
          ) : (
            <SizableText size="$bodySm" color="$textSubdued">
              --
            </SizableText>
          )}
        </XStack>

        {/* Turnover cell */}
        <XStack width={COLUMN_WIDTH_TURNOVER} justifyContent="flex-start">
          {item.turnover ? (
            <NumberSizeableText
              size="$bodySm"
              formatter="marketCap"
              formatterOptions={{ currency: '$' }}
            >
              {String(item.turnover)}
            </NumberSizeableText>
          ) : (
            <SizableText size="$bodySm" color="$textSubdued">
              --
            </SizableText>
          )}
        </XStack>
      </XStack>
    );
  },
);

MarketTokenSelectorRow.displayName = 'MarketTokenSelectorRow';

export { MarketTokenSelectorRow };
export type { IMarketTokenSelectorRowProps };
