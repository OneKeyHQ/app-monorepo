import { useCallback } from 'react';

import { Image } from '../Image';
import { Stack } from '../Stack';

import type { ISplashViewProps } from './SplashView.type';
import type { LayoutChangeEvent } from 'react-native';

const removeWebLogo = () => {
  const img = document.querySelector('.onekey-index-html-preload-image');
  img?.remove();
};

export function SplashView({ onReady }: ISplashViewProps) {
  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { height, width } = e.nativeEvent.layout;
      if (height && width) {
        setTimeout(() => {
          removeWebLogo();
          onReady();
        }, 0);
      }
    },
    [onReady],
  );
  return (
    <Stack
      width="100vw"
      height="100vh"
      justifyContent="center"
      alignItems="center"
    >
      <Stack w={80} h={80} onLayout={handleLayout}>
        <Image
          flex={1}
          source={{
            uri: require('../../assets/splash.svg'),
          }}
        />
      </Stack>
    </Stack>
  );
}
