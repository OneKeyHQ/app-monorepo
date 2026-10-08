import type { ReactNode } from 'react';
import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { IconButton, ScrollView, Stack, YStack } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';

import { MarketTestIDs } from '../../testIDs';

import {
  MARKET_BANNER_DESKTOP_WEB_DIVIDER_HEIGHT,
  MARKET_BANNER_DESKTOP_WEB_ITEM_GAP,
  MARKET_BANNER_DESKTOP_WEB_ITEM_WIDTH,
  MARKET_BANNER_ITEM_GAP,
  MARKET_BANNER_ITEM_WIDTH,
} from './marketBannerLayout';

const DIVIDER_WIDTH = 1;
// One card plus the divider and the gaps on both sides of it.
const DIVIDED_SCROLL_STEP =
  MARKET_BANNER_DESKTOP_WEB_ITEM_WIDTH +
  MARKET_BANNER_DESKTOP_WEB_ITEM_GAP * 2 +
  DIVIDER_WIDTH;
const LEGACY_SCROLL_STEP = MARKET_BANNER_ITEM_WIDTH + MARKET_BANNER_ITEM_GAP;

// Web-only horizontal scroller modeled on the Wallet home banner: edge arrows
// fade in over a background-colored gradient whenever more cards are hidden.
// Spacing follows the design's `Banner` frame: 12px above it, then 24px above
// and 36px below the cards. Legacy cards (older API responses without token
// previews) are filled and variable-width, so they keep the tighter gap and
// 20px padding without dividers.
export function MarketBannerDesktopScroller({
  children,
  itemCount,
  divided,
}: {
  children: ReactNode;
  itemCount: number;
  divided: boolean;
}) {
  const scrollViewRef = useRef<any>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const getScrollElement = useCallback((): HTMLElement | null => {
    const node = scrollViewRef.current;
    if (!node) return null;
    if (typeof node.getScrollableNode === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return node.getScrollableNode() as HTMLElement;
    }
    return node instanceof HTMLElement ? node : null;
  }, []);

  const updateArrows = useCallback(() => {
    const el = getScrollElement();
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftArrow(scrollLeft > 1);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
  }, [getScrollElement]);

  useEffect(() => {
    const el = getScrollElement();
    if (!el) return;
    const onScroll = () => updateArrows();
    el.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(() => updateArrows());
    observer.observe(el);
    updateArrows();
    return () => {
      el.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [getScrollElement, updateArrows, itemCount]);

  const scrollByStep = useCallback(
    (direction: -1 | 1) => {
      getScrollElement()?.scrollBy({
        left: direction * (divided ? DIVIDED_SCROLL_STEP : LEGACY_SCROLL_STEP),
        behavior: 'smooth',
      });
    },
    [divided, getScrollElement],
  );
  const handleScrollLeft = useCallback(() => scrollByStep(-1), [scrollByStep]);
  const handleScrollRight = useCallback(() => scrollByStep(1), [scrollByStep]);

  return (
    <YStack pt="$3" testID={MarketTestIDs.bannerList}>
      <YStack position="relative">
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={
            divided
              ? {
                  pt: '$6',
                  pb: '$9',
                  px: '$5',
                  gap: MARKET_BANNER_DESKTOP_WEB_ITEM_GAP,
                  alignItems: 'center',
                }
              : {
                  pt: '$5',
                  pb: '$5',
                  px: '$5',
                  gap: MARKET_BANNER_ITEM_GAP,
                }
          }
        >
          {divided
            ? Children.toArray(children).map((child, index) => (
                // `toArray` gives every element a key, so reuse it to keep
                // each card mounted when the list reorders.
                <Fragment key={isValidElement(child) ? child.key : index}>
                  {index > 0 ? (
                    <Stack
                      testID={MarketTestIDs.bannerDivider}
                      w={DIVIDER_WIDTH}
                      h={MARKET_BANNER_DESKTOP_WEB_DIVIDER_HEIGHT}
                      bg="$borderDisabled"
                      flexShrink={0}
                    />
                  ) : null}
                  {child}
                </Fragment>
              ))
            : children}
        </ScrollView>
        <Stack
          position="absolute"
          left={0}
          top={0}
          bottom={0}
          zIndex={1}
          justifyContent="center"
          pl="$1"
          pr="$4"
          opacity={showLeftArrow ? 1 : 0}
          pointerEvents={showLeftArrow ? 'auto' : 'none'}
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          // Web-only: `background` and `linear-gradient` are CSS properties.
          style={{
            background:
              'linear-gradient(90deg, var(--bgApp) 40%, transparent 100%)',
          }}
        >
          <IconButton
            testID={MarketTestIDs.bannerScrollLeft}
            size="small"
            icon="ChevronLeftOutline"
            bg="$gray3"
            hoverStyle={{ bg: '$gray4' }}
            pressStyle={{ bg: '$gray5' }}
            onPress={handleScrollLeft}
          />
        </Stack>
        <Stack
          position="absolute"
          right={0}
          top={0}
          bottom={0}
          zIndex={1}
          justifyContent="center"
          pr="$1"
          pl="$4"
          opacity={showRightArrow ? 1 : 0}
          pointerEvents={showRightArrow ? 'auto' : 'none'}
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          // Web-only: `background` and `linear-gradient` are CSS properties.
          style={{
            background:
              'linear-gradient(270deg, var(--bgApp) 40%, transparent 100%)',
          }}
        >
          <IconButton
            testID={MarketTestIDs.bannerScrollRight}
            size="small"
            icon="ChevronRightOutline"
            bg="$gray3"
            hoverStyle={{ bg: '$gray4' }}
            pressStyle={{ bg: '$gray5' }}
            onPress={handleScrollRight}
          />
        </Stack>
      </YStack>
    </YStack>
  );
}
