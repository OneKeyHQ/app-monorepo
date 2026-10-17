import { useState } from 'react';

import { useWebPagerPage } from '@onekeyhq/kit/src/components/WebCollapsiblePagerContext';

export function useTabIsRefreshingFocused() {
  const { isFocused } = useWebPagerPage();
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
