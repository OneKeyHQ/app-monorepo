import React, { FC, useLayoutEffect } from 'react';

import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/core';

import { Box } from '@onekeyhq/components';
import { StackRoutes, StackRoutesParams } from '@onekeyhq/kit/src/routes/Stack';

import WebView from '../../components/WebView';
import { StackBasicRoutes, StackBasicRoutesParams } from '../../routes/Stack';

type StackRoutesType = typeof StackRoutes;

type NavigationProps = NavigationProp<
  StackBasicRoutesParams,
  StackBasicRoutes.WebviewScreen
>;

type RouteProps = RouteProp<
  StackRoutesParams,
  StackRoutesType['WebviewScreen']
>;

export const SettingsWebViews: FC = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps>();
  const { url, title } = route?.params;
  useLayoutEffect(() => {
    if (title) {
      navigation.setOptions({ title });
    }
  }, [navigation, title]);
  return (
    <Box flex="1">
      <WebView src={url} />
    </Box>
  );
};

export default SettingsWebViews;
