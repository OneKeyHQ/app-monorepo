import type { HomeRoutes } from '../../routes/routesEnum';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type FullTokenListScreenValues = {
  accountId: string;
  networkId: string;
};

export type FullTokenListRoutesParams = {
  [HomeRoutes.FullTokenListScreen]: FullTokenListScreenValues;
};

export type FullTokenListNavigation = NativeStackNavigationProp<
  FullTokenListRoutesParams,
  HomeRoutes.FullTokenListScreen
>;
