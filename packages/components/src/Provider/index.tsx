import React, { FC, useState, useMemo } from 'react';
import { NativeBaseProvider, extendTheme } from 'native-base';

import COLORS, { getDefaultTheme, ThemeVariant } from './theme';
import { Context } from './hooks';

export type UIProviderProps = {
  /**
   * default theme variant
   */
  defaultTheme?: ThemeVariant;
};

const Provider: FC<UIProviderProps> = ({
  children,
  defaultTheme: initialTheme,
}) => {
  const defaultTheme = getDefaultTheme(initialTheme);
  const [themeVariant, setThemeVariant] = useState<ThemeVariant>(defaultTheme);

  const providerValue = useMemo(
    () => ({
      themeVariant,
      setThemeVariant,
    }),
    [themeVariant, setThemeVariant],
  );

  const themeVar = useMemo(
    () =>
      extendTheme({
        colors: COLORS[themeVariant],
      }),
    [themeVariant],
  );

  return (
    <Context.Provider value={providerValue}>
      <NativeBaseProvider theme={themeVar}>{children}</NativeBaseProvider>
    </Context.Provider>
  );
};

export default Provider;
