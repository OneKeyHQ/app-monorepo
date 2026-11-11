import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { getMarketWatchlistKey } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketHighlight } from '@onekeyhq/shared/types/marketV2';

import { LeverageBadge } from '../components/PerpsBadges';
import { PriceChangePercentage } from '../components/PriceChangePercentage';
import { prewarmMarketTokenImages } from '../MarketDetailV2/utils/marketDetailImagePreload';
import { EModalMarketRoutes } from '../router/types';

import { useMarketHighlightQuotes } from './useMarketHighlightQuotes';

import type { IMarketHighlightQuote } from './useMarketHighlightQuotes';
import type { SharedValue } from 'react-native-reanimated';

export const MARKET_HIGHLIGHT_MOBILE_HEADER_HEIGHT = 62;
// 24 top + 48 strip, matching the Market desktop design; the banner list
// below supplies its own top gap.
export const MARKET_HIGHLIGHT_DESKTOP_HEADER_HEIGHT = 72;

const STRIP_MAX_WIDTH = 960;
const STRIP_HEIGHT_DESKTOP = 48;
const STRIP_HEIGHT_MOBILE = 40;
const MAX_CAROUSEL_HIGHLIGHTS = 5;
const CAROUSEL_INTERVAL_MS = timerUtils.getTimeDurationMs({ seconds: 4 });
// After a hover/press pause ends, the next switch comes sooner than a full
// interval.
const CAROUSEL_RESUME_DELAY_MS = timerUtils.getTimeDurationMs({ seconds: 2 });
// Matches the pace of the reference ticker: a gentle ease in and out.
const CAROUSEL_TRANSITION_MS = 600;
// Rows only travel the height of the content (28px asset chips) instead of
// the full strip, so the slide stays tight around the text.
const CAROUSEL_ROW_HEIGHT = 28;

function CarouselItem({
  highlight,
  quotes,
  compact,
  itemProps,
  active,
}: {
  highlight: IMarketHighlight;
  quotes: Map<string, IMarketHighlightQuote> | undefined;
  compact: boolean;
  itemProps: IXStackProps;
  active: boolean;
}) {
  const assets = highlight.assets.slice(0, compact ? 1 : 2);
  return (
    <XStack
      role="button"
      tabIndex={active ? 0 : -1}
      cursor="pointer"
      flexShrink={1}
      minWidth={0}
      alignItems="center"
      gap="$3"
      {...itemProps}
    >
      <SizableText
        flexShrink={1}
        minWidth={0}
        size="$bodyMdMedium"
        numberOfLines={1}
      >
        {highlight.title}
      </SizableText>
      <XStack alignItems="center" flexShrink={0}>
        {assets.map((asset, index) => {
          const identity = getMarketWatchlistKey(asset.favorite);
          const quote = quotes?.get(identity);
          const maxLeverage =
            asset.type === 'perp' ? quote?.maxLeverage : undefined;
          return (
            <XStack
              key={`${identity}:${index}`}
              alignItems="center"
              gap="$1.5"
              px="$2"
              py="$1"
            >
              <Token size="xxs" tokenImageUri={quote?.logoUrl} />
              <XStack alignItems="center" gap="$2">
                <SizableText size="$headingSm" numberOfLines={1}>
                  {asset.symbol}
                </SizableText>
                {maxLeverage && maxLeverage > 0 ? (
                  <LeverageBadge leverage={maxLeverage} compact />
                ) : null}
                <XStack alignItems="center" gap="$1.5">
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
              </XStack>
            </XStack>
          );
        })}
      </XStack>
    </XStack>
  );
}

function CarouselRow({
  position,
  rowIndex,
  height,
  active,
  children,
}: {
  position: SharedValue<number>;
  rowIndex: number;
  height: number;
  active: boolean;
  children: ReactNode;
}) {
  // Fade rows in and out as they slide through the viewport.
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(
      position.value,
      [rowIndex - 1, rowIndex, rowIndex + 1],
      [0, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));
  return (
    <Animated.View
      // Off-screen rows only fade out, so hide them from screen readers,
      // keyboard focus and pointer events as well.
      aria-hidden={!active}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      pointerEvents={active ? 'auto' : 'none'}
      style={[{ height, flexDirection: 'row', alignItems: 'center' }, style]}
    >
      {children}
    </Animated.View>
  );
}

function HighlightCarousel({
  items,
  quotes,
  compact,
  paused,
  height,
  itemProps,
}: {
  items: IMarketHighlight[];
  quotes: Map<string, IMarketHighlightQuote> | undefined;
  compact: boolean;
  paused: boolean;
  height: number;
  itemProps: IXStackProps;
}) {
  const reducedMotion = useReducedMotion();
  const count = items.length;
  // `position` is the row index currently in view. One extra copy of the
  // first item sits after the last, so the loop always slides upward and
  // snaps back to 0 once the copy is fully in view.
  const position = useSharedValue(0);
  const stepRef = useRef(0);
  // Index of the item that is (or is becoming) visible. The trailing copy of
  // the first item is never active; its original row takes over instead.
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    stepRef.current = 0;
    position.value = 0;
    setActiveIndex(0);
  }, [count, position]);

  const wasPausedRef = useRef(false);

  useEffect(() => {
    if (paused) {
      wasPausedRef.current = true;
      return;
    }
    if (count < 2) return;
    const advance = () => {
      const next = stepRef.current + 1;
      stepRef.current = next >= count ? 0 : next;
      setActiveIndex(stepRef.current);
      position.value = withTiming(
        next,
        {
          duration: reducedMotion ? 0 : CAROUSEL_TRANSITION_MS,
          easing: Easing.inOut(Easing.cubic),
        },
        (finished) => {
          if (finished && next >= count) {
            position.value = 0;
          }
        },
      );
    };
    const firstDelay = wasPausedRef.current
      ? CAROUSEL_RESUME_DELAY_MS
      : CAROUSEL_INTERVAL_MS;
    wasPausedRef.current = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      advance();
      interval = setInterval(advance, CAROUSEL_INTERVAL_MS);
    }, firstDelay);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [count, paused, position, reducedMotion]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -position.value * height }],
  }));

  const rows = count > 1 ? [...items, items[0]] : items;

  return (
    <YStack flex={1} minWidth={0} h={height} overflow="hidden">
      <Animated.View style={trackStyle}>
        {rows.map((item, rowIndex) => (
          <CarouselRow
            key={`${item.highlightId}:${rowIndex}`}
            position={position}
            rowIndex={rowIndex}
            height={height}
            active={rowIndex === activeIndex}
          >
            <CarouselItem
              highlight={item}
              quotes={quotes}
              compact={compact}
              itemProps={itemProps}
              active={rowIndex === activeIndex}
            />
          </CarouselRow>
        ))}
      </Animated.View>
    </YStack>
  );
}

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
  const [hovered, setHovered] = useState(false);
  const [pressing, setPressing] = useState(false);
  // Keyboard focus also pauses rotation, otherwise the focused item would
  // rotate out of view and leave focus on a hidden row.
  const [focused, setFocused] = useState(false);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(pressTimerRef.current), []);
  const headerHeight = compact
    ? MARKET_HIGHLIGHT_MOBILE_HEADER_HEIGHT
    : MARKET_HIGHLIGHT_DESKTOP_HEADER_HEIGHT;
  const stripHeight = compact ? STRIP_HEIGHT_MOBILE : STRIP_HEIGHT_DESKTOP;
  const carouselItems = useMemo(() => {
    const items = highlights?.slice(0, MAX_CAROUSEL_HIGHLIGHTS);
    if (items?.length) return items;
    return highlight ? [highlight] : [];
  }, [highlight, highlights]);
  const quoteAssets = useMemo(
    () =>
      carouselItems.length
        ? carouselItems.flatMap((item) => item.assets.slice(0, 3))
        : undefined,
    [carouselItems],
  );
  const quotes = useMarketHighlightQuotes(quoteAssets);
  useEffect(() => {
    quotes?.forEach((quote) => {
      prewarmMarketTokenImages({ tokenImageUri: quote.logoUrl });
    });
  }, [quotes]);

  const containerPt = compact ? '$3' : '$6';
  // Only the visible text block is interactive, not the whole strip width.
  const itemProps: IXStackProps = {
    onHoverIn: () => setHovered(true),
    onHoverOut: () => setHovered(false),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    onPressIn: () => {
      clearTimeout(pressTimerRef.current);
      setPressing(true);
    },
    onPressOut: () => {
      // Hold the current item briefly so a tap does not land on a moving
      // target on touch devices.
      pressTimerRef.current = setTimeout(() => setPressing(false), 1500);
    },
    onPress: () =>
      navigation.pushModal(EModalRoutes.MarketModal, {
        screen: EModalMarketRoutes.MarketHighlights,
        params: {
          initialQuotes: quotes ? [...quotes] : undefined,
          initialHighlights: highlights
            ? { locale, items: highlights }
            : undefined,
        },
      }),
  };

  if (!highlight) {
    return (
      <YStack px="$5" pt={containerPt} h={headerHeight}>
        {/* Sized like one line of carousel text, not the whole strip. */}
        <XStack h={stripHeight} alignItems="center">
          <Skeleton
            h={CAROUSEL_ROW_HEIGHT}
            w="100%"
            maxWidth={compact ? 240 : 400}
            borderRadius="$2"
          />
        </XStack>
      </YStack>
    );
  }

  return (
    <YStack px="$5" pt={containerPt} h={headerHeight}>
      <XStack
        testID="market-highlights-strip"
        maxWidth={STRIP_MAX_WIDTH}
        alignSelf="stretch"
        h={stripHeight}
        alignItems="center"
        gap="$2.5"
      >
        {compact ? null : (
          <Icon name="SpeakerPromoteOutline" size="$4.5" color="$iconSubdued" />
        )}
        <HighlightCarousel
          items={carouselItems}
          quotes={quotes}
          compact={compact}
          paused={hovered || pressing || focused}
          height={CAROUSEL_ROW_HEIGHT}
          itemProps={itemProps}
        />
      </XStack>
    </YStack>
  );
}
