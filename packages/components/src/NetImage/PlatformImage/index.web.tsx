import React, { FC } from 'react';

import { Image as NBImage } from 'native-base';

import { InnerImageProps } from '../type';

export const PlatformImage: FC<InnerImageProps> = ({
  onLoad,
  onLoadStart,
  onError,
  imageKey,
  ...rest
}) => (
  <NBImage
    alt="-"
    key={imageKey}
    onLoadStart={onLoadStart}
    onLoad={onLoad}
    onError={onError}
    {...rest}
  />
);

export default PlatformImage;
