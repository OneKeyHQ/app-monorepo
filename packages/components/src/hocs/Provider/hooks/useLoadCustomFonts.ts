import { useFonts } from 'expo-font';

const customFont = {
  'Roobert-Regular': require('../fonts/Roobert-Regular.ttf'),
  'Roobert-Medium': require('../fonts/Roobert-Medium.ttf'),
  'Roobert-SemiBold': require('../fonts/Roobert-SemiBold.ttf'),
  'Roobert-Bold': require('../fonts/Roobert-Bold.ttf'),
  'GeistMono-Medium': require('../fonts/GeistMono-Medium.ttf'),
  'GeistMono-Regular': require('../fonts/GeistMono-Regular.ttf'),
};

export default function useLoadCustomFonts() {
  return useFonts(customFont);
}
