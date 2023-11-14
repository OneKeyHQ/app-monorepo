import type { PropsWithChildren } from 'react';
import { memo, useEffect } from 'react';

import { Provider } from '@onekeyhq/components';
import {
  setDarkContent,
  setLightContent,
} from '@onekeyhq/components/src/Navigation/utils/StatusBarUtils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const ThemeApp = ({ children }: PropsWithChildren<unknown>) => {
  const [{ theme: themeVariant, locale: localeVariant }] =
    useSettingsPersistAtom();
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
