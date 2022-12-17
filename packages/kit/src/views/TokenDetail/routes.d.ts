import type { HomeRoutes } from '../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type TokenDetailScreenValues = {
  accountId: string;
  networkId: string;
  tokenId: string;
};

export type TokenDetailRoutesParams = {
  [HomeRoutes.ScreenTokenDetail]: TokenDetailScreenValues;
};

export type TokenDetailNavigation = NativeStackNavigationProp<
  TokenDetailRoutesParams,
  HomeRoutes.ScreenTokenDetail
>;
