import { createJotaiContext } from '../../utils/createJotaiContext';

import type {
  IBrowserBookmark,
  IBrowserHistory,
  IWebTab,
  IWebTabsAtom,
} from '../../../../views/Discovery/types';

const {
  Provider: ProviderJotaiContextDiscovery,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext({ isSingletonStore: true });
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
export const { atom: webTabsMapAtom, use: useWebTabsMapAtom } = contextAtom<
  Record<string, IWebTab>
>({});
export const { atom: activeTabIdAtom, use: useActiveTabIdAtom } = contextAtom<
  string | null
>(null);

export const {
  atom: disabledAddedNewTabAtom,
  use: useDisabledAddedNewTabAtom,
} = contextAtomComputed((get) => {
  const { tabs } = get(webTabsAtom());
  return tabs.length >= 20;
});

/**
 * Bookmark Atom
 */
export const { atom: browserBookmarkAtom, use: useBrowserBookmarkAtom } =
  contextAtom<IBrowserBookmark[]>([]);

/**
 * History Atom
 */
export const { atom: browserHistoryAtom, use: useBrowserHistoryAtom } =
  contextAtom<IBrowserHistory[]>([]);
