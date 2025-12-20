import { memo } from 'react';

import { StyleSheet } from 'react-native';

import type { IImageProps } from '@onekeyhq/components';
import { Icon, Image, Skeleton } from '@onekeyhq/components';

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
      source={{ uri: decodeURIComponent(uri) }}
      fallback={
        <Image.Fallback>
          <Icon color="$iconSubdued" name="GlobusOutline" w={size} h={size} />
        </Image.Fallback>
      }
    />
  );
}

export const DiscoveryIcon = memo(BasicDiscoveryIcon);
