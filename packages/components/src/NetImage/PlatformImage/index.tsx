import React, { FC } from 'react';

import FastImage from 'react-native-fast-image';

import { InnerImageProps } from '../type';

function NBPropToFastImageProp(str?: number | string): number {
  if (typeof str === 'number') return str;
  if (typeof str === 'string') {
    if (str.endsWith('px')) {
      return Number(str.replace('px', ''));
    }
  }
  return 0;
}

export const PlatformImage: FC<InnerImageProps> = ({
  src,
  priority,
  bgColor,
  resizeMode,
  onLoad,
  onLoadStart,
  onError,
  imageKey,
  ...rest
}) => {
  const width = NBPropToFastImageProp(rest.width);
  const height = NBPropToFastImageProp(rest.height);
  let borderRadius = 0;
  if (rest.borderRadius === 'full') {
    borderRadius = Math.min(width, height) / 2;
  } else {
    borderRadius = NBPropToFastImageProp(rest.borderRadius);
  }
  return (
    <FastImage
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: bgColor,
      }}
      onLoadStart={onLoadStart}
      onLoad={onLoad}
      onError={onError}
      source={{
        uri: src,
        priority,
      }}
      resizeMode={resizeMode}
    />
  );
};

export default PlatformImage;
