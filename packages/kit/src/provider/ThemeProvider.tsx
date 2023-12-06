import type { PropsWithChildren } from 'react';
import { memo } from 'react';

import { ConfigProvider } from '@onekeyhq/components';

import { useLocaleVariant } from '../hooks/useLocaleVariant';
import { useThemeVariant } from '../hooks/useThemeVariant';

function BasicThemeProvider({ children }: PropsWithChildren<unknown>) {
  const themeVariant = useThemeVariant();
  const localeVariant = useLocaleVariant();

  return (
    <ConfigProvider theme={themeVariant as any} locale={localeVariant as any}>
      {children}
    </ConfigProvider>
  );
}

export const ThemeProvider = memo(BasicThemeProvider);
