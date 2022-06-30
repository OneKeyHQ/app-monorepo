import type { Route } from 'react-native-tab-view';

export type ScrollRoute = Route & {
  index: number;
};
export enum WalletHomeTabEnum {
  Tokens = 'Tokens',
  Collectibles = 'Collectibles',
  History = 'History',
}
