import { Tabs as NativeTabs } from 'react-native-collapsible-tab-view';

import { TabBar, TabBarItem } from './TabBar';

export const Tabs = {
  ...NativeTabs,
  TabBar,
  TabBarItem,
};

export * from './hooks';
export { startViewTransition } from './utils';
