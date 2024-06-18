import type { PropsWithChildren } from 'react';
import { memo, useCallback } from 'react';

import { ConfigProvider } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { useLocaleVariant } from '../hooks/useLocaleVariant';
import { useThemeVariant } from '../hooks/useThemeVariant';

function BasicThemeProvider({ children }: PropsWithChildren<unknown>) {
  const themeVariant = useThemeVariant();
  const localeVariant = useLocaleVariant();

  const handleLocalChange = useCallback(() => {
    // refresh appLocale in kit-bg service
    if (platformEnv.isExtension) {
      setTimeout(() => {
        void backgroundApiProxy.serviceSetting.refreshLocaleMessages();
      });
    }
  }, []);
  return (
    <ConfigProvider
      theme={themeVariant as any}
      locale={localeVariant}
      onLocaleChange={handleLocalChange}
    >
      {children}
    </ConfigProvider>
  );
}

export const ThemeProvider = memo(BasicThemeProvider);
