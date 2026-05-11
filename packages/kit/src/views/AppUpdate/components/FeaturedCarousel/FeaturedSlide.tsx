import { useEffect, useRef } from 'react';

import { SizableText, YStack } from '@onekeyhq/components';
import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate/featuredChangelog';

interface IContentSlideProps {
  feature: IFeaturedItem;
  slideIndex: number;
  /** Called with the measured height so the carousel's height spring can target it. */
  onContentLayout: (slideIndex: number, height: number) => void;
}

export function FeaturedContentSlide({
  feature,
  slideIndex,
  onContentLayout,
}: IContentSlideProps) {
  const ref = useRef<unknown>(null);

  // Initial onLayout can fire before layout is stable — webfont swap doesn't
  // trigger ResizeObserver on web; sheet/dialog entry animations cause it on
  // native. Re-measure imperatively at a few deferred ticks so the height
  // is correct without requiring a window resize.
  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const node = ref.current as {
        getBoundingClientRect?: () => DOMRect;
        measure?: (
          cb: (x: number, y: number, w: number, h: number) => void,
        ) => void;
      } | null;
      if (!node) return;
      if (typeof node.getBoundingClientRect === 'function') {
        const rect = node.getBoundingClientRect();
        if (rect.height > 0) onContentLayout(slideIndex, rect.height);
      } else if (typeof node.measure === 'function') {
        node.measure((_x, _y, _w, h) => {
          if (!cancelled && h > 0) onContentLayout(slideIndex, h);
        });
      }
    };

    const timers = [setTimeout(measure, 100), setTimeout(measure, 300)];

    if (typeof document !== 'undefined' && document.fonts) {
      void document.fonts.ready.then(() => {
        requestAnimationFrame(measure);
      });
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [feature.title, feature.description, slideIndex, onContentLayout]);

  return (
    <YStack
      ref={ref as never}
      px="$5"
      pt="$5"
      pb="$8"
      gap="$2"
      onLayout={(e) => onContentLayout(slideIndex, e.nativeEvent.layout.height)}
    >
      {feature.title ? (
        <SizableText size="$headingXl" color="$text">
          {feature.title}
        </SizableText>
      ) : null}
      {feature.description ? (
        <SizableText size="$bodyLg" color="$textSubdued">
          {feature.description}
        </SizableText>
      ) : null}
    </YStack>
  );
}
