/* eslint-disable global-require, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-var-requires */
import React, { FC, useState } from 'react';

import { Pressable } from 'native-base';

import { ImageViewer } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import OKImage from '../Image';
import { ThemeToken } from '../Provider/theme';

let FastImage: typeof import('react-native-fast-image').default | undefined;
try {
  FastImage = require('react-native-fast-image');
} catch (e) {
  // Ignore
  console.debug('Error on require `react-native-fast-image` module', e);
}

type ImageProps = {
  alt?: string;
  width?: number | undefined;
  height?: number | undefined;
  size?: number | undefined;
  borderRadius?: number;
  bgColor?: ThemeToken;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
  uri: string;
  priority?: 'low' | 'normal' | 'high';
  preview?: boolean;
};

export const Image: FC<ImageProps> = ({ ...rest }) => {
  const { uri, resizeMode, preview, priority, borderRadius, bgColor } = rest;
  const width = rest.width ?? rest.size;
  const height = rest.height ?? rest.size;
  if (platformEnv.isNative && !!FastImage) {
    return (
      <FastImage
        style={{ width, height, borderRadius, backgroundColor: bgColor }}
        source={{
          uri,
          priority,
        }}
        resizeMode={resizeMode}
      />
    );
  }
  return (
    <OKImage
      width={`${width ?? 0}px`}
      height={`${height ?? 0}px`}
      src={uri}
      resizeMode={resizeMode}
      preview={preview}
      borderRadius={`${borderRadius ?? 0}px`}
      bgColor={bgColor}
    />
  );
};

const NetImage: FC<ImageProps> = ({ ...rest }) => {
  const { preview, uri } = rest;
  const [isVisible, setIsVisible] = useState(false);
  if (preview) {
    return (
      <>
        <Pressable
          onPress={() => {
            if (platformEnv.isNative) {
              setIsVisible(true);
            } else {
              window.open(uri, '_blank');
            }
          }}
        >
          <Image {...rest} />
        </Pressable>
        {isVisible ? (
          <ImageViewer onToggle={setIsVisible} visible={isVisible} src={uri} />
        ) : null}
      </>
    );
  }
  return <Image {...rest} />;
};

export default NetImage;
