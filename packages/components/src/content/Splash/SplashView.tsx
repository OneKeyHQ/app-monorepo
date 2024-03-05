import { useCallback, useEffect, useMemo, useState } from 'react';

import { AnimatePresence, getTokenValue } from 'tamagui';

import { Image, Stack } from '../../primitives';

import type { ISplashViewProps } from './type';

const removeWebLogo = () => {
  const img = document.querySelector('.onekey-index-html-preload-image');
  img?.remove();
};

export function SplashView({ onExit, ready }: ISplashViewProps) {
  const [showLoading, changeLoadingVisibility] = useState(true);

  const bgColor = useMemo(
    () => getTokenValue('$bgAppDark', 'color') as string,
    [],
  );
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
      {showLoading && (
        <Stack
          key="splash-view"
          bg={bgColor}
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
      )}
    </AnimatePresence>
  );
}
