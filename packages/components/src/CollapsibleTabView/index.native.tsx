// iOS and Android
import { Fragment, forwardRef } from 'react';

import { TabContainerNative } from './TabContainerNative';

export const Tabs = {
  Container: forwardRef(TabContainerNative),
  // @ts-ignore to stop the warning about Fragment under development
  Tab: __DEV__ ? ({ children }) => <>{children}</> : Fragment,
};
