import { useFonts } from 'expo-font';

const customFont = {
  // 'PlusJakartaSans-Bold': require('../fonts/PlusJakartaSans-Bold.ttf'),
  // 'PlusJakartaSans-Medium': require('../fonts/PlusJakartaSans-Medium.ttf'),
  // 'PlusJakartaSans-SemiBold': require('../fonts/PlusJakartaSans-SemiBold.ttf'),
  'Roboto-Mono': require('../fonts/RobotoMono-Regular.ttf'),
};

export default function useLoadCustomFonts() {
  return useFonts(customFont);
}
