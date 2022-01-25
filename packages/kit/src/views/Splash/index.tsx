import React, { useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';

import { OthersRoutes } from '../../routes/Others';
import { TabRoutes, TabRoutesParams } from '../../routes/Stack';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  TabRoutesParams & { [OthersRoutes.Unlock]: undefined },
  TabRoutes.Home
>;

const Splash = () => {
  // this is loading component
  const navigation = useNavigation<NavigationProps>();
  useEffect(() => {
    // TODO: Get the app's status and determine which page to jump to.
    navigation.navigate(OthersRoutes.Unlock);
  }, [navigation]);
  return <></>;
};

export default Splash;
