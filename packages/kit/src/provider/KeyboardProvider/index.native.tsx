import type { ComponentProps } from 'react';

import { KeyboardProvider as NativeKeyboardProvider } from 'react-native-keyboard-controller';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function KeyboardProvider({
  preload = !platformEnv.isNativeIOS,
  ...props
}: ComponentProps<typeof NativeKeyboardProvider>) {
  return <NativeKeyboardProvider {...props} preload={preload} />;
}
