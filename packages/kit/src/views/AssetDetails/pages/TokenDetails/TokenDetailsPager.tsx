import type { ReactNode } from 'react';

import { View } from 'react-native';

import { TabBar } from '@onekeyhq/components/src/composite/TabBar';
import { AppPager } from '@onekeyhq/kit/src/components/AppPager';
import type { IAppPagerProps } from '@onekeyhq/kit/src/components/AppPager';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { WebHistoryPaginationObserver } from '@onekeyhq/kit/src/views/Home/components/HomeHistoryListView';

export function TokenDetailsPager({
  width,
  toolbar,
  ...props
}: IAppPagerProps & { width?: number; toolbar?: ReactNode }) {
  const isRouteFocused = useRouteIsFocused();
  return (
    <View style={{ flex: 1, width }}>
      <AppPager
        {...props}
        isRouteFocused={isRouteFocused}
        renderTabBar={(tabBarProps) => (
          <TabBar {...tabBarProps} scrollable renderToolbar={() => toolbar} />
        )}
      />
    </View>
  );
}

export const TokenDetailsPaginationObserver = WebHistoryPaginationObserver;
