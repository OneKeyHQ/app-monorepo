import { useState } from 'react';

import { useAppPagerPage } from '@onekeyhq/kit/src/components/AppPager/useAppPagerPage';

export function useTabIsRefreshingFocused() {
  const { isFocused } = useAppPagerPage();
  const [isHeaderRefreshing, setIsHeaderRefreshing] = useState(false);
  const [isFooterRefreshing, setIsFooterRefreshing] = useState(false);
  return {
    isFocused,
    isHeaderRefreshing,
    isFooterRefreshing,
    setIsHeaderRefreshing,
    setIsFooterRefreshing,
  };
}
