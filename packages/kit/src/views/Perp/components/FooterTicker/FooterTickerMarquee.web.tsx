import type { ReactNode } from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { XStack } from '@onekeyhq/components';

const SCROLL_SPEED_PX_PER_SEC = 10;
const WIDTH_CHANGE_THRESHOLD = 20;

interface IFooterTickerMarqueeProps {
  children: ReactNode;
}

function FooterTickerMarquee({ children }: IFooterTickerMarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const lastWidthRef = useRef(0);
  const styleElRef = useRef<HTMLStyleElement | null>(null);
  const keyframeIdRef = useRef(0);
  // Track whether duplicate is rendered — updated synchronously during render
  // so ResizeObserver callbacks always read the correct value
  const hasDuplicateRef = useRef(false);

  const [scrollState, setScrollState] = useState<{
    needsScroll: boolean;
    duration: number;
    keyframeName: string;
  }>({ needsScroll: false, duration: 0, keyframeName: '' });

  // Keep ref in sync (set during render, before any observer fires)
  hasDuplicateRef.current = scrollState.needsScroll;

  const measureContent = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const singleWidth = hasDuplicateRef.current
      ? content.scrollWidth / 2
      : content.scrollWidth;
    const containerWidth = container.clientWidth;

    if (singleWidth > containerWidth) {
      const widthDelta = Math.abs(singleWidth - lastWidthRef.current);
      if (widthDelta < WIDTH_CHANGE_THRESHOLD && lastWidthRef.current > 0) {
        return;
      }

      lastWidthRef.current = singleWidth;

      keyframeIdRef.current += 1;
      const name = `perps-marquee-${keyframeIdRef.current}`;
      if (!styleElRef.current) {
        styleElRef.current = document.createElement('style');
        document.head.appendChild(styleElRef.current);
      }
      styleElRef.current.textContent = `
        @keyframes ${name} {
          from { transform: translateX(0); }
          to { transform: translateX(-${singleWidth}px); }
        }
      `;

      setScrollState({
        needsScroll: true,
        duration: singleWidth / SCROLL_SPEED_PX_PER_SEC,
        keyframeName: name,
      });
    } else if (lastWidthRef.current !== 0) {
      lastWidthRef.current = 0;
      setScrollState({ needsScroll: false, duration: 0, keyframeName: '' });
    }
  }, []);

  useEffect(() => {
    requestAnimationFrame(measureContent);
  }, [measureContent]);

  // Re-measure on container or content resize
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(measureContent);
    });
    observer.observe(container);
    observer.observe(content);
    return () => observer.disconnect();
  }, [measureContent]);

  useEffect(() => {
    return () => {
      styleElRef.current?.remove();
    };
  }, []);

  const handleMouseEnter = useCallback(() => setIsPaused(true), []);
  const handleMouseLeave = useCallback(() => setIsPaused(false), []);

  return (
    <XStack
      ref={containerRef as any}
      flex={1}
      overflow="hidden"
      alignItems="center"
      h="100%"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <XStack
        ref={contentRef as any}
        alignItems="center"
        style={
          scrollState.needsScroll
            ? {
                animation: `${scrollState.keyframeName} ${scrollState.duration}s linear infinite`,
                animationPlayState: isPaused ? 'paused' : 'running',
                willChange: 'transform',
              }
            : undefined
        }
      >
        {children}
        {scrollState.needsScroll ? (
          <div aria-hidden="true" style={{ display: 'contents' }}>
            {children}
          </div>
        ) : null}
      </XStack>
    </XStack>
  );
}

const FooterTickerMarqueeMemo = memo(FooterTickerMarquee);
export { FooterTickerMarqueeMemo as FooterTickerMarquee };
