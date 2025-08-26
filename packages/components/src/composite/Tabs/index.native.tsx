import type { PropsWithChildren } from 'react';

import { Tabs as NativeTabs } from 'react-native-collapsible-tab-view';

import { TabBar, TabBarItem } from './TabBar';

import type { CollapsibleProps } from 'react-native-collapsible-tab-view';

const Container = ({
  children,
  pagerProps,
  headerContainerStyle,
  ...props
}: PropsWithChildren<CollapsibleProps>) => {
  return (
    <NativeTabs.Container
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
};

export const Tabs = {
  ...NativeTabs,
  Container,
  TabBar,
  TabBarItem,
};

export * from './hooks';
export { startViewTransition } from './utils';
