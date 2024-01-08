import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AnimatePresence, Stack, getTokenValue } from 'tamagui';

import { markFPTime } from '@onekeyhq/shared/src/modules3rdParty/metrics';

import { SplashView } from './SplashView';

export type ISplashProps = PropsWithChildren;

export function Splash({ children }: ISplashProps) {
  const [showLoading, changeLoadingVisibility] = useState(true);

  const handleSplashReady = useCallback(() => {
    changeLoadingVisibility(false);
    markFPTime();
  }, []);

  const handleExitComplete = useCallback(() => {
    markFPTime();
  }, []);

  const bgColor = useMemo(
    () => getTokenValue('$bgAppDark', 'color') as string,
    [],
  );

  return (
    <Stack flex={1}>
      {children}
      <AnimatePresence onExitComplete={handleExitComplete}>
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
            <SplashView onReady={handleSplashReady} />
          </Stack>
        )}
      </AnimatePresence>
    </Stack>
  );
}
