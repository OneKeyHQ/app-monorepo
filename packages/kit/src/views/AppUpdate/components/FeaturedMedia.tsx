import { useEffect, useRef } from 'react';

import { Image, Skeleton, Stack, Video } from '@onekeyhq/components';
import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate/featuredChangelog';

interface IFeaturedMediaProps {
  feature: IFeaturedItem;
}

function FeaturedMedia({ feature }: IFeaturedMediaProps) {
  const videoRef = useRef<{ seek?: (time: number) => void }>(null);

  useEffect(() => {
    // Reset video to start when feature changes
    if (feature.mediaType === 'video' && videoRef.current?.seek) {
      videoRef.current.seek(0);
    }
  }, [feature]);

  return (
    <Stack
      borderRadius="$3"
      overflow="hidden"
      mb="$3"
      bg="$bgSubdued"
      aspectRatio={16 / 9}
    >
      {feature.mediaType === 'video' ? (
        <Video
          ref={videoRef}
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
    </Stack>
  );
}

export { FeaturedMedia };
