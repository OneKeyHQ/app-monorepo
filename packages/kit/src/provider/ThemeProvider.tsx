import type { PropsWithChildren } from 'react';
import { memo, useEffect } from 'react';

import { Provider } from '@onekeyhq/components';
import {
  setDarkContent,
  setLightContent,
} from '@onekeyhq/components/src/Navigation/utils/StatusBarUtils';

import { useThemeProviderVariant } from '../hooks/useThemeVariant';

const ThemeApp = ({ children }: PropsWithChildren<unknown>) => {
  const { themeVariant, localeVariant } = useThemeProviderVariant();
  useEffect(() => {
    if (themeVariant === 'light') {
      setDarkContent();
    } else if (themeVariant === 'dark') {
      setLightContent();
    }
  }, [themeVariant]);

  return (
    <Provider themeVariant={themeVariant} locale={localeVariant}>
      {children}
    </Provider>
  );
};

export default memo(ThemeApp);
