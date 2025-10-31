import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IIconButtonProps, ISelectItem } from '@onekeyhq/components';
import { Icon, Select } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export interface IThemeButtonProps {
  size?: IIconButtonProps['size'];
  iconSize?: IIconButtonProps['iconSize'];
}

export function ThemeButton({ size, iconSize }: IThemeButtonProps) {
  const [{ theme }] = useSettingsPersistAtom();
  const themeVariant = useThemeVariant();
  const intl = useIntl();

  const themeIcon = useMemo(() => {
    if (theme === 'system') {
      return themeVariant === 'dark' ? 'MoonOutline' : 'SunOutline';
    }
    return theme === 'dark' ? 'MoonOutline' : 'SunOutline';
  }, [theme, themeVariant]);

  const options = useMemo<ISelectItem[]>(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.global_auto,
        }),
        description: intl.formatMessage({
          id: ETranslations.global_follow_the_system,
        }),
        value: 'system' as const,
        leading: <Icon name="LaptopOutline" size="$5" />,
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_light }),
        value: 'light' as const,
        leading: <Icon name="SunOutline" size="$5" />,
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_dark }),
        value: 'dark' as const,
        leading: <Icon name="MoonOutline" size="$5" />,
      },
    ],
    [intl],
  );

  const handleChange = useCallback(async (value: string) => {
    await backgroundApiProxy.serviceSetting.setTheme(
      value as 'light' | 'dark' | 'system',
    );
  }, []);

  return (
    <Select
      title={intl.formatMessage({ id: ETranslations.settings_theme })}
      items={options}
      value={theme}
      onChange={handleChange}
      placement="bottom-end"
      floatingPanelProps={{ maxHeight: 280 }}
      renderTrigger={() => (
        <HeaderIconButton
          size={size}
          icon={themeIcon}
          iconSize={iconSize}
          title={intl.formatMessage({ id: ETranslations.settings_theme })}
        />
      )}
    />
  );
}
