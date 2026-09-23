import { useCallback, useContext } from 'react';

import { CollapsibleTabContext } from './CollapsibleTabContext';

// The pane refs are Reanimated `AnimatedRef`s; `.current` is the mounted
// scrollable (Animated.ScrollView / FlatList / SectionList).
type IScrollableInstance = {
  scrollTo?: (params: { x: number; y: number; animated: boolean }) => void;
  scrollToOffset?: (params: { offset: number; animated: boolean }) => void;
  scrollToLocation?: (params: {
    sectionIndex: number;
    itemIndex: number;
    viewOffset?: number;
    animated: boolean;
  }) => void;
};

/**
 * Scroll every pane of the enclosing `Tabs.Container` back to the top without
 * animation, which also re-expands the collapsible header, and drop the saved
 * per-pane offsets the container restores on a tab switch. Must be called from
 * inside the container (a `Tabs.Tab` subtree) so the pane refs are in scope.
 *
 * Used when the content under the tabs is replaced wholesale (home account
 * switch): the container no longer remounts on that switch, so the scroll
 * offsets would otherwise carry over from the previous account.
 *
 * Deliberately NOT Reanimated's `scrollTo`: that is a worklet whose
 * `dispatchCommand` is a no-op when invoked from the JS thread, and this runs
 * from a React layout effect. Calling the scrollable's own imperative method
 * dispatches the native command in the same commit as the content switch.
 */
export function useTabsScrollToTop(): () => void {
  const context = useContext(CollapsibleTabContext);
  return useCallback(() => {
    if (!context) {
      return;
    }
    const { refMap, contentInset, scrollY } = context;
    // On iOS the collapsible header lives in `contentInset`, so the pane's
    // "top" is a negative offset; Android pads instead (inset 0).
    const top = -(contentInset ?? 0);
    const names = Object.keys(refMap);
    // Inactive panes' scroll handlers are disabled, so the imperative scroll
    // below never reaches their saved offsets; a later tab switch would then
    // restore the previous content's position. The saved offsets are
    // inset-adjusted, so the top is 0 on both platforms.
    if (scrollY) {
      scrollY.value = Object.fromEntries(names.map((name) => [name, 0]));
    }
    for (const name of names) {
      const instance = refMap[name]?.current as
        | IScrollableInstance
        | null
        | undefined;
      if (instance) {
        if (typeof instance.scrollTo === 'function') {
          instance.scrollTo({ x: 0, y: top, animated: false });
        } else if (typeof instance.scrollToOffset === 'function') {
          instance.scrollToOffset({ offset: top, animated: false });
        } else if (typeof instance.scrollToLocation === 'function') {
          instance.scrollToLocation({
            sectionIndex: 0,
            itemIndex: 0,
            viewOffset: -top,
            animated: false,
          });
        }
      }
    }
  }, [context]);
}
