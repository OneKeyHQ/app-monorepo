import type { PropsWithChildren } from 'react';

import { Image, Skeleton, Stack, Video } from '@onekeyhq/components';
import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate/featuredChangelog';

interface IFeaturedMediaProps extends PropsWithChildren {
  feature: IFeaturedItem;
  height: number;
  /** Whether this slide is the active (visible) one. Controls video play/pause. */
  isActive: boolean;
}

function FeaturedMedia({
  feature,
  height,
  isActive,
  children,
}: IFeaturedMediaProps) {
  return (
    <Stack width="100%" height={height} overflow="hidden" position="relative">
      {/* Loading placeholder. Media is absolutely positioned so it stacks
          above the skeleton via DOM order (web: positioned elements with
          same stacking layer go by source order). */}
      <Skeleton
        position="absolute"
        top={0}
        left={0}
        width="100%"
        height="100%"
        borderRadius={0}
      />
      {feature.mediaType === 'video' ? (
        <Video
          key={feature.mediaUrl}
          source={{ uri: feature.mediaUrl }}
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          resizeMode="cover"
          muted
          paused={!isActive}
        />
      ) : (
        <Image
          src={feature.mediaUrl}
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          contentFit="cover"
          resizeMode="cover"
        />
      )}
      {children}
    </Stack>
  );
}

export { FeaturedMedia };
