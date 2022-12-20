import type { FC } from 'react';

import { Image as NBImage } from 'native-base';

import type { InnerImageProps } from '../type';

export const PlatformImage: FC<InnerImageProps> = ({
  onLoad,
  onLoadStart,
  onError,
  ...rest
}) => (
  <NBImage
    alt="-"
    onLoadStart={onLoadStart}
    onLoad={onLoad}
    onError={onError}
    {...rest}
  />
);

export default PlatformImage;
