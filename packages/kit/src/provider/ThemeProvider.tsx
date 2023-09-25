import type { ComponentProps, FC } from 'react';
import { memo, useState } from 'react';

import { Provider as ReduxProvider } from 'react-redux';

import { Provider, ToastProvider } from '@onekeyhq/components';
import store from '@onekeyhq/kit/src/store';

const ThemeApp: FC = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  console.log(store.getState());
  return (
    <ReduxProvider store={store}>
      <Provider
        themeVariant="light"
        leftSidebarCollapsed={isCollapsed}
        setLeftSidebarCollapsed={setIsCollapsed}
      >
        <ToastProvider>{children}</ToastProvider>
      </Provider>
    </ReduxProvider>
  );
};

export default memo<ComponentProps<typeof ThemeApp>>(ThemeApp);
