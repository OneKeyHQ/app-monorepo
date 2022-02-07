import React, { useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';

import { useStatus } from '../../hooks/redux';
import { OthersRoutes } from '../../routes/Others/enum';
import { TabRoutes, TabRoutesParams } from '../../routes/Stack';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  TabRoutesParams & {
    [OthersRoutes.Unlock]: undefined;
    [OthersRoutes.Welcome]: undefined;
  },
  TabRoutes.Home
>;

const Splash = () => {
  // this is loading component
  const navigation = useNavigation<NavigationProps>();
  const { welcomed } = useStatus();
  useEffect(() => {
    // TODO: Get the app's status and determine which page to jump to.
    if (welcomed) {
      navigation.navigate(OthersRoutes.Unlock);
    } else {
      navigation.navigate(OthersRoutes.Welcome);
    }
  }, [navigation, welcomed]);
  return <></>;
};

export default Splash;
