import React, { FC, useCallback, useMemo, useState } from 'react';

import { Pressable } from 'native-base';

import { Box, CustomSkeleton, ImageViewer } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PlatformImage } from './PlatformImage';
import { ImageProps, ImageState } from './type';

export const Image: FC<ImageProps & { onPress?: () => void }> = ({
  retry = 0,
  retryDuring = 5000,
  fallbackElement,
  onPress,
  onErrorWithTask,
  skeleton = false,
  ...rest
}) => {
  const [imageState, updateImageState] = useState<ImageState>(
    skeleton ? 'loading' : null,
  );
  const { preview } = rest;
  const [src, updateSrc] = useState(rest.src);
  const [retryCount, updateRetryCount] = useState(0);

  const onImagePress = useCallback(() => {
    if (onPress && rest.src && preview) {
      onPress();
    }
  }, [onPress, preview, rest.src]);

  const onImageError = useCallback(() => {
    if (onErrorWithTask && retryCount === 0) {
      onErrorWithTask().then((success) => {
        if (success) {
          updateSrc(`${rest.src as string}?t=${Date.now()}`);
          updateRetryCount((prevCounter) => prevCounter + 1);
        } else {
          updateImageState('fail');
        }
      });
    } else if (retryCount < retry) {
      setTimeout(() => {
        updateSrc(`${rest.src as string}?t=${Date.now()}`);
        updateRetryCount((prevCounter) => prevCounter + 1);
      }, retryDuring);
    } else {
      updateImageState('fail');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onErrorWithTask, retry, retryCount, retryDuring]);

  const renderImage = useMemo(
    () => (
      <Pressable
        key={`retry count key${retryCount}}`}
        onPress={onImagePress}
        disabled={!preview}
      >
        <PlatformImage
          onLoad={() => {
            updateImageState('success');
          }}
          onError={onImageError}
          {...rest}
          src={src}
        />
      </Pressable>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [retryCount, src],
  );
  return (
    <Box {...rest}>
      {imageState === 'fail' ? fallbackElement : renderImage}
      {imageState === 'loading'
        ? skeleton && <CustomSkeleton position="absolute" {...rest} />
        : null}
    </Box>
  );
};

const NetImage: FC<ImageProps> = ({ preview = false, ...rest }) => {
  const { src } = rest;
  const [isVisible, setIsVisible] = useState(false);
  if (preview) {
    return (
      <>
        <Image
          onPress={() => {
            if (platformEnv.isNative) {
              setIsVisible(true);
            } else {
              window.open(src, '_blank');
            }
          }}
          {...rest}
          preview
        />
        {isVisible ? (
          <ImageViewer onToggle={setIsVisible} visible={isVisible} src={src} />
        ) : null}
      </>
    );
  }
  return <Image {...rest} />;
};

export default NetImage;
