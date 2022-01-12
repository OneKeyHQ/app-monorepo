// eslint-disable-next-line import/no-cycle
import { StackBasicRoutes } from '../../routes';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type TokenDetailScreenValues = {
  accountId: string;
  networkId: string;
  tokenId: string;
};

export type TokenDetailRoutesParams = {
  [StackBasicRoutes.ScreenTokenDetail]: {
    defaultValues: TokenDetailScreenValues;
  };
};

export type TokenDetailNavigation = NativeStackNavigationProp<
  TokenDetailRoutesParams,
  StackBasicRoutes
>;
