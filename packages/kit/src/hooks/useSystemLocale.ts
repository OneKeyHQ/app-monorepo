import { useCallback, useState } from 'react';

import { useHandleAppStateActive } from '@onekeyhq/kit/src/hooks/useHandleAppStateActive';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';

export function useSystemLocale() {
  const [locale, setLocale] = useState<ILocaleSymbol>(getDefaultLocale());
  const onChange = useCallback(() => {
    setLocale(getDefaultLocale());
  }, []);
  useHandleAppStateActive(onChange);
  return locale;
}
