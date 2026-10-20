import { useFonts } from 'expo-font';

import { BRAND_FONT_NATIVE_FAMILY } from '../fonts/brandFont';

const customFont = {
  [BRAND_FONT_NATIVE_FAMILY.regular]: require('../fonts/brand/BrandSans-Regular.ttf'),
  [BRAND_FONT_NATIVE_FAMILY.medium]: require('../fonts/brand/BrandSans-Medium.ttf'),
  [BRAND_FONT_NATIVE_FAMILY.semibold]: require('../fonts/brand/BrandSans-SemiBold.ttf'),
  [BRAND_FONT_NATIVE_FAMILY.bold]: require('../fonts/brand/BrandSans-Bold.ttf'),
  'GeistMono-Medium': require('../fonts/GeistMono-Medium.ttf'),
  'GeistMono-Regular': require('../fonts/GeistMono-Regular.ttf'),
};

export default function useLoadCustomFonts() {
  return useFonts(customFont);
}
