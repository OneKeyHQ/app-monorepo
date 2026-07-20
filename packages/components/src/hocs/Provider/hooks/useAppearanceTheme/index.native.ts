import { useLayoutEffect } from 'react';

import { setSystemUIBaseAppearance } from '@onekeyhq/components/src/hooks/useSystemUI';
import { getTokenValue } from '@onekeyhq/components/src/shared/tamagui';

import type { IUseAppearanceTheme } from './type';

export const useAppearanceTheme: IUseAppearanceTheme = (
  themeVariant,
  themeSetting,
) => {
  useLayoutEffect(() => {
    setSystemUIBaseAppearance({
      themeVariant,
      themeSetting,
      backgroundColor: getTokenValue(
        themeVariant === 'dark' ? '$bgAppDark' : '$bgAppLight',
        'color',
      ),
    });
  }, [themeSetting, themeVariant]);
};
