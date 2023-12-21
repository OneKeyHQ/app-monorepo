import { useEffect, useState } from 'react';

import { LOCALES } from '@onekeyhq/components';
import type { ILocaleSymbol } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useSystemLocale } from './useSystemLocale';

export function useLocaleVariant() {
  const [{ locale }] = useSettingsPersistAtom();
  const systemLocale = useSystemLocale();
  const currentVariant = (
    locale === 'system' ? systemLocale : locale
  ) as ILocaleSymbol;
  const [localeVariant, setLocaleVariant] = useState(() => {
    const data = LOCALES[currentVariant];
    if (typeof data === 'object') {
      return currentVariant;
    }
    return 'en-US';
  });
  useEffect(() => {
    const data = LOCALES[currentVariant];
    if (typeof data === 'function') {
      void data().then((module) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        LOCALES[currentVariant] = module.default;
        setLocaleVariant(currentVariant);
      });
    } else {
      setLocaleVariant(currentVariant);
    }
  }, [currentVariant]);
  return localeVariant;
}
