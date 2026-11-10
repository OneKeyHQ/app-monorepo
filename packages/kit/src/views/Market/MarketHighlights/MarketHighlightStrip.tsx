import { useEffect, useMemo } from 'react';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { getMarketWatchlistKey } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import type { IMarketHighlight } from '@onekeyhq/shared/types/marketV2';

import { LeverageBadge } from '../components/PerpsBadges';
import { PriceChangePercentage } from '../components/PriceChangePercentage';
import { prewarmMarketTokenImages } from '../MarketDetailV2/utils/marketDetailImagePreload';
import { EModalMarketRoutes } from '../router/types';

import { useMarketHighlightQuotes } from './useMarketHighlightQuotes';

export const MARKET_HIGHLIGHT_MOBILE_HEADER_HEIGHT = 62;
export const MARKET_HIGHLIGHT_DESKTOP_HEADER_HEIGHT = 64;

export function MarketHighlightStrip({
  highlight,
  highlights,
  compact,
}: {
  highlight: IMarketHighlight | undefined;
  highlights: IMarketHighlight[] | undefined;
  compact: boolean;
}) {
  const navigation = useAppNavigation();
  const locale = useLocaleVariant();
  const headerHeight = compact
    ? MARKET_HIGHLIGHT_MOBILE_HEADER_HEIGHT
    : MARKET_HIGHLIGHT_DESKTOP_HEADER_HEIGHT;
  const assets = useMemo(
    () => highlight?.assets.slice(0, compact ? 1 : 2),
    [highlight?.assets, compact],
  );
  const quoteAssets = useMemo(
    () => highlights?.slice(0, 3).flatMap((item) => item.assets.slice(0, 3)),
    [highlights],
  );
  const quotes = useMarketHighlightQuotes(quoteAssets);
  useEffect(() => {
    quotes?.forEach((quote) => {
      prewarmMarketTokenImages({ tokenImageUri: quote.logoUrl });
    });
  }, [quotes]);

  if (!highlight) {
    return (
      <YStack px="$5" pt={compact ? '$2' : '$3'} h={headerHeight}>
        <Skeleton h={40} w="100%" maxWidth={800} borderRadius="$3" />
      </YStack>
    );
  }

  return (
    <YStack px="$5" pt={compact ? '$2' : '$3'} h={headerHeight}>
      <XStack
        testID="market-highlights-strip"
        role="button"
        maxWidth={800}
        alignSelf="stretch"
        h={40}
        alignItems="center"
        bg="$bgSubdued"
        borderRadius="$3"
        px="$3.5"
        gap={compact ? '$2' : '$3'}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        onPress={() =>
          navigation.pushModal(EModalRoutes.MarketModal, {
            screen: EModalMarketRoutes.MarketHighlights,
            params: {
              initialQuotes: quotes ? [...quotes] : undefined,
              initialHighlights: highlights
                ? { locale, items: highlights }
                : undefined,
            },
          })
        }
      >
        {compact ? null : (
          <Icon name="SpeakerPromoteOutline" size="$4.5" color="$iconSubdued" />
        )}
        <SizableText
          flex={compact ? 1 : undefined}
          flexShrink={1}
          minWidth={0}
          size="$bodyMdMedium"
          numberOfLines={1}
        >
          {highlight.title}
        </SizableText>
        {assets?.map((asset, index) => {
          const identity = getMarketWatchlistKey(asset.favorite);
          const quote = quotes?.get(identity);
          const maxLeverage =
            asset.type === 'perp' ? quote?.maxLeverage : undefined;
          return (
            <XStack key={`${identity}:${index}`} alignItems="center" gap="$1.5">
              <Token size="xxs" tokenImageUri={quote?.logoUrl} />
              <SizableText size="$headingSm" numberOfLines={1} maxWidth={84}>
                {asset.symbol}
              </SizableText>
              {maxLeverage && maxLeverage > 0 ? (
                <LeverageBadge leverage={maxLeverage} compact />
              ) : null}
              {compact ? null : (
                <NumberSizeableText
                  size="$bodyMd"
                  formatter="price"
                  formatterOptions={{ currency: '$' }}
                  numberOfLines={1}
                >
                  {quote?.price ?? '-'}
                </NumberSizeableText>
              )}
              <PriceChangePercentage numberOfLines={1}>
                {quote?.priceChange24hPercent}
              </PriceChangePercentage>
            </XStack>
          );
        })}
      </XStack>
    </YStack>
  );
}
