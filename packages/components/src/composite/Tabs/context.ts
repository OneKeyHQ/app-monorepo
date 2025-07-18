import type { RefObject } from 'react';
import { createContext, useContext } from 'react';

import type {
  CollapsibleProps,
  RefComponent,
} from 'react-native-collapsible-tab-view';
import type { AnimatedRef, SharedValue } from 'react-native-reanimated';
import type { WindowScrollerChildProps } from 'react-virtualized';

export type ITabsContainerContext = Omit<CollapsibleProps, 'children'>;

export type ITabContextType<T extends string> = {
  headerHeight: number;
  tabBarHeight: number;
  containerHeight: number;
  revealHeaderOnScroll: boolean;
  snapThreshold: number | null | undefined;
  /**
   * Index value, including decimal points. Use this to interpolate tab
   * indicators.
   */
  indexDecimal: SharedValue<number>;
  /**
   * Tab names, same as the keys of `refMap`.
   */
  tabNames: SharedValue<T[]>;
  /**
   * Current index of the pager.
   */
  index: SharedValue<number>;
  /**
   * Name of the current focused tab.
   */
  focusedTab: SharedValue<T>;
  /**
   * DiffClamp value. It's the current visible header height if
   * `diffClampEnabled={true}`.
   */
  accDiffClamp: SharedValue<number>;
  /**
   * Scroll position of current tab.
   */
  scrollYCurrent: SharedValue<number>;
  /**
   * Array of the scroll y position of each tab.
   */
  scrollY: SharedValue<Record<string, number>>;
  /**
   * Object containing the ref of each scrollable component.
   */
  refMap: Record<string, AnimatedRef<RefComponent>>;
  /**
   * Set the ref of the scrollable component.
   */
  setRef: <RefType extends RefComponent>(
    key: string,
    ref: AnimatedRef<RefType>,
  ) => AnimatedRef<RefType>;
  /**
   * Max distance allowed to collapse the header.
   */
  headerScrollDistance: SharedValue<number>;
  /**
   * Previous addScrollY value.
   */
  oldAccScrollY: SharedValue<number>;
  /**
   * Accumulated scroll Y distance. Used to calculate the accDiffClamp value.
   */
  accScrollY: SharedValue<number>;
  /**
   * Offset to take the next scrollY as if it were at the same position of the
   * previous tab.
   */
  offset: SharedValue<number>;

  /**
   * The next snapping value.
   */
  snappingTo: SharedValue<number>;

  /**
   * Height of the scrollable content of each tab. Helps to allow iOS bouncing.
   */
  contentHeights: SharedValue<number[]>;

  contentInset: number;

  headerTranslateY: SharedValue<number>;

  width: number;

  /**
   * Whether the header moves down during overscrolling (for example on pull-to-refresh on iOS) or sticks to the top
   *
   * @default false
   */
  allowHeaderOverscroll?: boolean;

  minHeaderHeight: number;
};

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

export const useTabsScrollContext = () => {
  return useContext(TabsScrollContext);
};

export const useTabsContainerContext = () => {
  return useContext(TabsContainerContext);
};

export const TabsContext = createContext<
  ITabContextType<string> & {
    scrollTabElementsRef: RefObject<
      Record<
        string,
        {
          element: HTMLElement;
          height?: string;
        }
      >
    >;
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
