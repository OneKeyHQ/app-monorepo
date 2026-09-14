import { useThemeName } from '@tamagui/web';

export function useNativeThemeNameSubscription() {
  // Raw theme values passed to native components need a React subscription.
  useThemeName();
}
