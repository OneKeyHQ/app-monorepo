import { memo, useCallback, useEffect } from 'react';

import { useDebouncedCallback } from 'use-debounce';

import type { ForwardRefHandle } from '@onekeyhq/app/src/views/NestedTabView/NestedTabView';

import type { WalletHomeTabEnum } from './type';

function HomeTabIndexSyncCmp({
  tabsContainerRef,
  currentIndexRef,
  homeTabName,
  usedTabs,
}: {
  tabsContainerRef?: { current: ForwardRefHandle | null };
  currentIndexRef?: { current: number };
  homeTabName?: string;
  usedTabs: {
    name: WalletHomeTabEnum;
    tab: JSX.Element;
  }[];
}) {
  const getHomeTabIndex = useCallback(
    (tabName: string | undefined) => {
      const index = usedTabs.findIndex((tab) => tab.name === tabName);
      return index === -1 ? 0 : index;
    },
    [usedTabs],
  );

  const setIndex = useDebouncedCallback(
    (index: number) => {
      tabsContainerRef?.current?.setPageIndex?.(index);
    },
    1000,
    {
      leading: false,
      trailing: true,
      maxWait: 1000,
    },
  );

  useEffect(() => {
    const idx = getHomeTabIndex(homeTabName);
    if (idx === currentIndexRef?.current) return;
    setIndex(idx);
  }, [currentIndexRef, getHomeTabIndex, homeTabName, setIndex]);

  return null;
}
export const HomeTabIndexSync = memo(HomeTabIndexSyncCmp);
