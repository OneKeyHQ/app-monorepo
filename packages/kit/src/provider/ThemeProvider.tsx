import type { ComponentProps, FC } from 'react';
import { memo, useEffect } from 'react';

import { Provider } from '@onekeyhq/components';
import {
  setDarkContent,
  setLightContent,
} from '@onekeyhq/components/src/Navigation/utils/StatusBarUtils';

import { useThemeProviderVariant } from '../hooks/useThemeVariant';

const ThemeApp: FC = ({ children }) => {
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

export default memo<ComponentProps<typeof ThemeApp>>(ThemeApp);
