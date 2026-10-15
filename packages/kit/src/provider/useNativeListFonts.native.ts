import { configureNativeListFonts } from '@onekeyfe/react-native-native-list';

// UIAppFonts and Android assets/fonts provide these faces before JS mounts lists.
configureNativeListFonts({
  regular: 'Roobert-Regular',
  medium: 'Roobert-Medium',
  semibold: 'Roobert-SemiBold',
  bold: 'Roobert-Bold',
});

export function useNativeListFonts() {
  return true;
}
