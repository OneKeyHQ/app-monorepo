import { useCallback, useEffect } from 'react';

import { SecureWindow } from '@bufgix/react-native-secure-window';
import {
  addScreenshotListener,
  requestPermissionsAsync,
} from 'expo-screen-capture';
import { Stack } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ISecureViewProps } from './type';

export function SecureView({ children, onScreenCapture }: ISecureViewProps) {
  const hasPermissions = useCallback(async () => {
    const { status } = await requestPermissionsAsync();
    return status === 'granted';
  }, []);
  useEffect(() => {
    let subscription: { remove: () => void };

    const addListenerAsync = async () => {
      if (await hasPermissions()) {
        subscription = addScreenshotListener(() => {
          onScreenCapture?.();
        });
      } else {
        console.error(
          'Permissions needed to subscribe to screenshot events are missing!',
        );
      }
    };
    void addListenerAsync();

    return () => {
      subscription?.remove();
    };
  }, [hasPermissions, onScreenCapture]);
  return platformEnv.isE2E ? (
    <Stack>{children}</Stack>
  ) : (
    <SecureWindow>{children}</SecureWindow>
  );
}

export * from './type';
