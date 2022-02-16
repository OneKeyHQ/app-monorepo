/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-namespace */
import * as SubModalRoutesParams from './Modal/types';

import type { StackBasicRoutesParams } from './Dev';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
  ParamListBase,
} from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';

/** Modal */
export enum ModalRoutes {
  CreateAccount = 'CreateAccount',
  ImportAccount = 'ImportAccount',
  WatchedAccount = 'WatchAccount',
  Send = 'Send',
  Receive = 'Receive',
  TransactionDetail = 'TransactionDetail',
}

export type ModalRoutesParams = {
  [ModalRoutes.CreateAccount]: NavigatorScreenParams<SubModalRoutesParams.CreateAccountRoutesParams>;
  [ModalRoutes.ImportAccount]: NavigatorScreenParams<SubModalRoutesParams.ImportAccountRoutesParams>;
  [ModalRoutes.WatchedAccount]: NavigatorScreenParams<SubModalRoutesParams.WatchedAccountRoutesParams>;
  [ModalRoutes.Receive]: NavigatorScreenParams<SubModalRoutesParams.ReceiveTokenRoutesParams>;
  [ModalRoutes.TransactionDetail]: NavigatorScreenParams<SubModalRoutesParams.TransactionDetailRoutesParams>;
  [ModalRoutes.Send]: undefined;
};
/** Modal */

/** Tab */
export enum TabRoutes {
  Home = 'home',
  Swap = 'swap',
  Portfolio = 'portfolio',
  Discover = 'discover',
  Me = 'me',
}

export type TabRoutesParams = {
  [TabRoutes.Home]: undefined;
  [TabRoutes.Swap]: undefined;
  [TabRoutes.Portfolio]: undefined;
  [TabRoutes.Discover]: undefined;
  [TabRoutes.Me]: undefined;
};
/** Tab */

/** HomeStack */
export enum HomeRoutes {
  InitialTab = 'InitialTab',
  Dev = 'Dev',
  ScreenTokenDetail = 'TokenDetailScreen',
  SettingsScreen = 'Settings',
  UnlockScreen = 'Unlock',
  SettingsWebviewScreen = 'SettingsWebviewScreen',
  ScreenOnekeyLiteDetail = 'OnekeyLiteDetailScreen',
}

export type HomeRoutesParams = {
  [HomeRoutes.InitialTab]: undefined;
  [HomeRoutes.Dev]: NavigatorScreenParams<StackBasicRoutesParams>;
  [HomeRoutes.ScreenTokenDetail]: undefined;
  [HomeRoutes.SettingsScreen]: undefined;
  [HomeRoutes.UnlockScreen]: undefined;
  [HomeRoutes.SettingsWebviewScreen]: { url: string; title?: string };
  [HomeRoutes.ScreenOnekeyLiteDetail]: undefined;
};
/** HomeStack */

/** Root */
export enum RootRoutes {
  Root = 'Root',
  Modal = 'Modal',
  Tab = 'Tab',
}

/** Root */

export type RootRoutesParams = {
  [RootRoutes.Root]: undefined;
  [RootRoutes.Modal]: NavigatorScreenParams<ModalRoutesParams>;
  [RootRoutes.Tab]: NavigatorScreenParams<TabRoutesParams>;
};

export type RootScreenProps<T extends keyof RootRoutesParams> =
  StackScreenProps<RootRoutesParams, T>;

export type HomeScreenProps<T extends keyof TabRoutesParams> =
  CompositeScreenProps<
    BottomTabScreenProps<TabRoutesParams, T>,
    RootScreenProps<keyof RootRoutesParams>
  >;

export type ModalScreenProps<ParamList extends ParamListBase> =
  CompositeScreenProps<
    StackScreenProps<RootRoutesParams>,
    CompositeScreenProps<
      StackScreenProps<ModalRoutesParams>,
      StackScreenProps<ParamList, any>
    >
  >;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootRoutesParams {}
  }
}
