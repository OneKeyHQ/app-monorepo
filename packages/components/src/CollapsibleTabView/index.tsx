import { forwardRef } from 'react';

import { FreezeTab } from './FreezeTab';
import { TabContainerWeb } from './TabContainerWeb';

export const Tabs = {
  Container: forwardRef(TabContainerWeb),
  // @ts-ignore to stop the warning about Fragment under development
  Tab: FreezeTab,
};

export * from './types';
