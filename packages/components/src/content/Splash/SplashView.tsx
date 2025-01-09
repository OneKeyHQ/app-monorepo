import { useCallback, useEffect, useState } from 'react';

import { AnimatePresence } from 'tamagui';

import { Image, Stack } from '../../primitives';

import type { ISplashViewProps } from './type';

const removeWebLogo = () => {
  document.documentElement.style.removeProperty('background-color');
  const img = document.querySelector('.onekey-index-html-preload-image');
  img?.remove();
};

export function SplashView({ onExit, ready }: ISplashViewProps) {
  const [showLoading, changeLoadingVisibility] = useState(true);
  const hideSplash = useCallback(() => {
    removeWebLogo();
    changeLoadingVisibility(false);
  }, []);

  useEffect(() => {
    void ready.then(() => {
      hideSplash();
    });
  }, [hideSplash, ready]);

  return (
    <AnimatePresence onExitComplete={onExit}>
      {showLoading ? (
        <Stack
          bg="$bgApp"
          key="splash-view"
          animation="50ms"
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          opacity={1}
          flex={1}
          exitStyle={{
            opacity: 0,
          }}
        >
          <Stack
            width="100vw"
            height="100vh"
            justifyContent="center"
            alignItems="center"
          >
            <Stack w={80} h={80}>
              <Image
                flex={1}
                source={{
                  uri: require('../../../assets/splash.svg'),
                }}
              />
            </Stack>
          </Stack>
        </Stack>
      ) : null}
    </AnimatePresence>
  );
}
