import { View } from 'react-native';

import { AppPager } from '@onekeyhq/kit/src/components/AppPager';
import type { IAppPagerProps } from '@onekeyhq/kit/src/components/AppPager';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { WebHistoryPaginationObserver } from '@onekeyhq/kit/src/views/Home/components/HomeHistoryListView';

export function TokenDetailsPager({
  width,
  ...props
}: IAppPagerProps & { width?: number }) {
  const isRouteFocused = useRouteIsFocused();
  return (
    <View style={{ flex: 1, width }}>
      <AppPager {...props} isRouteFocused={isRouteFocused} />
    </View>
  );
}

export const TokenDetailsPaginationObserver = WebHistoryPaginationObserver;
