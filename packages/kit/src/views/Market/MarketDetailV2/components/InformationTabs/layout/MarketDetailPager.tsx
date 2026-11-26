import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { useSharedValue } from 'react-native-reanimated';

import { useScrollContentRegistration } from '@onekeyhq/components/src/composite/ScrollContentRegistration';
import {
  TabsContext,
  TabsScrollContext,
  useTabsContext,
  useTabsScrollContext,
} from '@onekeyhq/components/src/composite/Tabs/context';
import { TabNameContext } from '@onekeyhq/components/src/composite/Tabs/TabNameContext';
import { AppPager } from '@onekeyhq/kit/src/components/AppPager';
import { useAppPager } from '@onekeyhq/kit/src/components/AppPager/context';
import type {
  IAppPagerChange,
  IAppPagerTabBarProps,
} from '@onekeyhq/kit/src/components/AppPager/types';
import { useAppPagerPage } from '@onekeyhq/kit/src/components/AppPager/useAppPagerPage';

export type IMarketDetailPagerProps = {
  children: ReactElement<{ name: string; children: ReactNode }>[];
  width?: number;
  initialTabName?: string;
  renderHeader: () => ReactElement | null;
  renderTabBar: (props: IAppPagerTabBarProps) => ReactElement;
  onTabChange: (event: IAppPagerChange) => void;
  scrollEnabled?: boolean;
  initialHeaderHeight?: number;
  initialStickyHeaderHeight?: number;
  getStickyHeaderHeight?: (tabKey: string) => number;
};

// Lists that still use Tabs.FlatList read the active page's viewport and
// register their content with the same scroll owner as NativeList.
function MarketDetailPage({ children }: { children: ReactNode }) {
  const { name, width, height, scrollTop, owner, isFocused } =
    useAppPagerPage();
  const { focusedName } = useAppPager();
  const focusedTab = useSharedValue(focusedName);
  useEffect(() => {
    focusedTab.value = focusedName;
  }, [focusedName, focusedTab]);
  const defaults = useTabsContext();
  const scrollDefaults = useTabsScrollContext();
  const scrollTabElementsRef = useRef<
    Record<string, { element: HTMLElement; height?: number }>
  >({});
  const [element, setElement] = useState<HTMLElement | null>(null);
  const registerContent = useScrollContentRegistration();
  const registerChild = useCallback((child?: Element | null) => {
    setElement(child instanceof HTMLElement ? child : null);
  }, []);
  useEffect(() => {
    if (element && isFocused) return registerContent?.(element);
  }, [element, isFocused, registerContent]);
  const tab = useMemo(
    () => ({
      ...defaults,
      width,
      focusedTab,
      scrollElement: owner,
      scrollTabElementsRef,
    }),
    [defaults, width, focusedTab, owner],
  );
  const viewport = useMemo(
    () => ({ ...scrollDefaults, width, height, scrollTop, registerChild }),
    [scrollDefaults, width, height, scrollTop, registerChild],
  );
  return (
    <TabNameContext.Provider value={name}>
      <TabsContext.Provider value={tab}>
        <TabsScrollContext.Provider value={viewport}>
          {children}
        </TabsScrollContext.Provider>
      </TabsContext.Provider>
    </TabNameContext.Provider>
  );
}

export function MarketDetailPager({
  children,
  initialTabName,
  renderHeader,
  renderTabBar,
  onTabChange,
  scrollEnabled,
}: IMarketDetailPagerProps) {
  const pages = useMemo(
    () =>
      children.map((tab) => ({
        key: String(tab.key),
        name: tab.props.name,
        children: <MarketDetailPage>{tab.props.children}</MarketDetailPage>,
      })),
    [children],
  );
  return (
    <AppPager
      pages={pages}
      initialTabName={initialTabName}
      renderHeader={renderHeader}
      renderTabBar={renderTabBar}
      onTabChange={onTabChange}
      disableScroll={scrollEnabled === false}
    />
  );
}
