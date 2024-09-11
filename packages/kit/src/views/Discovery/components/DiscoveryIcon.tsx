import { memo } from 'react';

import { StyleSheet } from 'react-native';

import type { IImageProps } from '@onekeyhq/components';
import { Icon, Image, Skeleton, Stack } from '@onekeyhq/components';

function BasicDiscoveryIcon({
  uri,
  size,
  borderRadius = '$2',
}: {
  uri?: string;
  size: IImageProps['size'];
  borderRadius?: IImageProps['borderRadius'];
}) {
  if (!uri) {
    return <Skeleton width={size} height={size} radius="round" />;
  }
  return (
    <Image
      size={size}
      borderRadius={borderRadius}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderCurve="continuous"
    >
      <Image.Source source={{ uri: decodeURIComponent(uri) }} />
      <Image.Fallback>
        <Stack
          bg="$bgStrong"
          ai="center"
          jc="center"
          width="100%"
          height="100%"
        >
          <Icon name="GlobusOutline" width="100%" height="100%" />
        </Stack>
      </Image.Fallback>
      <Image.Loading>
        <Skeleton width="100%" height="100%" />
      </Image.Loading>
    </Image>
  );
}

export const DiscoveryIcon = memo(BasicDiscoveryIcon);
