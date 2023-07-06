import { useCallback, useState } from 'react';

import { useAppStateChange } from '@onekeyhq/kit/src/hooks/useAppStateChange';

import { getDefaultLocale } from '../utils/locale';

export function useSystemLocale() {
  const [locale, setLocale] = useState<string>(getDefaultLocale());
  const onChange = useCallback(() => {
    setLocale(getDefaultLocale());
  }, []);
  useAppStateChange(onChange);
  return locale;
}
