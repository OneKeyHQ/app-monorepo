import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useThemeValue } from './useStyle';

export const useSelectionColor = () => {
  // Android's transparent color is darker, so a lighter bgPrimary is used
  const selectionColor = useThemeValue(
    platformEnv.isNativeAndroid ? 'bgPrimaryActive' : 'bgPrimary',
  );
  return selectionColor;
};
