import type { ReactElement } from 'react';

// Wraps a pressable element of the mobile browser chrome. Off Android the
// element handles its own press (see `chromeOnPress`), so this is a no-op.
// The Android variant routes the tap through react-native-gesture-handler.
export function ChromeTap({
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  children: ReactElement;
}) {
  return children;
}

// Whether ChromeTap itself handles presses (wrapped elements must not).
export const chromeTapHandlesPress = false;

// The press handler to put on the wrapped element itself.
export function chromeOnPress<T>(handler: T): T | undefined {
  return handler;
}
