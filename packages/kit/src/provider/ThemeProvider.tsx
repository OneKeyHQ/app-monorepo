import type { PropsWithChildren } from 'react';
import { memo, useEffect } from 'react';

import { Provider } from '@onekeyhq/components';
import {
  setDarkContent,
  setLightContent,
} from '@onekeyhq/components/src/Navigation/utils/StatusBarUtils';

const ThemeApp = ({ children }: PropsWithChildren<unknown>) => {
  const { themeVariant, localeVariant } = {
    themeVariant: 'light',
    localeVariant: 'en',
  };
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
