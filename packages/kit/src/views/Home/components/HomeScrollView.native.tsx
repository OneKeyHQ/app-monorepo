import { useContext } from 'react';
import type { ComponentProps } from 'react';

import { RefreshControl } from 'react-native';
import { NativeScroller } from 'react-native-pager-view';

import { useTheme } from '@onekeyhq/components';

import { useHomeNativeRefresh } from '../hooks/useHomeNativeRefresh';
import { HomeNativeTabContext } from '../hooks/useHomeTab.native';

export function HomeScrollView({
  children,
  refreshControl: _refreshControl,
  ...props
}: ComponentProps<typeof NativeScroller>) {
  const tab = useContext(HomeNativeTabContext);
  const theme = useTheme();
  const {
    refreshing,
    onRefresh,
    onScrollBeginDrag,
    onScroll,
    onScrollEndDrag,
  } = useHomeNativeRefresh();
  return (
    <NativeScroller
      {...props}
      style={[{ flex: 1 }, props.style]}
      pagerScrollKey={tab?.id}
      scrollEventThrottle={16}
      onScrollBeginDrag={onScrollBeginDrag}
      onScroll={onScroll}
      onScrollEndDrag={onScrollEndDrag}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.iconSubdued.val}
        />
      }
    >
      {children}
    </NativeScroller>
  );
}
