import { memo } from 'react';

import type { IImageProps } from '@onekeyhq/components';
import { Icon, Image, Skeleton, Stack } from '@onekeyhq/components';

function BasicMarketTokenIcon({
  uri,
  size,
}: {
  uri: string;
  size: IImageProps['size'];
}) {
  if (!uri) {
    return <Skeleton width={size} height={size} />;
  }
  return (
    <Image size={size} circular>
      <Image.Source source={{ uri: decodeURIComponent(uri) }} />
      <Image.Fallback>
        <Stack
          bg="$bgStrong"
          ai="center"
          jc="center"
          width="100%"
          height="100%"
        >
          <Icon name="CoinOutline" size="$6" color="$iconSubdued" />
        </Stack>
      </Image.Fallback>
      <Image.Loading>
        <Skeleton width="100%" height="100%" radius="round" />
      </Image.Loading>
    </Image>
  );
}

export const MarketTokenIcon = memo(BasicMarketTokenIcon);
