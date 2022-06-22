import { useEffect, useRef, useState } from 'react';

import * as Localization from 'expo-localization';
import { AppState, AppStateStatus } from 'react-native';

import { LOCALES_OPTION } from '@onekeyhq/components/src/locale';

const locales = LOCALES_OPTION.map((locale) => locale.value);

function getDefaultLocale() {
  const current = Localization.locale;
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    if (locale === current) {
      return locale;
    }
  }
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    const code = current.split('-')[0];
    if (code === current) {
      return locale;
    }
  }
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    const code = current.split('-')[0];
    if (locale.startsWith(code)) {
      return locale;
    }
  }
  return locales[0];
}

export function useSystemLocale() {
  const appState = useRef(AppState.currentState);
  const [locale, setLocale] = useState<string>(getDefaultLocale());
  useEffect(() => {
    AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current === 'background' && nextState === 'active') {
        setLocale(getDefaultLocale());
      }
      appState.current = nextState;
    });
  }, []);
  return locale;
}
