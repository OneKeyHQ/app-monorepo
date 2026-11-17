import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IScrollViewProps, IScrollViewRef } from '@onekeyhq/components';
import { IconButton, ScrollView, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const SCROLL_EDGE_TOLERANCE = 1;
const SCROLL_STEP = 220;

export function OrderInfoTabBar({ mr, ...props }: IScrollViewProps) {
  const intl = useIntl();
  const scrollRef = useRef<IScrollViewRef>(null);
  const metrics = useRef({ offset: 0, viewportWidth: 0, contentWidth: 0 });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const { offset, viewportWidth, contentWidth } = metrics.current;
    const maxOffset = Math.max(0, contentWidth - viewportWidth);
    // The browser clamps the offset when the viewport grows or content shrinks.
    const clampedOffset = Math.min(offset, maxOffset);
    metrics.current.offset = clampedOffset;
    setCanScrollLeft(clampedOffset > SCROLL_EDGE_TOLERANCE);
    setCanScrollRight(
      viewportWidth > 0 && clampedOffset < maxOffset - SCROLL_EDGE_TOLERANCE,
    );
  }, []);

  const scroll = useCallback((direction: -1 | 1) => {
    const { offset, viewportWidth, contentWidth } = metrics.current;
    const maxOffset = Math.max(0, contentWidth - viewportWidth);
    scrollRef.current?.scrollTo({
      x: Math.max(0, Math.min(maxOffset, offset + direction * SCROLL_STEP)),
      animated: true,
    });
  }, []);

  return (
    <Stack flex={1} minWidth={0} mr={mr}>
      <ScrollView
        {...props}
        ref={scrollRef}
        testID="perp-info-panel-tabs-scroll"
        scrollEventThrottle={16}
        onLayout={(event) => {
          metrics.current.viewportWidth = event.nativeEvent.layout.width;
          updateScrollState();
        }}
        onContentSizeChange={(width) => {
          metrics.current.contentWidth = width;
          updateScrollState();
        }}
        onScroll={(event) => {
          metrics.current.offset = event.nativeEvent.contentOffset.x;
          updateScrollState();
        }}
      />
      {(['left', 'right'] as const).map((direction) => {
        const isLeft = direction === 'left';
        if (!(isLeft ? canScrollLeft : canScrollRight)) {
          return null;
        }
        return (
          <Stack
            key={direction}
            position="absolute"
            top={0}
            bottom={0}
            {...(isLeft ? { left: 0 } : { right: 0 })}
            zIndex={1}
            width={40}
            alignItems={isLeft ? 'flex-start' : 'flex-end'}
            justifyContent="center"
            pointerEvents="box-none"
            style={{
              background: `linear-gradient(${isLeft ? '90deg' : '270deg'}, var(--bgApp) 50%, transparent 100%)`,
            }}
          >
            <IconButton
              testID={`perp-info-panel-tabs-scroll-${direction}`}
              icon={
                isLeft ? 'ChevronLeftSmallOutline' : 'ChevronRightSmallOutline'
              }
              iconSize={14}
              iconProps={{
                color: '$iconSubdued',
                '$group-hover': { color: '$iconHover' },
                '$group-press': { color: '$iconActive' },
              }}
              group
              variant="tertiary"
              width={24}
              height={24}
              hitSlop={0}
              p={0}
              m={0}
              borderWidth={0}
              borderRadius={0}
              justifyContent={isLeft ? 'flex-start' : 'flex-end'}
              cursor="pointer"
              hoverStyle={{ bg: '$transparent' }}
              pressStyle={{ bg: '$transparent' }}
              hotKey
              accessibilityLabel={intl.formatMessage({
                id: isLeft
                  ? ETranslations.global_back
                  : ETranslations.global_next,
              })}
              onPress={() => scroll(isLeft ? -1 : 1)}
            />
          </Stack>
        );
      })}
    </Stack>
  );
}
