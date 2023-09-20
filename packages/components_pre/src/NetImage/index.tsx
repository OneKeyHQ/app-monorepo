import type { FC } from 'react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { Pressable } from 'native-base';

import { Box, CustomSkeleton, ImageViewer } from '@onekeyhq/components';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PlatformImage } from './PlatformImage';

import type { ImageProps, ImageState } from './type';

const BaseImage: FC<ImageProps & { onPress?: () => void }> = ({
  retry = 0,
  retryDuring = 5000,
  fallbackElement,
  onPress,
  onErrorWithTask,
  skeleton = false,
  width,
  height,
  borderRadius,
  alt,
  bgColor,
  ...rest
}) => {
  const [imageState, updateImageState] = useState<ImageState>(
    skeleton ? 'loading' : null,
  );
  const isMounted = useIsMounted();
  const { preview } = rest;
  const [src, updateSrc] = useState(rest.src);
  const retryCount = useRef(0);

  const onImagePress = useCallback(() => {
    if (onPress && rest.src && preview) {
      onPress();
    }
  }, [onPress, preview, rest.src]);

  const onImageError = useCallback(() => {
    if (onErrorWithTask && retryCount.current === 0) {
      onErrorWithTask().then((success) => {
        if (!isMounted.current) return;
        if (success) {
          updateSrc(`${rest.src as string}?t=${Date.now()}`);
          retryCount.current += 1;
        } else {
          updateImageState('fail');
        }
      });
    } else if (retryCount.current < retry) {
      setTimeout(() => {
        if (!isMounted.current) return;
        updateSrc(`${rest.src as string}?t=${Date.now()}`);
        retryCount.current += 1;
      }, retryDuring);
    } else {
      updateImageState('fail');
    }
  }, [onErrorWithTask, retry, isMounted, rest.src, retryDuring]);

  const renderImage = useMemo(() => {
    const key = platformEnv.isWeb ? src : undefined;
    return (
      <Pressable onPress={onImagePress} disabled={!preview}>
        <PlatformImage
          key={key}
          onLoad={() => {
            if (!isMounted.current) return;
            updateImageState('success');
          }}
          onError={onImageError}
          width={width}
          height={height}
          borderRadius={borderRadius}
          src={src}
          alt={alt}
          bgColor={bgColor}
          fallbackElement={
            <Box bgColor={bgColor} width={width} height={height} />
          }
        />
      </Pressable>
    );
  }, [
    src,
    onImagePress,
    preview,
    onImageError,
    width,
    height,
    borderRadius,
    alt,
    bgColor,
    isMounted,
  ]);
  return (
    <Box {...rest}>
      {imageState === 'fail' ? fallbackElement : renderImage}
      {imageState === 'loading'
        ? skeleton && (
            <CustomSkeleton
              position="absolute"
              width={width}
              height={height}
              borderRadius={borderRadius}
            />
          )
        : null}
    </Box>
  );
};

export const Image = memo(BaseImage);

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

export default memo(NetImage);
