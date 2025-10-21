import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLocaleOptions } from './useLocaleOptions';

export function useLanguageSelector() {
  const localeOptions = useLocaleOptions();
  const [{ locale }] = useSettingsPersistAtom();

  // Fix issue where en-US is deprecated but still exists in user settings
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

  return {
    options,
    value,
    onChange,
  };
}
