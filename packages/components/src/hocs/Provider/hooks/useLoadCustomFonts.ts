import { useFonts } from 'expo-font';

const customFont = {
  // 'GeistMono-Black': require('../fonts/GeistMono-Black.ttf'),
  // 'GeistMono-Bold': require('../fonts/GeistMono-Bold.ttf'),
  // 'GeistMono-Light': require('../fonts/GeistMono-Light.ttf'),
  'GeistMono-Medium': require('../fonts/GeistMono-Medium.ttf'),
  'GeistMono-Regular': require('../fonts/GeistMono-Regular.ttf'),
  // 'GeistMono-SemiBold': require('../fonts/GeistMono-SemiBold.ttf'),
  // 'GeistMono-Thin': require('../fonts/GeistMono-Thin.ttf'),
  // 'GeistMono-UltraBlack': require('../fonts/GeistMono-UltraBlack.ttf'),
  // 'GeistMono-UltraLight': require('../fonts/GeistMono-UltraLight.ttf'),
};

export default function useLoadCustomFonts() {
  return useFonts(customFont);
}
