import { useCallback, useMemo } from 'react';

import { Select } from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useLocaleOptions } from '@onekeyhq/kit/src/views/Setting/hooks';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export interface ILanguageButtonProps {
  size?: IIconButtonProps['size'];
  iconSize?: IIconButtonProps['iconSize'];
}

export function LanguageButton({ size, iconSize }: ILanguageButtonProps) {
  const localeOptions = useLocaleOptions();
  const [{ locale }] = useSettingsPersistAtom();

  const options = useMemo(() => {
    return localeOptions.filter((item) => item.value !== 'en-US');
  }, [localeOptions]);

  const value = useMemo(() => {
    return locale === 'en-US' ? 'en' : locale;
  }, [locale]);

  const onChange = useCallback(async (text: string) => {
    await backgroundApiProxy.serviceSetting.setLocale(text as ILocaleSymbol);
    setTimeout(() => {
      if (platformEnv.isDesktop) {
        void globalThis.desktopApiProxy?.system?.changeLanguage?.(text);
      }
      void backgroundApiProxy.serviceApp.restartApp();
    }, 0);
  }, []);

  return (
    <Select
      title="Language"
      items={options}
      value={value}
      onChange={onChange}
      placement="bottom-end"
      floatingPanelProps={{ maxHeight: 280 }}
      renderTrigger={() => (
        <HeaderIconButton
          size={size}
          icon="GlobusOutline"
          iconSize={iconSize}
          title="Language"
        />
      )}
    />
  );
}
