/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-namespace */
import * as SubModalRoutesParams from './Modal/types';
import { ModalRoutes, RootRoutes } from './routesEnum';

import type { StackBasicRoutesParams } from './Dev';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
  ParamListBase,
} from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';

export { ModalRoutes };

export type ModalRoutesParams = {
  [ModalRoutes.CreateAccount]: NavigatorScreenParams<SubModalRoutesParams.CreateAccountRoutesParams>;
  [ModalRoutes.ImportAccount]: NavigatorScreenParams<SubModalRoutesParams.ImportAccountRoutesParams>;
  [ModalRoutes.WatchedAccount]: NavigatorScreenParams<SubModalRoutesParams.WatchedAccountRoutesParams>;
  [ModalRoutes.CreateWallet]: NavigatorScreenParams<SubModalRoutesParams.CreateWalletRoutesParams>;
  [ModalRoutes.BackupWallet]: NavigatorScreenParams<SubModalRoutesParams.BackupWalletRoutesParams>;
  [ModalRoutes.ManagerWallet]: NavigatorScreenParams<SubModalRoutesParams.ManagerWalletRoutesParams>;
  [ModalRoutes.ManagerAccount]: NavigatorScreenParams<SubModalRoutesParams.ManagerAccountRoutesParams>;
  [ModalRoutes.WalletViewMnemonics]: NavigatorScreenParams<SubModalRoutesParams.BackupWalletRoutesParams>;
  [ModalRoutes.Receive]: NavigatorScreenParams<SubModalRoutesParams.ReceiveTokenRoutesParams>;
  [ModalRoutes.TransactionDetail]: NavigatorScreenParams<SubModalRoutesParams.TransactionDetailRoutesParams>;
  [ModalRoutes.SubmitRequest]: NavigatorScreenParams<SubModalRoutesParams.SubmitRequestModalRoutesParams>;
  [ModalRoutes.HistoryRequest]: NavigatorScreenParams<SubModalRoutesParams.HistoryRequestModalRoutesParams>;
  [ModalRoutes.Send]: NavigatorScreenParams<SubModalRoutesParams.SendRoutesParams>;
  [ModalRoutes.OnekeyLiteReset]: NavigatorScreenParams<SubModalRoutesParams.OnekeyLiteResetRoutesParams>;
  [ModalRoutes.OnekeyLiteChangePinInputPin]: NavigatorScreenParams<SubModalRoutesParams.OnekeyLiteChangePinRoutesParams>;
  [ModalRoutes.DappApproveModal]: NavigatorScreenParams<SubModalRoutesParams.DappApproveRoutesParams>;
  [ModalRoutes.DappSendConfirmModal]: NavigatorScreenParams<SubModalRoutesParams.DappSendRoutesParams>;
  [ModalRoutes.DappMulticallModal]: NavigatorScreenParams<SubModalRoutesParams.DappMulticallRoutesParams>;
  [ModalRoutes.DappSignatureModal]: NavigatorScreenParams<SubModalRoutesParams.DappSignatureRoutesParams>;
  [ModalRoutes.DappConnectionModal]: NavigatorScreenParams<SubModalRoutesParams.DappConnectionRoutesParams>;
  [ModalRoutes.Password]: NavigatorScreenParams<SubModalRoutesParams.PasswordRoutesParams>;
  [ModalRoutes.ManageToken]: NavigatorScreenParams<SubModalRoutesParams.ManageTokenRoutesParams>;
  [ModalRoutes.Collectibles]: NavigatorScreenParams<SubModalRoutesParams.CollectiblesRoutesParams>;
  [ModalRoutes.EnableLocalAuthentication]: NavigatorScreenParams<SubModalRoutesParams.EnableLocalAuthenticationRoutesParams>;
  [ModalRoutes.ManageNetwork]: NavigatorScreenParams<SubModalRoutesParams.ManageNetworkRoutesParams>;
  [ModalRoutes.OnekeyHardware]: NavigatorScreenParams<SubModalRoutesParams.OnekeyHardwareRoutesParams>;
  [ModalRoutes.Discover]: NavigatorScreenParams<SubModalRoutesParams.DiscoverRoutesParams>;
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
  InitialTab = 'home',
  Dev = 'dev',
  ScreenTokenDetail = 'TokenDetailScreen',
  SettingsScreen = 'settings',
  SettingsWebviewScreen = 'SettingsWebviewScreen',
  ScreenOnekeyLiteDetail = 'OnekeyLiteDetailScreen',
  ExploreScreen = 'ExploreScreen',
}

export type HomeRoutesParams = {
  [HomeRoutes.InitialTab]: undefined;
  [HomeRoutes.Dev]: NavigatorScreenParams<StackBasicRoutesParams>;
  [HomeRoutes.ScreenTokenDetail]: {
    accountId: string;
    networkId: string;
    tokenId: string;
  };
  [HomeRoutes.SettingsScreen]: undefined;
  [HomeRoutes.SettingsWebviewScreen]: { url: string; title?: string };
  [HomeRoutes.ScreenOnekeyLiteDetail]: undefined;
  [HomeRoutes.ExploreScreen]: undefined;
};
/** HomeStack */

/** Root */

export { RootRoutes };

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
