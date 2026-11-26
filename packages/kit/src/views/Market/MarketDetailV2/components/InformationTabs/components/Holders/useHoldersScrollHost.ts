import { useMemo } from 'react';

import { useTabsContext } from '@onekeyhq/components/src/composite/Tabs/context';
import { useAppPagerPage } from '@onekeyhq/kit/src/components/AppPager/useAppPagerPage';

export function useHoldersScrollHost() {
  const { owner } = useAppPagerPage();
  const { scrollElement } = useTabsContext();
  return useMemo(() => {
    if (owner) return owner;
    // Desktop details scroll the whole page, including the chart above the tabs.
    for (let el = scrollElement; el; el = el.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(el).overflowY)) return el;
    }
    return scrollElement?.ownerDocument.scrollingElement ?? null;
  }, [owner, scrollElement]);
}
