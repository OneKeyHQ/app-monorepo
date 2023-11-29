import type { PropsWithChildren } from 'react';
import { memo, useEffect } from 'react';

import { Provider } from '@onekeyhq/components';
import {
  setDarkContent,
  setLightContent,
} from '@onekeyhq/components/src/layouts/Navigation/utils/StatusBarUtils';

import { useLocaleVariant } from '../hooks/useLocaleVariant';
import { useThemeVariant } from '../hooks/useThemeVariant';

const ThemeApp = ({ children }: PropsWithChildren<unknown>) => {
  const themeVariant = useThemeVariant();
  const localeVariant = useLocaleVariant();
  useEffect(() => {
    if (themeVariant === 'light') {
      setDarkContent();
    } else if (themeVariant === 'dark') {
      setLightContent();
    }
  }, [themeVariant]);

  return (
    <Provider themeVariant={themeVariant as any} locale={localeVariant as any}>
      {children}
    </Provider>
  );
};

export default memo(ThemeApp);
