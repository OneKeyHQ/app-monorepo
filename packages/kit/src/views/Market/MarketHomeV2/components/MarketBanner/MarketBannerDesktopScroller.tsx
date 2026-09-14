import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { IconButton, ScrollView, Stack, YStack } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';

import { MarketTestIDs } from '../../testIDs';

import {
  MARKET_BANNER_ITEM_GAP,
  MARKET_BANNER_ITEM_WIDTH,
} from './marketBannerLayout';

const SCROLL_STEP = MARKET_BANNER_ITEM_WIDTH + MARKET_BANNER_ITEM_GAP;

// Web-only horizontal scroller modeled on the Wallet home banner: edge arrows
// fade in over a background-colored gradient whenever more cards are hidden.
// Spacing follows the design's `Banner` frame: 12px above it, then 20px above
// and below the cards, so the arrows center on the cards.
export function MarketBannerDesktopScroller({
  children,
  itemCount,
}: {
  children: ReactNode;
  itemCount: number;
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
        left: direction * SCROLL_STEP,
        behavior: 'smooth',
      });
    },
    [getScrollElement],
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
          contentContainerStyle={{
            pt: '$5',
            pb: '$5',
            px: '$5',
            gap: MARKET_BANNER_ITEM_GAP,
          }}
        >
          {children}
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
