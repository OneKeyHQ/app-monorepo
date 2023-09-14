import { forwardRef } from 'react';

import { LazyTab } from './LazyTab';
import { TabContainerWeb } from './TabContainerWeb';

export const Tabs = {
  Container: forwardRef(TabContainerWeb),
  // @ts-ignore to stop the warning about Fragment under development
  Tab: LazyTab,
};

export * from './types';
