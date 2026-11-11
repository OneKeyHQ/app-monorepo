import type { ComponentProps } from 'react';

import { KeyboardProvider as NativeKeyboardProvider } from 'react-native-keyboard-controller';

export function KeyboardProvider({
  preload = false,
  ...props
}: ComponentProps<typeof NativeKeyboardProvider>) {
  return <NativeKeyboardProvider {...props} preload={preload} />;
}
