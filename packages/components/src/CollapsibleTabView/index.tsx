import type { FC } from 'react';
import { Fragment, forwardRef } from 'react';

import { TabContainerWeb } from './TabContainerWeb';

export const Tabs = {
  Container: forwardRef(TabContainerWeb),
  // @ts-ignore to stop the warning about Fragment under development
  Tab: (__DEV__ ? ({ children }) => <>{children}</> : Fragment) as FC<TabProps>,
};

export * from './types';
