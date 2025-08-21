import type { PropsWithChildren } from 'react';
import { memo, useCallback, useMemo } from 'react';

import { ConfigProvider } from '@onekeyhq/components';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
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
  return useMemo(() => {
    return (
      <ConfigProvider
        theme={themeVariant as any}
        locale={localeVariant}
        HyperlinkText={HyperlinkText}
        onLocaleChange={handleLocalChange}
      >
        {children}
      </ConfigProvider>
    );
  }, [themeVariant, localeVariant, handleLocalChange, children]);
}

export const ThemeProvider = memo(BasicThemeProvider);
