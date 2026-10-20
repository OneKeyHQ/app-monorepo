import type { ReactNode } from 'react';

import type { SharedValue } from 'react-native-reanimated';

export type IAppPagerIdentity = { key: string; name: string };
export type IAppPagerPage = IAppPagerIdentity & { children: ReactNode };
export type IAppPagerChange = {
  prevIndex: number;
  index: number;
  prevTabName: string;
  tabName: string;
};
export interface IAppPagerRef {
  jumpToTab: (name: string) => void;
  setIndex: (index: number) => void;
  getFocusedTab: () => string;
  getCurrentIndex: () => number;
  syncCurrentPage: () => void;
  restoreScrollPosition?: () => boolean;
}
export type IAppPagerTabBarProps = {
  focusedTab: SharedValue<string>;
  tabNames: string[];
  onTabPress: (name: string) => void;
  indexDecimal?: SharedValue<number>;
};
export type IAppPagerCommands = {
  setPage: (index: number) => void;
  setPageWithoutAnimation: (index: number) => void;
};
