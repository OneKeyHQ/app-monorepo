import { useEffect, useRef, useState } from 'react';

import { AppState } from 'react-native';

import { getDefaultLocale } from '../utils/locale';

import type { AppStateStatus } from 'react-native';

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
