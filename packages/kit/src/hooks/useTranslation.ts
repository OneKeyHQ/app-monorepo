import { useCallback, useContext } from 'react';

import useLocale from '@onekeyhq/components/src/Provider/hooks/useLocale';

import { getDefaultLocale, normalize } from '../utils/locale';

import { useAppSelector } from './redux';

function useKey() {
  const { locale } = useLocale();
  return locale === 'system'
    ? normalize(getDefaultLocale())
    : normalize(locale);
}

export function useTranslation() {
  const key = useKey();
  const context = useAppSelector((s) => s.data.translations);
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
