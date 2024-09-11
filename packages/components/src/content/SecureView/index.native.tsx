import { SecureWindow } from '@bufgix/react-native-secure-window';
import { Stack } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ISecureViewProps } from './type';

export function SecureView({ children }: ISecureViewProps) {
  return platformEnv.isE2E ? (
    <Stack>{children}</Stack>
  ) : (
    <SecureWindow>{children}</SecureWindow>
  );
}

export * from './type';
