import { useEffect, useRef } from 'react';

import { SizableText, YStack } from '@onekeyhq/components';
import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate/featuredChangelog';

import { FeaturedMedia } from '../FeaturedMedia';

import { MEDIA_HEIGHT } from './constants';

interface IMediaSlideProps {
  feature: IFeaturedItem;
  isActive: boolean;
}

export function FeaturedMediaSlide({ feature, isActive }: IMediaSlideProps) {
  return (
    <FeaturedMedia
      feature={feature}
      height={MEDIA_HEIGHT}
      isActive={isActive}
    />
  );
}

interface IContentSlideProps {
  feature: IFeaturedItem;
  /** Called with the measured height so the carousel's height spring can target it. */
  onContentLayout: (height: number) => void;
}

export function FeaturedContentSlide({
  feature,
  onContentLayout,
}: IContentSlideProps) {
  const ref = useRef<unknown>(null);

  // Re-measure imperatively after the slide has had time to settle. The
  // initial onLayout sometimes fires before layout is fully stable — on web
  // it's because webfont swap doesn't trigger ResizeObserver; on native it's
  // due to dialog/sheet entry animations. Both manifest as a content height
  // that's too small until something forces a re-layout (e.g. a window drag).
  // We work around it by imperatively measuring the underlying view at a few
  // deferred ticks.
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
        if (rect.height > 0) onContentLayout(rect.height);
      } else if (typeof node.measure === 'function') {
        node.measure((_x, _y, _w, h) => {
          if (!cancelled && h > 0) onContentLayout(h);
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
  }, [feature.title, feature.description, onContentLayout]);

  return (
    <YStack
      ref={ref as never}
      px="$5"
      pt="$5"
      pb="$5"
      gap="$2"
      onLayout={(e) => onContentLayout(e.nativeEvent.layout.height)}
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
