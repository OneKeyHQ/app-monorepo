import { useLayoutEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { setSystemBarsOverride } from '../../../hocs/Provider/hooks/useAppearanceTheme';

export function ForcedThemeSystemBars({
  theme,
  owner,
}: {
  theme: 'light' | 'dark';
  owner: string;
}) {
  useLayoutEffect(() => {
    if (!platformEnv.isNativeAndroid) {
      return undefined;
    }
    setSystemBarsOverride(theme, owner);
    return () => {
      setSystemBarsOverride(null, owner);
    };
  }, [owner, theme]);
  return null;
}
