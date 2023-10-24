import type { ComponentProps, FC } from 'react';
import { memo } from 'react';

import { Provider } from '@onekeyhq/components';

import { useThemeProviderVariant } from '../hooks/useThemeVariant';

const ThemeApp: FC = ({ children }) => {
  const { themeVariant, localeVariant } = useThemeProviderVariant();
  return (
    <Provider themeVariant={themeVariant} locale={localeVariant}>
      {children}
    </Provider>
  );
};

export default memo<ComponentProps<typeof ThemeApp>>(ThemeApp);
