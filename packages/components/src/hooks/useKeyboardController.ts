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
