import { type PropsWithChildren, forwardRef } from 'react';

import { Tabs as NativeTabs } from 'react-native-collapsible-tab-view';

import { TabBar, TabBarItem } from './TabBar';
import { TabsDraggableFlatList } from './TabsDraggableFlatList';

import type { CollapsibleProps } from 'react-native-collapsible-tab-view';

interface IExtendedContainerProps extends CollapsibleProps {
  useNativeHeaderAnimation?: boolean;
}

const Container = forwardRef<any, PropsWithChildren<IExtendedContainerProps>>(
  ({ children, pagerProps, headerContainerStyle, ...props }, ref) => {
    return (
      <NativeTabs.Container
        ref={ref}
        headerContainerStyle={{
          shadowOpacity: 0,
          elevation: 0,
          ...(headerContainerStyle as any),
        }}
        pagerProps={
          {
            scrollSensitivity: 4,
            ...pagerProps,
          } as any
        }
        renderTabBar={(tabProps: any) => <TabBar {...tabProps} />}
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
