import React, { ComponentType, FC, memo, useMemo } from 'react';

import {
  NavigationProp,
  useNavigation,
  useRoute,
} from '@react-navigation/core';

import Box from '../Box';
import { ICON_NAMES } from '../Icon';
import { useIsVerticalLayout } from '../Provider/hooks';

import NavigationBar from './NavigationBar';

type TabRoute = {
  icon: ICON_NAMES;
  name: string;
  translationId: string;
};

type Props = {
  content: ComponentType<any>;
  name: string;
  tabs: TabRoute[];
};

export type ChildProps = {
  activeRouteName: string;
  tabs: TabRoute[];
  navigation: NavigationProp<any>;
};

const Layout: FC<Props> = ({ content: Component, name, tabs = [] }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const isVerticalLayout = useIsVerticalLayout();

  const shouldShowTab = useMemo(
    () => tabs.map((tab) => tab.name).includes(name) || !isVerticalLayout,
    [name, isVerticalLayout, tabs],
  );

  return (
    <Box
      flexDirection={isVerticalLayout ? 'column' : 'row-reverse'}
      flex="1"
      bg="background-default"
    >
      <Component />
      {shouldShowTab ? (
        <NavigationBar
          tabs={tabs}
          navigation={navigation}
          activeRouteName={route.name}
        />
      ) : null}
    </Box>
  );
};

export default memo(Layout);
