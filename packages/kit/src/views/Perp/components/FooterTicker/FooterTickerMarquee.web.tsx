import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { XStack } from '@onekeyhq/components';

import { FooterTickerItem } from './FooterTickerItem';
import {
  getFooterTickerItemKey,
  getFooterTickerStructureKey,
  mergeFooterTickerLiveValues,
  shouldAnimateFooterTicker,
} from './footerTickerUtils';

import type { IFooterTickerItemData } from './footerTickerUtils';

const SCROLL_SPEED_PX_PER_SEC = 20;

interface IFooterTickerMarqueeProps {
  items: IFooterTickerItemData[];
  deferStructureUpdates?: boolean;
  onItemPress: (item: IFooterTickerItemData) => void;
}

function FooterTickerMarquee({
  items,
  deferStructureUpdates = false,
  onItemPress,
}: IFooterTickerMarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const firstLoopRef = useRef<HTMLDivElement>(null);
  const latestItemsRef = useRef(items);
  const displayStructureKeyRef = useRef(getFooterTickerStructureKey(items));
  const offsetRef = useRef(0);
  const loopWidthRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const prefersReducedMotionRef = useRef(false);
  const needsScrollRef = useRef(false);
  const [displayItems, setDisplayItems] = useState(items);
  const [needsScroll, setNeedsScroll] = useState(false);

  latestItemsRef.current = items;

  const displayStructureKey = useMemo(
    () => getFooterTickerStructureKey(displayItems),
    [displayItems],
  );
  const latestStructureKey = useMemo(
    () => getFooterTickerStructureKey(items),
    [items],
  );

  const commitDisplayItems = useCallback(
    (nextItems: IFooterTickerItemData[]) => {
      const nextStructureKey = getFooterTickerStructureKey(nextItems);
      const structureChanged =
        displayStructureKeyRef.current !== nextStructureKey;

      displayStructureKeyRef.current = nextStructureKey;
      setDisplayItems(nextItems);

      if (structureChanged) {
        offsetRef.current = 0;
        loopWidthRef.current = 0;
        lastFrameTimeRef.current = null;
      }
    },
    [],
  );

  const syncLoopMetrics = useCallback(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    const firstLoop = firstLoopRef.current;
    if (!container || !firstLoop) return 0;

    const singleLoopWidth =
      firstLoop.getBoundingClientRect().width || firstLoop.scrollWidth;
    loopWidthRef.current = singleLoopWidth;
    const nextNeedsScroll = shouldAnimateFooterTicker({
      contentWidth: singleLoopWidth,
      containerWidth: container.clientWidth,
      prefersReducedMotion: prefersReducedMotionRef.current,
    });
    needsScrollRef.current = nextNeedsScroll;
    setNeedsScroll((previous) =>
      previous === nextNeedsScroll ? previous : nextNeedsScroll,
    );

    if (!nextNeedsScroll) {
      offsetRef.current = 0;
      lastFrameTimeRef.current = null;
      if (track) {
        track.style.transform = 'translate3d(0, 0, 0)';
      }
    } else if (offsetRef.current >= singleLoopWidth) {
      offsetRef.current %= singleLoopWidth;
    }

    return singleLoopWidth;
  }, []);

  useLayoutEffect(() => {
    syncLoopMetrics();
  }, [displayStructureKey, syncLoopMetrics]);

  useEffect(() => {
    const structureChanged =
      displayStructureKeyRef.current !== latestStructureKey;

    if (!structureChanged) {
      setDisplayItems(items);
      return;
    }

    if (
      prefersReducedMotionRef.current ||
      !needsScrollRef.current ||
      !deferStructureUpdates
    ) {
      commitDisplayItems(items);
      return;
    }

    setDisplayItems((previous) =>
      mergeFooterTickerLiveValues({
        displayItems: previous,
        latestItems: items,
      }),
    );
  }, [commitDisplayItems, deferStructureUpdates, items, latestStructureKey]);

  useEffect(() => {
    const container = containerRef.current;
    const firstLoop = firstLoopRef.current;
    if (!container || !firstLoop) return;

    const observer = new ResizeObserver(syncLoopMetrics);
    observer.observe(container);
    observer.observe(firstLoop);
    return () => observer.disconnect();
  }, [displayStructureKey, syncLoopMetrics]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const mediaQuery = globalThis.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    );
    const syncReducedMotion = () => {
      prefersReducedMotionRef.current = Boolean(mediaQuery?.matches);
      if (prefersReducedMotionRef.current) {
        commitDisplayItems(latestItemsRef.current);
      }
      syncLoopMetrics();
    };
    syncReducedMotion();
    mediaQuery?.addEventListener?.('change', syncReducedMotion);

    let frameId = 0;
    const step = (timestamp: number) => {
      const loopWidth = loopWidthRef.current || syncLoopMetrics();
      const lastTimestamp = lastFrameTimeRef.current ?? timestamp;
      const elapsedSeconds = Math.min(timestamp - lastTimestamp, 1000) / 1000;
      lastFrameTimeRef.current = timestamp;

      if (prefersReducedMotionRef.current || !needsScrollRef.current) {
        track.style.transform = 'translate3d(0, 0, 0)';
      } else if (!pausedRef.current && loopWidth > 0) {
        const nextOffset =
          offsetRef.current + elapsedSeconds * SCROLL_SPEED_PX_PER_SEC;
        if (nextOffset >= loopWidth) {
          const latestItems = latestItemsRef.current;
          if (
            displayStructureKeyRef.current !==
            getFooterTickerStructureKey(latestItems)
          ) {
            commitDisplayItems(latestItems);
          } else {
            offsetRef.current = 0;
          }
        } else {
          offsetRef.current = nextOffset;
        }
        track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
      }

      frameId = requestAnimationFrame(step);
    };
    frameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frameId);
      mediaQuery?.removeEventListener?.('change', syncReducedMotion);
      lastFrameTimeRef.current = null;
    };
  }, [commitDisplayItems, syncLoopMetrics]);

  const handleMouseEnter = useCallback(() => {
    pausedRef.current = true;
  }, []);
  const handleMouseLeave = useCallback(() => {
    pausedRef.current = false;
    lastFrameTimeRef.current = null;
  }, []);

  const renderLoop = useCallback(
    (isDuplicate: boolean) => (
      <XStack
        ref={isDuplicate ? undefined : (firstLoopRef as any)}
        testID={
          isDuplicate
            ? 'perp-footer-ticker-loop-duplicate'
            : 'perp-footer-ticker-loop'
        }
        aria-hidden={isDuplicate || undefined}
        alignItems="center"
        gap="$3"
        pr="$3"
        flexShrink={0}
        style={{ width: 'max-content' }}
      >
        {displayItems.map((item) => (
          <FooterTickerItem
            key={`${getFooterTickerItemKey(item)}${
              isDuplicate ? '-duplicate' : ''
            }`}
            {...item}
            isDuplicate={isDuplicate}
            onPress={onItemPress}
          />
        ))}
      </XStack>
    ),
    [displayItems, onItemPress],
  );

  return (
    <XStack
      ref={containerRef as any}
      position="relative"
      flex={1}
      overflow="hidden"
      alignItems="center"
      h="100%"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <XStack
        ref={trackRef as any}
        testID="perp-footer-ticker-track"
        alignItems="center"
        flexShrink={0}
        style={{
          width: 'max-content',
          willChange: needsScroll ? 'transform' : undefined,
        }}
      >
        {renderLoop(false)}
        {needsScroll ? renderLoop(true) : null}
      </XStack>
    </XStack>
  );
}

const FooterTickerMarqueeMemo = memo(FooterTickerMarquee);
export { FooterTickerMarqueeMemo as FooterTickerMarquee };
