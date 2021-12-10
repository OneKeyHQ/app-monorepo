/* eslint-disable @typescript-eslint/no-unsafe-assignment,global-require */
import { useFonts } from 'expo-font';

const CustomFont = {
  'PlusJakartaSans-Bold': require('./PlusJakartaSans-Bold.ttf'),
  'PlusJakartaSans-Medium': require('./PlusJakartaSans-Medium.ttf'),
  'PlusJakartaSans-SemiBold': require('./PlusJakartaSans-SemiBold.ttf'),
};

export default function useLoadCustomFonts() {
  const [fontsLoaded] = useFonts(CustomFont);
  return fontsLoaded;
}
