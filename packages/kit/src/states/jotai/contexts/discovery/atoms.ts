import { createJotaiContext } from '../../utils/createJotaiContext';

import type { IWebTab, IWebTabsAtom } from '../../../../views/Discovery/types';

const {
  Provider: ProviderJotaiContextDiscovery,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext({ isSingletonStore: true });
export { ProviderJotaiContextDiscovery, contextAtomMethod };

export const { atom: displayHomePageAtom, use: useDisplayHomePageAtom } =
  contextAtom<boolean>(true);

export const { atom: webTabsAtom, use: useWebTabsAtom } =
  contextAtom<IWebTabsAtom>({
    tabs: [],
    keys: [],
  });
export const { atom: webTabsMapAtom } = contextAtom<Record<string, IWebTab>>(
  {},
);
export const { atom: activeTabIdAtom } = contextAtom<string | null>(null);
