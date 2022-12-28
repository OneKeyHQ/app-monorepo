import { useMemo } from 'react';

import useProviderValue from './useProviderValue';

export default function useLocale() {
  const context = useProviderValue();

  return useMemo(
    () => ({
      locale: context.locale,
    }),
    [context.locale],
  );
}
