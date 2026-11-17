import { configureNativeListFonts } from '@onekeyfe/react-native-native-list';

import { BRAND_FONT_NATIVE_FAMILY } from '@onekeyhq/components/src/hocs/Provider/fonts/brandFont';

// UIAppFonts and Android assets/fonts provide these faces before JS mounts lists.
configureNativeListFonts({ ...BRAND_FONT_NATIVE_FAMILY });

export function useNativeListFonts() {
  return true;
}
