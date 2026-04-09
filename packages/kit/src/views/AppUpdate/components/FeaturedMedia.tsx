import { Image, Skeleton, Stack, Video } from '@onekeyhq/components';
import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate/featuredChangelog';

import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';

interface IFeaturedMediaProps extends PropsWithChildren {
  feature: IFeaturedItem;
}

function FeaturedMedia({ feature, children }: IFeaturedMediaProps) {
  return (
    <Stack
      flex={1}
      overflow="hidden"
      position="relative"
      borderRadius="$4"
      borderCurve="continuous"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
    >
      {feature.mediaType === 'video' ? (
        <Video
          key={feature.mediaUrl}
          source={{ uri: feature.mediaUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          repeat
          muted
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
