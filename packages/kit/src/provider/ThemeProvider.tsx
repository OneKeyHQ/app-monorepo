import type { ComponentProps, FC } from 'react';
import { memo, useState } from 'react';

import { Provider } from '@onekeyhq/components';

import { useThemeProviderVariant } from '../hooks/useThemeVariant';

const ThemeApp: FC = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { themeVariant } = useThemeProviderVariant();
  return (
    <Provider
      themeVariant={themeVariant}
      leftSidebarCollapsed={isCollapsed}
      setLeftSidebarCollapsed={setIsCollapsed}
    >
      {children}
    </Provider>
  );
};

export default memo<ComponentProps<typeof ThemeApp>>(ThemeApp);
