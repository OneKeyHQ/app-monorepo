import { useCallback, useEffect, useMemo, useState } from 'react';

import { AnimatePresence } from '@onekeyhq/components/src/shared/tamagui';

import { Image } from '../../primitives/Image';
import { Stack } from '../../primitives/Stack';
import { ANIMATE_ONLY_OPACITY } from '../../utils/animationConstants';

import type { ISplashViewProps } from './type';

const exitStyle = { opacity: 0 };

const removePreloadElements = () => {
  document.documentElement.style.removeProperty('background-color');
  const img = document.querySelector('.onekey-index-html-preload-image');
  img?.remove();
};

export function SplashView({ onExit, ready }: ISplashViewProps) {
  const [showLoading, changeLoadingVisibility] = useState(true);
  const hideSplash = useCallback(() => {
    removePreloadElements();
    changeLoadingVisibility(false);
  }, []);

  useEffect(() => {
    void ready.then(() => {
      hideSplash();
    });
  }, [hideSplash, ready]);

  const splashSource = useMemo(
    () => ({
      uri: require('../../../assets/splash.svg'),
    }),
    [],
  );

  return (
    <AnimatePresence onExitComplete={onExit}>
      {showLoading ? (
        <Stack
          bg="$bgApp"
          key="splash-view"
          animation="50ms"
          animateOnly={ANIMATE_ONLY_OPACITY}
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          opacity={1}
          flex={1}
          exitStyle={exitStyle}
        >
          <Stack
            width="100vw"
            height="100vh"
            justifyContent="center"
            alignItems="center"
          >
            <Stack w={80} h={80}>
              <Image flex={1} source={splashSource} />
            </Stack>
          </Stack>
        </Stack>
      ) : null}
    </AnimatePresence>
  );
}
