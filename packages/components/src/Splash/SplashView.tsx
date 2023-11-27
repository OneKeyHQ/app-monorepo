import { useCallback } from 'react';

import { Image } from '../Image';
import { Stack } from '../Stack';

import type { ISplashViewProps } from './SplashView.type';
import type { LayoutChangeEvent } from 'react-native';

export function SplashView({ onReady }: ISplashViewProps) {
  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { height, width } = e.nativeEvent.layout;
      if (height && width) {
        setTimeout(() => {
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
