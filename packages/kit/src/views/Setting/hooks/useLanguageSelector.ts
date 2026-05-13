import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { EAppRestartMode } from '@onekeyhq/shared/src/modules3rdParty/appRestart/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSystemLocale } from '../../../hooks/useSystemLocale';

import { useLocaleOptions } from './useLocaleOptions';

const changeLanguage = async (text: string) => {
  await backgroundApiProxy.serviceSetting.setLocale(text as ILocaleSymbol);
  if (platformEnv.isDesktop) {
    void globalThis.desktopApiProxy?.system?.changeLanguage?.(text);
  }
};

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
    await changeLanguage(text);
    // mode=UI restarts only the main JS runtime — bg stays hot, and the
    // SharedRPC quiesce step in BackgroundThread.restart closes the iOS
    // dangling-jsi::Function race that used to crash on this path.
    await backgroundApiProxy.serviceApp.restartApp({
      mode: EAppRestartMode.UI,
      reason: `setting.language.${text}`,
    });
  }, []);

  return {
    options,
    value,
    onChange,
  };
}

export function useLanguageSelectorWithoutAuto() {
  const localeOptions = useLocaleOptions();
  const [{ locale }] = useSettingsPersistAtom();
  const systemLocale = useSystemLocale();

  // Fix issue where en-US is deprecated but still exists in user settings
  const options = useMemo(() => {
    return localeOptions.filter(
      (item) => item.value !== 'en-US' && item.value !== 'system',
    );
  }, [localeOptions]);

  const value = useMemo(() => {
    const localeValue = locale === 'system' ? systemLocale : locale;
    if (localeValue === 'en-US') {
      return 'en';
    }
    // Check if localeValue exists in options, fallback to 'en' if not found
    const isValidLocale = options.some(
      (option) => option.value === localeValue,
    );
    return isValidLocale ? localeValue : 'en';
  }, [locale, systemLocale, options]);

  const onChange = useCallback(async (text: string) => {
    await changeLanguage(text);
  }, []);

  return useMemo(() => {
    return {
      options,
      value,
      onChange,
    };
  }, [options, value, onChange]);
}
