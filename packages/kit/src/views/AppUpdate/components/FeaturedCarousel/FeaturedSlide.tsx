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
  return (
    <YStack
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
