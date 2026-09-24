import { useCallback, useContext } from 'react';

import { TabsContext } from './context';

/**
 * Scroll the enclosing `Tabs.Container` back to the top without animation.
 * Must be called from inside the container (a `Tabs.Tab` subtree) so the
 * container's context is in scope.
 *
 * On web the container root is the single scroller for every pane, so this
 * delegates to the `scrollToTop` the Container exposes on its context (which
 * also drops the saved per-tab offsets). The per-tab nodes registered in
 * `scrollTabElementsRef` are NOT scrollable — `scrollTo` on them is a no-op.
 *
 * Used when the content under the tabs is replaced wholesale (home account
 * switch): the container no longer remounts on that switch, so the scroll
 * offset would otherwise carry over from the previous account.
 */
export function useTabsScrollToTop(): () => void {
  const { scrollToTop } = useContext(TabsContext);
  return useCallback(() => {
    scrollToTop?.();
  }, [scrollToTop]);
}
