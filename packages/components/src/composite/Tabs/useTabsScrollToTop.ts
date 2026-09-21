import { useCallback, useContext } from 'react';

import { TabsContext } from './context';

/**
 * Scroll every pane of the enclosing `Tabs.Container` back to the top without
 * animation. Must be called from inside the container (a `Tabs.Tab` subtree)
 * so the per-tab scroll elements are in scope.
 *
 * Used when the content under the tabs is replaced wholesale (home account
 * switch): the container no longer remounts on that switch, so the scroll
 * offsets would otherwise carry over from the previous account.
 */
export function useTabsScrollToTop(): () => void {
  const { scrollTabElementsRef } = useContext(TabsContext);
  return useCallback(() => {
    const elements = scrollTabElementsRef?.current;
    if (!elements) {
      return;
    }
    for (const entry of Object.values(elements)) {
      entry?.element?.scrollTo?.({ top: 0, behavior: 'instant' });
    }
  }, [scrollTabElementsRef]);
}
