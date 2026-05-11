import type { PropsWithChildren } from 'react';

import { StyleSheet } from 'react-native';

import { Image, Skeleton, Stack, Video } from '@onekeyhq/components';
import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate/featuredChangelog';

interface IFeaturedMediaProps extends PropsWithChildren {
  feature: IFeaturedItem;
  /** Explicit pixel height for the media area. When omitted, falls back to flex=1 to fill parent. */
  height?: number;
  /** Whether this slide is the active (visible) one. Controls video play/pause. Defaults to true for backward compat. */
  isActive?: boolean;
}

function FeaturedMedia({
  feature,
  height,
  isActive = true,
  children,
}: IFeaturedMediaProps) {
  return (
    <Stack
      {...(height !== undefined ? { width: '100%', height } : { flex: 1 })}
      overflow="hidden"
      position="relative"
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
    >
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
          resizeMode="cover"
          fallback={<Skeleton width="100%" height="100%" />}
          skeleton={<Skeleton width="100%" height="100%" />}
        />
      )}
      {children}
    </Stack>
  );
}

export { FeaturedMedia };
