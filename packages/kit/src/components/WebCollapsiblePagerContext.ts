import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import type { SharedValue } from 'react-native-reanimated';

export type IWebPagerPage = {
  key: string;
  name: string;
  children: ReactNode;
};

export interface IWebCollapsiblePagerRef {
  jumpToTab: (name: string) => void;
  setIndex: (index: number) => void;
  getFocusedTab: () => string;
  getCurrentIndex: () => number;
  syncCurrentPage: () => void;
  restoreScrollPosition?: () => boolean;
}

export type IWebPagerTabBarProps = {
  focusedTab: SharedValue<string>;
  tabNames: string[];
  onTabPress: (name: string) => void;
  indexDecimal?: SharedValue<number>;
};

export const WebPagerContext = createContext<{
  focusedName: string;
  scrollToTop: () => void;
}>({ focusedName: '', scrollToTop: () => {} });

export const WebPagerPageContext = createContext<{
  key: string;
  name: string;
  isFocused: boolean;
  owner: HTMLElement | null;
  content: HTMLElement | null;
  contentHeight?: number;
  width: number;
  height: number;
  scrollTop: number;
}>({
  key: '',
  name: '',
  isFocused: true,
  owner: null,
  content: null,
  width: 0,
  height: 0,
  scrollTop: 0,
});

export const useWebPager = () => useContext(WebPagerContext);
export const useWebPagerPage = () => useContext(WebPagerPageContext);
