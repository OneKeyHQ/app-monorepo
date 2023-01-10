import { useCallback } from 'react';

import useLocale from '@onekeyhq/components/src/Provider/hooks/useLocale';

import { getDefaultLocale } from '../utils/locale';

import { useAppSelector } from './redux';

function useKey() {
  const { locale } = useLocale();
  return locale === 'system' ? getDefaultLocale() : locale;
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
    [context, key],
  );
  return t;
}
