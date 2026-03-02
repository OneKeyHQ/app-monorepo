import type { PropsWithChildren } from 'react';
import { memo, useCallback, useMemo } from 'react';

import { ConfigProvider } from '@onekeyhq/components';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { useLocaleVariant } from '../hooks/useLocaleVariant';
import { useThemeVariant } from '../hooks/useThemeVariant';

function BasicThemeProvider({ children }: PropsWithChildren<unknown>) {
  const [{ theme: themeSetting }] = useSettingsPersistAtom();
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
        themeSetting={themeSetting}
        locale={localeVariant}
        HyperlinkText={HyperlinkText}
        onLocaleChange={handleLocalChange}
      >
        {children}
      </ConfigProvider>
    );
  }, [themeSetting, themeVariant, localeVariant, handleLocalChange, children]);
}

export const ThemeProvider = memo(BasicThemeProvider);
