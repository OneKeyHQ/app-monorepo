import { useCallback, useContext } from 'react';

import { useLocale } from '@onekeyhq/components/src/Provider/hooks';

import { TranslationContext } from '../provider/TranslationProvider';
import { getDefaultLocale, normalize } from '../utils/locale';

function useKey() {
  const { locale } = useLocale();
  return locale === 'system'
    ? normalize(getDefaultLocale())
    : normalize(locale);
}

export function useTranslation() {
  const key = useKey();
  const context = useContext(TranslationContext);
  const t = useCallback(
    (id?: string) => {
      if (!id) {
        return undefined;
      }
      const result = context?.[key]?.[id];
      return result || undefined;
    },
    [context],
  );
  return t;
}
