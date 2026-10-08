import { useSharedValue } from 'react-native-reanimated';

export const useReanimatedKeyboardAnimation = () => {
  const height = useSharedValue(0);
  const progress = useSharedValue(0);
  return {
    height,
    progress,
  };
};

export const useKeyboardState = () => {
  return {
    isVisible: false,
  };
};

// Web and desktop have no soft-input window mode; see the native file.
export function suspendAndroidSoftInputPan(): void {}

export function restoreAndroidSoftInputMode(): void {}
