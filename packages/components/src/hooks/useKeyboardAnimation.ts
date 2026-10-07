import { useSharedValue } from 'react-native-reanimated';

export const useKeyboardAnimation = () => {
  const height = useSharedValue(0);
  return { height };
};
