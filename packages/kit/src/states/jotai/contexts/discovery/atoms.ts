import { createJotaiContext } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import { MaximumNumberOfTabs } from '@onekeyhq/kit/src/views/Discovery/config/Discovery.constants';
import type {
  IWebTab,
  IWebTabsAtom,
} from '@onekeyhq/kit/src/views/Discovery/types';

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
  return tabs.length >= MaximumNumberOfTabs;
});
