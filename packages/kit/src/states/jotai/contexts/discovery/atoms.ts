import { LRUCache } from 'lru-cache';

import { createJotaiContext } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import { MaximumNumberOfTabs } from '@onekeyhq/kit/src/views/Discovery/config/Discovery.constants';
import type {
  IWebTab,
  IWebTabsAtom,
} from '@onekeyhq/kit/src/views/Discovery/types';
import { computeAliveWebViewIds } from '@onekeyhq/kit/src/views/Discovery/utils/computeAliveWebViewIds';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const {
  Provider: ProviderJotaiContextDiscovery,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext();
export { ProviderJotaiContextDiscovery, contextAtomMethod };

/**
 * WebTabs Atom
 */
export const { atom: displayHomePageAtom, use: useDisplayHomePageAtom } =
  contextAtom<boolean>(true);

export const { atom: webTabsAtom, use: useWebTabsAtom } =
  contextAtom<IWebTabsAtom>({
    tabs: [],
    keys: [],
  });

export const { atom: lastClosedTabAtom, use: useLastClosedTabAtom } =
  contextAtom<{
    tabs: IWebTab[];
  }>({
    tabs: [],
  });
export const { atom: webTabsMapAtom, use: useWebTabsMapAtom } = contextAtom<
  Record<string, IWebTab>
>({});
export const { atom: activeTabIdAtom, use: useActiveTabIdAtom } = contextAtom<
  string | null
>(null);

/**
 * Recency-ordered list of tab ids (most-recently-active first). Maintained on
 * tab switch/close and used to decide which tabs keep their WebView alive.
 */
export const { atom: webTabMountOrderAtom, use: useWebTabMountOrderAtom } =
  contextAtom<string[]>([]);

/**
 * Set of tab ids whose WebView should stay mounted (alive). Tabs not in this set
 * are unmounted to bound memory (recency LRU); re-activating an evicted tab
 * remounts and reloads it. Derived from tabs + active tab + recency order.
 */
export const { atom: aliveWebViewIdsAtom, use: useAliveWebViewIdsAtom } =
  contextAtomComputed<Set<string>>((get) => {
    const { tabs } = get(webTabsAtom());
    const activeTabId = get(activeTabIdAtom());
    const mountOrder = get(webTabMountOrderAtom());
    return computeAliveWebViewIds({ tabs, activeTabId, mountOrder });
  });

export const {
  atom: disabledAddedNewTabAtom,
  use: useDisabledAddedNewTabAtom,
} = contextAtomComputed((get) => {
  const { tabs } = get(webTabsAtom());
  if (platformEnv.isNative) {
    return tabs.length >= MaximumNumberOfTabs;
  }
  return false;
});

export const { atom: phishingLruCacheAtom, use: usePhishingLruCacheAtom } =
  contextAtom<LRUCache<string, boolean>>(
    new LRUCache<string, boolean>({
      max: 100,
    }),
  );

// sync data lock atom
export const { atom: browserDataReadyAtom, use: useBrowserDataReadyAtom } =
  contextAtom<boolean>(false);
