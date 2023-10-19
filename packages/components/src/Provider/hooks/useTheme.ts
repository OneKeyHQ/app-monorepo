import { useMemo } from 'react';

import useProviderValue from './useProviderValue';

const useTheme = () => {
  const context = useProviderValue();

  return useMemo(
    () => ({
      themeVariant: context.themeVariant,
      isLight: context.themeVariant === 'light',
      isDark: context.themeVariant === 'dark',
    }),
    [context.themeVariant],
  );
};
export default useTheme;
