import { useCallback, useEffect } from 'react';

import { hideAsync, preventAutoHideAsync } from 'expo-splash-screen';

import type { ISplashViewProps } from './type';

void preventAutoHideAsync();

export function SplashView({ onExit, ready }: ISplashViewProps) {
  const hideSplash = useCallback(() => {
    void hideAsync();
    onExit?.();
  }, [onExit]);

  useEffect(() => {
    void ready.then(() => {
      hideSplash();
    });
  }, [hideSplash, ready]);
  return null;
}
