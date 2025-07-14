import { createContext } from 'react';

import type { CollapsibleProps } from 'react-native-collapsible-tab-view';
import type { WindowScrollerChildProps } from 'react-virtualized';

export type ITabsContext = Omit<CollapsibleProps, 'children'>;

export const TabsContext = createContext<ITabsContext>({
  initialTabName: '',
  headerHeight: 0,
  minHeaderHeight: 0,
  tabBarHeight: 0,
  revealHeaderOnScroll: false,
  snapThreshold: 0,
  renderHeader: undefined,
  renderTabBar: undefined,
  width: 0,
});

export type ITabsScrollContext = Omit<WindowScrollerChildProps, 'children'>;

export const TabsScrollContext = createContext<ITabsScrollContext>({
  height: 0,
  isScrolling: false,
  scrollTop: 0,
  scrollLeft: 0,
  onChildScroll: () => {},
  registerChild: () => {},
  width: 0,
});
