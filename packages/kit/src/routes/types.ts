/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-namespace */
import type { DAppItemType } from '@onekeyhq/kit/src/views/Discover/type';

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
  [ModalRoutes.DappMulticallModal]: NavigatorScreenParams<SubModalRoutesParams.DappMulticallRoutesParams>;
  [ModalRoutes.DappConnectionModal]: NavigatorScreenParams<SubModalRoutesParams.DappConnectionRoutesParams>;
  [ModalRoutes.Password]: NavigatorScreenParams<SubModalRoutesParams.PasswordRoutesParams>;
  [ModalRoutes.ManageToken]: NavigatorScreenParams<SubModalRoutesParams.ManageTokenRoutesParams>;
  [ModalRoutes.Collectibles]: NavigatorScreenParams<SubModalRoutesParams.CollectiblesRoutesParams>;
  [ModalRoutes.EnableLocalAuthentication]: NavigatorScreenParams<SubModalRoutesParams.EnableLocalAuthenticationRoutesParams>;
  [ModalRoutes.ManageNetwork]: NavigatorScreenParams<SubModalRoutesParams.ManageNetworkRoutesParams>;
  [ModalRoutes.OnekeyHardware]: NavigatorScreenParams<SubModalRoutesParams.OnekeyHardwareRoutesParams>;
  [ModalRoutes.Discover]: NavigatorScreenParams<SubModalRoutesParams.DiscoverRoutesParams>;
  [ModalRoutes.Swap]: NavigatorScreenParams<SubModalRoutesParams.SwapRoutesParams>;
  [ModalRoutes.UpdateFeature]: NavigatorScreenParams<SubModalRoutesParams.UpdateFeatureRoutesParams>;
  [ModalRoutes.ScanQrcode]: NavigatorScreenParams<SubModalRoutesParams.ScanQrcodeRoutesParams>;
  [ModalRoutes.FiatPay]: NavigatorScreenParams<SubModalRoutesParams.FiatPayModalRoutesParams>;
};
/** Modal */

/** Tab */
export enum TabRoutes {
  // Overview = 'overview',
  Home = 'home',
  Swap = 'swap',
  Portfolio = 'portfolio',
  Discover = 'discover',
  Me = 'me',
}

export type TabRoutesParams = {
  // [TabRoutes.Overview]: undefined;
  [TabRoutes.Home]: undefined;
  [TabRoutes.Swap]:
    | undefined
    | { inputTokenId?: string; outputTokenId?: string };
  [TabRoutes.Portfolio]: undefined;
  [TabRoutes.Discover]: undefined;
  [TabRoutes.Me]: undefined;
};
/** Tab */

/** HomeStack */
export enum HomeRoutes {
  // InitialTab = 'overview',
  InitialTab = 'home',
  Dev = 'dev',
  ScreenTokenDetail = 'TokenDetailScreen',
  DebugScreen = 'Debug',
  SettingsWebviewScreen = 'SettingsWebviewScreen',
  ScreenOnekeyLiteDetail = 'OnekeyLiteDetailScreen',
  ExploreScreen = 'ExploreScreen',
  DAppListScreen = 'DAppListScreen',
  TransactionHistoryScreen = 'TransactionHistoryScreen',
  FaceId = 'FaceId',
}

export type HomeRoutesParams = {
  [HomeRoutes.InitialTab]: undefined;
  [HomeRoutes.Dev]: NavigatorScreenParams<StackBasicRoutesParams>;
  [HomeRoutes.ScreenTokenDetail]: {
    accountId: string;
    networkId: string;
    tokenId: string;
  };
  [HomeRoutes.DebugScreen]: undefined;
  [HomeRoutes.SettingsWebviewScreen]: { url: string; title?: string };
  [HomeRoutes.ScreenOnekeyLiteDetail]: undefined;
  [HomeRoutes.ExploreScreen]: {
    onItemSelect?: (item: DAppItemType) => Promise<boolean>;
  };
  [HomeRoutes.DAppListScreen]: {
    title: string;
    data: DAppItemType[];
    onItemSelect?: (item: DAppItemType) => Promise<boolean> | void | undefined;
  };
  [HomeRoutes.TransactionHistoryScreen]: {
    tokenId?: string;
    isInternalSwapOnly?: boolean;
  };
  [HomeRoutes.FaceId]: undefined;
};
/** HomeStack */

/** Root */

export { RootRoutes };

/** Root */

export type RootRoutesParams = {
  [RootRoutes.Root]: NavigatorScreenParams<HomeRoutesParams> | undefined;
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
