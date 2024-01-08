import { useEffect } from 'react';

import { hideAsync, preventAutoHideAsync } from 'expo-splash-screen';

import type { ISplashViewProps } from './type';

void preventAutoHideAsync();

export function SplashView({ onReady }: ISplashViewProps) {
  useEffect(() => {
    setTimeout(async () => {
      await hideAsync();
      onReady();
    }, 0);
  }, [onReady]);
  return null;
}
