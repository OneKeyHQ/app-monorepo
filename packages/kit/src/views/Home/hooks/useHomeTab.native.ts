import { createContext, useContext, useState } from 'react';

import type { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

export const HomeNativeTabContext = createContext<{
  id: EHomeWalletTab;
  isFocused: boolean;
} | null>(null);

export function useTabIsRefreshingFocused() {
  const tab = useContext(HomeNativeTabContext);
  const [isHeaderRefreshing, setIsHeaderRefreshing] = useState(false);
  const [isFooterRefreshing, setIsFooterRefreshing] = useState(false);
  return {
    isFocused: tab?.isFocused ?? true,
    isHeaderRefreshing,
    isFooterRefreshing,
    setIsHeaderRefreshing,
    setIsFooterRefreshing,
  };
}
