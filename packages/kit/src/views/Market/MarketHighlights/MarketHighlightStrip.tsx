import { useEffect, useMemo } from 'react';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { getMarketWatchlistKey } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import type { IMarketHighlight } from '@onekeyhq/shared/types/marketV2';

import { PriceChangePercentage } from '../components/PriceChangePercentage';
import { prewarmMarketTokenImages } from '../MarketDetailV2/utils/marketDetailImagePreload';
import { EModalMarketRoutes } from '../router/types';

import { useMarketHighlightQuotes } from './useMarketHighlightQuotes';

export const MARKET_HIGHLIGHT_MOBILE_HEADER_HEIGHT = 62;

export function MarketHighlightStrip({
  highlight,
  compact,
}: {
  highlight: IMarketHighlight;
  compact: boolean;
}) {
  const navigation = useAppNavigation();
  const assets = useMemo(
    () => highlight.assets.slice(0, compact ? 1 : 2),
    [highlight.assets, compact],
  );
  const quotes = useMarketHighlightQuotes(assets);
  useEffect(() => {
    quotes?.forEach((quote) => {
      prewarmMarketTokenImages({ tokenImageUri: quote.logoUrl });
    });
  }, [quotes]);

  return (
    <YStack
      px="$5"
      pt={compact ? '$2' : '$8'}
      h={compact ? MARKET_HIGHLIGHT_MOBILE_HEADER_HEIGHT : 100}
    >
      <XStack
        testID="market-highlights-strip"
        role="button"
        maxWidth={800}
        alignSelf="stretch"
        h={compact ? 40 : 48}
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
        {assets.map((asset, index) => {
          const identity = getMarketWatchlistKey(asset.favorite);
          const quote = quotes?.get(identity);
          return (
            <XStack key={`${identity}:${index}`} alignItems="center" gap="$1.5">
              <Token size="xxs" tokenImageUri={quote?.logoUrl} />
              <SizableText size="$headingSm" numberOfLines={1} maxWidth={84}>
                {asset.symbol}
              </SizableText>
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
