import { type PropsWithChildren, forwardRef, useMemo } from 'react';

import { Tabs as NativeTabs } from 'react-native-collapsible-tab-view';

import { TabBar, TabBarItem } from './TabBar';
import { TabsDraggableFlatList } from './TabsDraggableFlatList';

import type { CollapsibleProps } from 'react-native-collapsible-tab-view';

interface IExtendedContainerProps extends CollapsibleProps {
  useNativeHeaderAnimation?: boolean;
}

const renderTabBarDefault = (tabProps: any) => <TabBar {...tabProps} />;

const Container = forwardRef<any, PropsWithChildren<IExtendedContainerProps>>(
  ({ children, pagerProps, headerContainerStyle, ...props }, ref) => {
    const mergedHeaderContainerStyle = useMemo(
      () =>
        ({
          shadowOpacity: 0,
          elevation: 0,
          ...(headerContainerStyle as Record<string, unknown>),
        }) as typeof headerContainerStyle,
      [headerContainerStyle],
    );

    const mergedPagerProps = useMemo(
      () =>
        ({
          scrollSensitivity: 4,
          ...pagerProps,
        }) as typeof pagerProps,
      [pagerProps],
    );

    return (
      <NativeTabs.Container
        ref={ref}
        headerContainerStyle={mergedHeaderContainerStyle}
        pagerProps={mergedPagerProps}
        renderTabBar={renderTabBarDefault}
        {...props}
      >
        {children}
      </NativeTabs.Container>
    );
  },
);
Container.displayName = 'NativeTabsContainer';

export const Tabs = {
  ...NativeTabs,
  Container,
  TabBar,
  TabBarItem,
  DraggableFlatList: TabsDraggableFlatList,
};

export * from './hooks';
export { startViewTransition } from './utils';
export { CollapsibleTabContext } from './CollapsibleTabContext';
export { HeaderScrollGestureWrapper } from './HeaderScrollGestureWrapper';
