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

  // Re-measure imperatively when web fonts become ready. Some browsers/Tamagui
  // layers don't fire ResizeObserver (and therefore onLayout) when a webfont
  // load reflows text, so the initial onLayout reading is stuck on the
  // fallback-font wrap until something forces a re-layout (e.g., a window
  // drag). This bypass takes a direct getBoundingClientRect once fonts.ready
  // resolves.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return undefined;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const node = ref.current as {
        getBoundingClientRect?: () => DOMRect;
      } | null;
      if (node && typeof node.getBoundingClientRect === 'function') {
        const rect = node.getBoundingClientRect();
        if (rect.height > 0) onContentLayout(rect.height);
      }
    };
    void document.fonts.ready.then(() => {
      // wait one frame so layout has settled after the font swap before reading
      requestAnimationFrame(measure);
    });
    return () => {
      cancelled = true;
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
