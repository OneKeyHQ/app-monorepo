import { useCallback, useMemo } from 'react';

import type { IIconButtonProps } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export interface IThemeButtonProps {
  size?: IIconButtonProps['size'];
  iconSize?: IIconButtonProps['iconSize'];
}

export function ThemeButton({ size, iconSize }: IThemeButtonProps) {
  const [{ theme }] = useSettingsPersistAtom();
  const themeVariant = useThemeVariant();

  const themeIcon = useMemo(() => {
    if (theme === 'system') {
      return themeVariant === 'dark' ? 'MoonOutline' : 'SunOutline';
    }
    return theme === 'dark' ? 'MoonOutline' : 'SunOutline';
  }, [theme, themeVariant]);

  const handleThemeToggle = useCallback(async () => {
    let nextTheme: 'light' | 'dark' | 'system';

    switch (theme) {
      case 'light':
        nextTheme = 'dark';
        break;
      case 'dark':
        nextTheme = 'system';
        break;
      case 'system':
      default:
        nextTheme = 'light';
        break;
    }

    await backgroundApiProxy.serviceSetting.setTheme(nextTheme);
  }, [theme]);

  return (
    <HeaderIconButton
      size={size}
      icon={themeIcon}
      iconSize={iconSize}
      onPress={handleThemeToggle}
    />
  );
}
