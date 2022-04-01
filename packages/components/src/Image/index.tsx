import React, { ComponentProps, FC, useState } from 'react';

import { Image as NBImage, Pressable } from 'native-base';
import { Platform } from 'react-native';

import { ImageViewer } from '@onekeyhq/components';

type ImageProps = { preview?: boolean } & ComponentProps<typeof NBImage>;

const Image: FC<ImageProps> = ({ preview = false, ...rest }) => {
  const [isVisible, setIsVisible] = useState(false);
  const { src } = rest;

  if (preview) {
    return (
      <>
        <Pressable
          onPress={() => {
            if (['ios', 'android'].includes(Platform.OS)) {
              setIsVisible(true);
            } else {
              window.open(src, '_blank');
            }
          }}
        >
          <NBImage alt="-" {...rest} />
        </Pressable>
        <ImageViewer onToggle={setIsVisible} visible={isVisible} src={src} />
      </>
    );
  }
  return <NBImage {...rest} />;
};

export default Image;
