import React, { FC, useLayoutEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';

import { Box } from '@onekeyhq/components';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';

import WebView from '../../components/WebView';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.SettingsWebviewScreen>;

export const SettingsWebViews: FC = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
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
