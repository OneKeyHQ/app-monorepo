import type { RefObject } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { debounce } from 'lodash';
import { useDebouncedCallback } from 'use-debounce';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IconButton } from '../../actions/IconButton';
import { Stack, XStack, YStack } from '../../primitives';

import { PagerView } from './pager';
import { PaginationItem } from './PaginationItem';

import type { ICarouselProps, IPaginationItemProps } from './type';
import type { LayoutChangeEvent, NativeSyntheticEvent } from 'react-native';
import type NativePagerView from 'react-native-pager-view';

const defaultRenderPaginationItem = <T,>(
  { dotStyle, activeDotStyle, onPress }: IPaginationItemProps<T>,
  index: number,
) => {
  return (
    <PaginationItem
      key={index}
      index={index}
      dotStyle={dotStyle}
      activeDotStyle={activeDotStyle}
      onPress={onPress}
    />
  );
};

/**
 * A generic React carousel component with autoplay, looping, pagination, and imperative navigation controls.
 *
 * Renders a swipeable carousel of items with optional autoplay and looping behavior. Supports custom item rendering, pagination dot customization, and exposes imperative methods for navigation. Pagination dots are interactive and reflect the current page. The carousel adapts to container layout and pauses autoplay on user interaction.
 *
 * @returns The rendered carousel component.
 */
const CarouselContext = createContext<{
  pageIndex: number;
}>({
  pageIndex: 0,
});

const useCarouselContext = () => {
  const context = useContext(CarouselContext);
  return context;
};

export const useCarouselIndex = () => {
  const { pageIndex } = useCarouselContext();
  return pageIndex;
};

export function Carousel<T>({
  data = [],
  autoPlayInterval = 2500,
  loop = true,
  ref: instanceRef,
  renderItem,
  containerStyle,
  paginationContainerStyle,
  showPaginationButton = false,
  activeDotStyle,
  dotStyle,
  onPageChanged,
  marginRatio = 0,
  pageWidth: pageWidthProp,
  maxPageWidth,
  showPagination = true,
  renderPaginationItem = defaultRenderPaginationItem,
  disableAnimation = false,
  infinite = false,
  pagerProps,
  defaultIndex = 0,
}: ICarouselProps<T>) {
  const pagerRef = useRef<NativePagerView>(undefined);
  const [pageIndex, setPageIndex] = useState<number>(defaultIndex);
  const currentPage = useRef<number>(defaultIndex);
  currentPage.current = pageIndex;

  const debouncedSetPageIndex = useDebouncedCallback(setPageIndex, 50);

  // PagerView has no looping mode, so infinite paging clones the two edges and
  // renders [last, ...data, first]. Landing on a clone jumps — without
  // animation, onto the identical real page — so the wrap is invisible. A
  // single page has nothing to wrap around, so it stays a plain pager.
  const isInfinite = infinite && data.length > 1;
  const pages = useMemo(
    () =>
      isInfinite ? [data[data.length - 1], ...data, data[0]] : data.slice(),
    [data, isInfinite],
  );
  // `pageIndex` / `currentPage` / the pagination dots all speak logical
  // indexes; only the pager itself sees the cloned ones.
  const toRenderedIndex = useCallback(
    (logicalIndex: number) => (isInfinite ? logicalIndex + 1 : logicalIndex),
    [isInfinite],
  );
  const toLogicalIndex = useCallback(
    (renderedIndex: number) =>
      isInfinite
        ? (renderedIndex - 1 + data.length) % data.length
        : renderedIndex,
    [data.length, isInfinite],
  );

  const setPage = useCallback(
    (page: number) => {
      const renderedPage = toRenderedIndex(page);
      if (disableAnimation) {
        pagerRef.current?.setPageWithoutAnimation(renderedPage);
      } else {
        pagerRef.current?.setPage(renderedPage);
      }
    },
    [disableAnimation, toRenderedIndex],
  );

  const isResizingRef = useRef(false);

  useEffect(() => {
    if (platformEnv.isNative || !pageWidthProp) {
      return;
    }
    const onResizeEnd = debounce(() => {
      isResizingRef.current = false;
    }, 350);
    const handleResize = () => {
      isResizingRef.current = true;
      onResizeEnd();
    };
    globalThis.addEventListener('resize', handleResize);
    return () => {
      globalThis.removeEventListener('resize', handleResize);
    };
  }, [pageWidthProp]);

  // Step one rendered page in `direction`, so a wrap animates onto the adjacent
  // clone instead of scrolling the whole strip back the long way; the
  // onPageSelected handler then swaps the clone for the real page.
  const scrollToAdjacentInfinitePage = useCallback(
    (direction: 1 | -1) => {
      pagerRef.current?.setPage(
        toRenderedIndex(currentPage.current) + direction,
      );
      const nextPage =
        (currentPage.current + direction + data.length) % data.length;
      currentPage.current = nextPage;
      debouncedSetPageIndex(nextPage);
    },
    [data.length, debouncedSetPageIndex, toRenderedIndex],
  );

  const scrollToPreviousPage = useCallback(() => {
    if (isInfinite) {
      scrollToAdjacentInfinitePage(-1);
      return;
    }
    const previousPage =
      currentPage.current > 0 ? currentPage.current - 1 : data.length - 1;
    setPage(previousPage);
    currentPage.current = previousPage;
    debouncedSetPageIndex(previousPage);
  }, [
    data.length,
    debouncedSetPageIndex,
    isInfinite,
    scrollToAdjacentInfinitePage,
    setPage,
  ]);
  const scrollToNextPage = useCallback(() => {
    if (isInfinite) {
      scrollToAdjacentInfinitePage(1);
      return;
    }
    if (currentPage.current >= data.length - 1) {
      pagerRef.current?.setPageWithoutAnimation(0);
      currentPage.current = 0;
      debouncedSetPageIndex(0);
      return;
    }
    const nextPage = currentPage.current + 1;
    setPage(nextPage);
    currentPage.current = nextPage;
    debouncedSetPageIndex(nextPage);
  }, [
    data.length,
    debouncedSetPageIndex,
    isInfinite,
    scrollToAdjacentInfinitePage,
    setPage,
  ]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPageVisibleRef = useRef(true);

  const stopAutoPlay = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startAutoPlay = useCallback(() => {
    if (loop && isPageVisibleRef.current) {
      stopAutoPlay();
      timerRef.current = setTimeout(() => {
        scrollToNextPage();
        startAutoPlay();
      }, autoPlayInterval);
    }
  }, [loop, autoPlayInterval, scrollToNextPage, stopAutoPlay]);

  // Pause auto-play when the Carousel is not visible in the viewport
  // (e.g. user switched to another in-app tab). This avoids unnecessary
  // scroll events firing in the background which can blur focused inputs
  // on other pages via react-native-web's dismissKeyboard().
  const containerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (platformEnv.isNative || !loop) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nowVisible = entry?.isIntersecting ?? true;
        const prevVisible = isPageVisibleRef.current;
        isPageVisibleRef.current = nowVisible;
        if (nowVisible && !prevVisible) {
          startAutoPlay();
        } else if (!nowVisible && prevVisible) {
          stopAutoPlay();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [loop, startAutoPlay, stopAutoPlay]);

  useEffect(() => {
    startAutoPlay();
    return () => {
      stopAutoPlay();
    };
  }, [loop, autoPlayInterval, scrollToNextPage, startAutoPlay, stopAutoPlay]);

  useImperativeHandle(instanceRef, () => {
    return {
      prev: scrollToPreviousPage,
      next: scrollToNextPage,
      getCurrentIndex: () => {
        return currentPage.current || 0;
      },
      scrollTo: ({ index }: { index: number }) => {
        setPage(index);
        debouncedSetPageIndex(index);
      },
      setScrollEnabled: (scrollEnabled: boolean) => {
        pagerRef.current?.setScrollEnabled(scrollEnabled);
      },
    };
  });

  const onPressPagination = useCallback(
    (index: number) => {
      setPage(index);
      debouncedSetPageIndex(index);
    },
    [setPage, debouncedSetPageIndex],
  );

  const onPageSelected = useCallback(
    (e: NativeSyntheticEvent<Readonly<{ position: number }>>) => {
      if (isResizingRef.current) {
        return;
      }
      const renderedIndex = e.nativeEvent.position;
      const logicalIndex = toLogicalIndex(renderedIndex);
      currentPage.current = logicalIndex;
      debouncedSetPageIndex(logicalIndex);
      onPageChanged?.(logicalIndex);
      if (
        isInfinite &&
        (renderedIndex === 0 || renderedIndex === data.length + 1)
      ) {
        // A clone is on screen: swap it for the real page it duplicates, with
        // no animation so nothing is visible, which puts content back on both
        // sides of the finger. The re-entrant onPageSelected this triggers
        // resolves to the same logical index, so it is a no-op.
        pagerRef.current?.setPageWithoutAnimation(
          toRenderedIndex(logicalIndex),
        );
      }
    },
    [
      data.length,
      debouncedSetPageIndex,
      isInfinite,
      onPageChanged,
      toLogicalIndex,
      toRenderedIndex,
    ],
  );
  const [layout, setLayout] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const pageWidth = useMemo(() => {
    if (pageWidthProp) {
      return pageWidthProp;
    }
    if (platformEnv.isNative) {
      return layout.width;
    }
    const width = layout.width - marginRatio * layout.width;
    if (maxPageWidth) {
      return Math.min(width, maxPageWidth);
    }
    return width;
  }, [layout.width, marginRatio, maxPageWidth, pageWidthProp]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (pageWidthProp) {
        return;
      }
      setLayout(event.nativeEvent.layout);
    },
    [setLayout, pageWidthProp],
  );

  const handleHoverIn = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);
  const handleHoverOut = useCallback(() => {
    startAutoPlay();
  }, [startAutoPlay]);

  const value = useMemo(() => ({ pageIndex }), [pageIndex]);

  const containerSizeStyle = useMemo(
    () => ({
      width: pageWidthProp || layout.width,
      height: pageWidthProp ? '100%' : layout.height,
    }),
    [pageWidthProp, layout.width, layout.height],
  );

  const pagerViewStyle = useMemo(
    () => ({
      width: (pageWidthProp || layout.width) as number,
      height: (pageWidthProp ? '100%' : layout.height) as number | `${number}%`,
    }),
    [pageWidthProp, layout.width, layout.height],
  );

  const pageItemStyle = useMemo(
    () => ({
      width: pageWidth,
      height: '100%' as const,
    }),
    [pageWidth],
  );

  const defaultActiveDotStyle = useMemo(
    () => activeDotStyle || { bg: '$bgPrimary' as const },
    [activeDotStyle],
  );

  return (
    <CarouselContext.Provider value={value}>
      <YStack userSelect="none" ref={containerRef as any}>
        <XStack
          {...(containerStyle as any)}
          onLayout={handleLayout}
          onHoverIn={handleHoverIn}
          onHoverOut={handleHoverOut}
          onPressIn={platformEnv.isNative ? handleHoverIn : undefined}
          onPressOut={platformEnv.isNative ? handleHoverOut : undefined}
        >
          {pageWidthProp || (layout.width > 0 && layout.height > 0) ? (
            <Stack
              style={containerSizeStyle}
              key={
                pageWidthProp ? undefined : `${layout.width}-${layout.height}`
              }
            >
              <PagerView
                ref={pagerRef as RefObject<NativePagerView>}
                style={pagerViewStyle}
                initialPage={toRenderedIndex(defaultIndex)}
                pageWidth={pageWidth}
                onPageSelected={onPageSelected}
                // Only effective on native; web PagerView ignores this and uses "none"
                // to avoid globally blurring focused inputs via dismissKeyboard().
                keyboardDismissMode="on-drag"
                disableAnimation={disableAnimation}
                {...pagerProps}
              >
                {pages.map((item, index) => (
                  <Stack key={index} style={pageItemStyle}>
                    {renderItem({ item, index: toLogicalIndex(index) })}
                  </Stack>
                ))}
              </PagerView>
            </Stack>
          ) : null}
        </XStack>
        {showPagination &&
        data.length > 1 &&
        (!!pageWidthProp || (layout.width > 0 && layout.height > 0)) ? (
          <XStack
            gap="$1"
            ai="center"
            jc="space-between"
            {...(paginationContainerStyle as any)}
          >
            {showPaginationButton ? (
              // Internal carousel control.
              // oxlint-disable-next-line onekey/require-testid
              <IconButton
                icon="ChevronLeftSmallOutline"
                variant="tertiary"
                onPress={scrollToPreviousPage}
                disabled={data.length <= 1}
              />
            ) : null}
            <XStack flex={1} gap="$0" ai="center" jc="center">
              {data.map((item, index) => {
                return renderPaginationItem?.(
                  {
                    data: item,
                    dotStyle,
                    activeDotStyle:
                      index === pageIndex ? defaultActiveDotStyle : undefined,
                    onPress: () => onPressPagination(index),
                  },
                  index,
                );
              })}
            </XStack>
            {showPaginationButton ? (
              // Internal carousel control.
              // oxlint-disable-next-line onekey/require-testid
              <IconButton
                icon="ChevronRightSmallOutline"
                variant="tertiary"
                onPress={scrollToNextPage}
                disabled={data.length <= 1}
              />
            ) : null}
          </XStack>
        ) : (
          <XStack />
        )}
      </YStack>
    </CarouselContext.Provider>
  );
}

export type * from './type';
