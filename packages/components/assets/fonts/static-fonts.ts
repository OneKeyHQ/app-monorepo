import { useFonts } from 'expo-font';

const CustomFont = {
  'PlusJakartaSans-Bold': require('./PlusJakartaSans-Bold.ttf'),
  'PlusJakartaSans-Medium': require('./PlusJakartaSans-Medium.ttf'),
  'PlusJakartaSans-SemiBold': require('./PlusJakartaSans-SemiBold.ttf'),
};

export function loadCustomFonts() {
  const [fontsLoaded] = useFonts(CustomFont);
  return fontsLoaded;
}

export default {
  loadCustomFonts,
};
