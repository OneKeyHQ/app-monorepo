import { StackBasicRoutes } from '../../../../routes';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type OnekeyLiteDetailScreenValues = {
  liteId: string;
};

export type OnekeyLiteDetailRoutesParams = {
  [StackBasicRoutes.ScreenOnekeyLiteDetail]: {
    defaultValues: OnekeyLiteDetailScreenValues;
  };
};

export type OnekeyLiteDetailNavigation = NativeStackNavigationProp<
  OnekeyLiteDetailRoutesParams,
  StackBasicRoutes
>;
