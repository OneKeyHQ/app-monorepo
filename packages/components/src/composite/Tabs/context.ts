import type { RefObject } from 'react';
import { createContext, useContext } from 'react';

import type {
  CollapsibleProps,
  RefComponent,
} from 'react-native-collapsible-tab-view';
import type {
  ContextType,
  TabName,
} from 'react-native-collapsible-tab-view/src/types';
import type { AnimatedRef, SharedValue } from 'react-native-reanimated';
import type { WindowScrollerChildProps } from 'react-virtualized';

export type ITabsContainerContext = Omit<CollapsibleProps, 'children'>;

export const TabsContainerContext = createContext<ITabsContainerContext>({
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

export type ITabsScrollContext = Omit<WindowScrollerChildProps, 'children'> & {
  updateListContainerHeight?: () => void;
};

export const TabsScrollContext = createContext<ITabsScrollContext>({
  height: 0,
  isScrolling: false,
  scrollTop: 0,
  scrollLeft: 0,
  onChildScroll: () => {},
  registerChild: () => {},
  width: 0,
});

export const useTabsScrollContext = () => {
  return useContext(TabsScrollContext);
};

export const useTabsContainerContext = () => {
  return useContext(TabsContainerContext);
};

export const TabsContext = createContext<
  ContextType<TabName> & {
    scrollTabElementsRef: RefObject<
      Record<
        string,
        {
          element: HTMLElement;
          height?: number;
        }
      >
    >;
    /**
     * Optional callback that lets per-tab list/scroll-view children signal
     * the Container right after they write their element ref into
     * scrollTabElementsRef. Container responds by (re-)attaching its
     * ResizeObserver to the focused tab's element. Replaces the previous
     * polling-based measurement retry loop.
     */
    requestRemeasure?: () => void;
    /**
     * Web only: scroll the container's real scroll element (the
     * `Tabs.Container` root, the only node with `overflow-y: scroll`) back to
     * the top instantly and forget every saved per-tab offset, so a later
     * tab switch / route focus does not restore the previous position.
     * The per-tab nodes in `scrollTabElementsRef` are measurement targets,
     * not scroll containers — calling `scrollTo` on them is a silent no-op.
     */
    scrollToTop?: () => void;
  }
>({
  headerHeight: 0,
  tabBarHeight: 0,
  containerHeight: 0,
  revealHeaderOnScroll: false,
  snapThreshold: 0,
  indexDecimal: { value: 0 } as SharedValue<number>,
  tabNames: { value: [] } as unknown as SharedValue<string[]>,
  index: { value: 0 } as SharedValue<number>,
  focusedTab: { value: '' } as SharedValue<string>,
  accDiffClamp: { value: 0 } as SharedValue<number>,
  scrollYCurrent: { value: 0 } as SharedValue<number>,
  isScrollDragging: { value: false } as SharedValue<boolean>,
  scrollY: { value: {} } as SharedValue<Record<string, number>>,
  refMap: {} as Record<string, AnimatedRef<RefComponent>>,
  setRef<T extends RefComponent>(
    key: string,
    ref: AnimatedRef<T>,
  ): AnimatedRef<T> {
    return ref;
  },
  headerScrollDistance: { value: 0 } as SharedValue<number>,
  oldAccScrollY: { value: 0 } as SharedValue<number>,
  accScrollY: { value: 0 } as SharedValue<number>,
  offset: { value: 0 } as SharedValue<number>,
  snappingTo: { value: 0 } as SharedValue<number>,
  contentHeights: { value: [] } as unknown as SharedValue<number[]>,
  contentInset: 0,
  headerTranslateY: { value: 0 } as SharedValue<number>,
  width: 0,
  minHeaderHeight: 0,
  scrollTabElementsRef: {} as any,
});

export const useTabsContext = () => {
  return useContext(TabsContext);
};
