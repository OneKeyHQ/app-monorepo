import React, { FC } from 'react';

import { Box } from '@onekeyhq/components';

import WebView from '../../../components/WebView';
import {
  StackBasicRoutes,
  StackBasicRoutesParams,
} from '../../../routes/Stack';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type NavigationProps = NativeStackScreenProps<
  StackBasicRoutesParams,
  StackBasicRoutes.SettingsWebviewScreen
>;

export const SettingsWebViews: FC<NavigationProps> = ({ route }) => {
  const params = route?.params;
  console.log('params', params);
  return (
    <Box flex="1">
      <WebView src="https://www.baidu.com" />
    </Box>
  );
};

export default SettingsWebViews;
