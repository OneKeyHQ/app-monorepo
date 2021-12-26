import React, { ComponentType, FC, memo, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';

import Box from '../Box';
import { useUserDevice } from '../Provider/hooks';

import NavigationBar from './NavigationBar';

type Props = {
  content: ComponentType<any>;
  name: string;
};

const Layout: FC<Props> = ({ content: Component, name, tabs = [] }) => {
  const { size } = useUserDevice();
  const navigation = useNavigation();
  const route = useRoute();

  const isSmallScreen = ['SMALL', 'NORMAL'].includes(size);
  const shouldShowTab = useMemo(
    () => tabs.map((tab) => tab.name).includes(name) || !isSmallScreen,
    [name, isSmallScreen, tabs],
  );

  return (
    <Box
      flexDirection={isSmallScreen ? 'column' : 'row-reverse'}
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
