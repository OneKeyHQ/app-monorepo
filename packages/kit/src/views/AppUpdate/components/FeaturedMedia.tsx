import type { PropsWithChildren } from 'react';

import { StyleSheet } from 'react-native';

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
    <Stack
      width="100%"
      height={height}
      overflow="hidden"
      position="relative"
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
    >
      {/* Loading placeholder behind the media. Image overlays it via the
          Image component's own loading machinery; Video covers it once the
          first frame paints (web HTMLVideoElement / native react-native-video). */}
      <Skeleton
        position="absolute"
        top={0}
        left={0}
        width="100%"
        height="100%"
      />
      {feature.mediaType === 'video' ? (
        <Video
          key={feature.mediaUrl}
          source={{ uri: feature.mediaUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          muted
          paused={!isActive}
        />
      ) : (
        <Image
          src={feature.mediaUrl}
          width="100%"
          height="100%"
          contentFit="cover"
          resizeMode="cover"
          fallback={<Skeleton width="100%" height="100%" />}
        />
      )}
      {children}
    </Stack>
  );
}

export { FeaturedMedia };
