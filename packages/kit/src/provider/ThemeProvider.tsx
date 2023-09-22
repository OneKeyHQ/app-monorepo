import type { ComponentProps, FC } from 'react';
import { memo, useState } from 'react';

import { Provider, ToastProvider, ToastViewport } from '@onekeyhq/components';

const ThemeApp: FC = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  return (
    <Provider
      themeVariant="light"
      leftSidebarCollapsed={isCollapsed}
      setLeftSidebarCollapsed={setIsCollapsed}
    >
      <ToastProvider native={false}>
        {children}
        <ToastViewport />
      </ToastProvider>
    </Provider>
  );
};

export default memo<ComponentProps<typeof ThemeApp>>(ThemeApp);
