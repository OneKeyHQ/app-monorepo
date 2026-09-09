import { useLayoutEffect, useMemo, useRef } from 'react';

import type { IImageProps } from '@onekeyhq/components';
import type { IWalletAvatarProps } from '@onekeyhq/kit/src/components/WalletAvatar';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';

import { useDeviceFlickerTrace } from '../debugDeviceFlicker';

export function DeviceFlickerAvatar({
  traceName,
  parentInstance,
  ...props
}: IWalletAvatarProps & { traceName: string; parentInstance: string }) {
  const { trace } = useDeviceFlickerTrace(traceName, { parentInstance });
  const previousSource = useRef(props.img || props.wallet?.avatarInfo?.img);
  const source = props.img || props.wallet?.avatarInfo?.img;
  useLayoutEffect(() => {
    trace('image-props', {
      parentInstance,
      sourceChanged: previousSource.current !== source,
      hasSource: Boolean(source),
      size: props.size,
    });
    previousSource.current = source;
  }, [parentInstance, props.size, source, trace]);
  const imageProps = useMemo<
    Pick<
      IImageProps,
      'onLoadStart' | 'onLoad' | 'onLoadEnd' | 'onDisplay' | 'onError'
    >
  >(
    () => ({
      onLoadStart: () => trace('image-load-start'),
      onLoad: () => trace('image-load'),
      onLoadEnd: () => trace('image-load-end'),
      onDisplay: () => trace('image-display'),
      onError: () => trace('image-error'),
    }),
    [trace],
  );
  return <WalletAvatar {...props} imageProps={imageProps} />;
}
