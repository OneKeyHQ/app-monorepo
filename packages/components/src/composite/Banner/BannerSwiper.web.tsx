import type { CSSProperties, ReactNode, TransitionEvent } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { type IStackStyle, Stack } from '../../primitives';

import type { ISwiperProps } from '../../layouts/Swiper/type';

const TRANSITION_MS = 250;
const DRAG_THRESHOLD = 5;
const VIEWPORT_STYLE: CSSProperties = {
  overflow: 'hidden',
  height: '100%',
  touchAction: 'pan-y',
  userSelect: 'none',
};
const TRACK_STYLE: CSSProperties = { display: 'flex', height: '100%' };
const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flex: '0 0 100%',
  minWidth: 0,
  height: '100%',
};

type IBannerSwiperProps<T> = IStackStyle &
  Pick<
    ISwiperProps<T>,
    | 'autoplay'
    | 'autoplayDelayMs'
    | 'autoplayLoop'
    | 'autoplayLoopKeepAnimation'
    | 'keyExtractor'
    | 'renderPagination'
  > & {
    data: T[];
    renderItem: (info: { item: T }) => ReactNode;
  };

export function BannerSwiper<T>({
  data,
  renderItem,
  renderPagination,
  keyExtractor,
  autoplay = false,
  autoplayDelayMs = 3000,
  autoplayLoop,
  autoplayLoopKeepAnimation,
  ...props
}: IBannerSwiperProps<T>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const animatingRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const suppressClickRef = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    width: number;
    moved: boolean;
  } | null>(null);
  const count = data.length;
  const loop = count > 1;

  const paint = useCallback((page: number, offset = 0, animate = false) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate
      ? `transform ${TRANSITION_MS}ms ease-out`
      : 'none';
    track.style.transform = `translate3d(calc(-${page * 100}% + ${offset}px), 0, 0)`;
  }, []);

  const settle = useCallback(() => {
    clearTimeout(transitionTimerRef.current);
    animatingRef.current = false;
    // Clone pages are only used during the transition across an edge.
    paint(loop ? indexRef.current + 1 : 0);
  }, [loop, paint]);

  const goToPage = useCallback(
    (page: number) => {
      if (!loop || animatingRef.current) return;
      const index = (page - 1 + count) % count;
      indexRef.current = index;
      setCurrentIndex(index);
      animatingRef.current = true;
      paint(page, 0, true);
      // transitionend may be skipped when the page is hidden or unmounted.
      transitionTimerRef.current = setTimeout(settle, TRANSITION_MS + 50);
    },
    [count, loop, paint, settle],
  );

  const goToIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < count) goToPage(index + 1);
    },
    [count, goToPage],
  );
  const goToNextIndex = useCallback(
    () => goToPage(indexRef.current + 2),
    [goToPage],
  );
  const gotToPrevIndex = useCallback(
    () => goToPage(indexRef.current),
    [goToPage],
  );

  const keys = data.map((item, index) => keyExtractor?.(item, index) ?? index);
  const dataKey = JSON.stringify(keys);
  useLayoutEffect(() => {
    dragRef.current = null;
    setPaused(false);
    indexRef.current = Math.min(indexRef.current, Math.max(0, count - 1));
    setCurrentIndex(indexRef.current);
    settle();
    return () => clearTimeout(transitionTimerRef.current);
  }, [count, dataKey, settle]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const handleDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.isPrimary === false || dragRef.current) {
        return;
      }
      settle();
      suppressClickRef.current = false;
      dragRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        width: viewport.getBoundingClientRect().width,
        moved: false,
      };
      setPaused(true);
    };
    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.moved ||= Math.max(Math.abs(dx), Math.abs(dy)) > DRAG_THRESHOLD;
      if (loop && drag.moved && Math.abs(dx) > Math.abs(dy)) {
        event.preventDefault();
        paint(
          indexRef.current + 1,
          Math.max(-drag.width, Math.min(drag.width, dx)),
        );
      }
    };
    const finish = (event?: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || (event && event.pointerId !== drag.pointerId)) return;
      const dx = event ? event.clientX - drag.x : 0;
      const dy = event ? event.clientY - drag.y : 0;
      // Keep the maximum movement, including a drag that returns to its origin.
      suppressClickRef.current =
        drag.moved || Math.max(Math.abs(dx), Math.abs(dy)) > DRAG_THRESHOLD;
      dragRef.current = null;
      setPaused(false);
      const shouldAdvance =
        event?.type === 'pointerup' &&
        Math.abs(dx) > Math.max(24, drag.width * 0.15) &&
        Math.abs(dx) > Math.abs(dy);
      if (loop) {
        const direction = dx < 0 ? 1 : -1;
        goToPage(indexRef.current + 1 + (shouldAdvance ? direction : 0));
      } else {
        settle();
      }
    };
    const handleClick = (event: MouseEvent) => {
      // A new pointerdown resets this flag; release timing never expires it.
      // detail === 0 preserves keyboard and assistive-technology activation.
      if (suppressClickRef.current && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = false;
      }
    };
    const handleDragStart = (event: DragEvent) => event.preventDefault();
    const handleBlur = () => finish();

    viewport.addEventListener('pointerdown', handleDown);
    viewport.addEventListener('click', handleClick, true);
    viewport.addEventListener('dragstart', handleDragStart);
    globalThis.addEventListener('pointermove', handleMove, { passive: false });
    globalThis.addEventListener('pointerup', finish);
    globalThis.addEventListener('pointercancel', finish);
    globalThis.addEventListener('blur', handleBlur);
    return () => {
      viewport.removeEventListener('pointerdown', handleDown);
      viewport.removeEventListener('click', handleClick, true);
      viewport.removeEventListener('dragstart', handleDragStart);
      globalThis.removeEventListener('pointermove', handleMove);
      globalThis.removeEventListener('pointerup', finish);
      globalThis.removeEventListener('pointercancel', finish);
      globalThis.removeEventListener('blur', handleBlur);
    };
  }, [goToPage, loop, paint, settle]);

  useEffect(() => {
    if (!autoplay || !loop || paused) return undefined;
    const timer = setTimeout(goToNextIndex, autoplayDelayMs);
    return () => clearTimeout(timer);
  }, [autoplay, autoplayDelayMs, currentIndex, goToNextIndex, loop, paused]);

  const pages = loop ? [count - 1, ...data.map((_, index) => index), 0] : [0];
  const handleTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLDivElement>) => {
      if (
        event.target === event.currentTarget &&
        event.propertyName === 'transform'
      ) {
        settle();
      }
    },
    [settle],
  );
  return (
    <Stack position="relative" {...props}>
      <div ref={viewportRef} style={VIEWPORT_STYLE}>
        <div
          ref={trackRef}
          style={TRACK_STYLE}
          onTransitionEnd={handleTransitionEnd}
        >
          {pages.map((index, page) => {
            const isClone = loop && (page === 0 || page === count + 1);
            const inactive = isClone || index !== currentIndex;
            return (
              <div
                key={`${isClone ? page : 'item'}-${keys[index]}`}
                aria-hidden={inactive}
                inert={inactive}
                style={PAGE_STYLE}
              >
                {data[index] !== undefined
                  ? renderItem({ item: data[index] })
                  : null}
              </div>
            );
          })}
        </div>
      </div>
      {renderPagination?.({
        currentIndex,
        goToIndex,
        goToNextIndex,
        gotToPrevIndex,
      })}
    </Stack>
  );
}
