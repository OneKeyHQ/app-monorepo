import { useCallback, useState } from 'react';

import { useAppStateChange } from '@onekeyhq/kit/src/hooks/useAppStateChange';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';

export function useSystemLocale() {
  const [locale, setLocale] = useState<string>(getDefaultLocale());
  const onChange = useCallback(() => {
    setLocale(getDefaultLocale());
  }, []);
  useAppStateChange(onChange);
  return locale;
}
