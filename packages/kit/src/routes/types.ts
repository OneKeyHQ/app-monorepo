/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-namespace */
import { PriceAlertItem } from '@onekeyhq/engine/src/managers/notification';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Collection } from '@onekeyhq/engine/src/types/nft';
import type { MatchDAppItemType } from '@onekeyhq/kit/src/views/Discover/Explorer/explorerUtils';
import type { DAppItemType } from '@onekeyhq/kit/src/views/Discover/type';

import { IOnboardingRoutesParams } from '../views/Onboarding/routes/types';

import * as SubModalRoutesParams from './Modal/types';
// define enum here to avoid cycle import
import { HomeRoutes, ModalRoutes, RootRoutes, TabRoutes } from './routesEnum';

import type { StackBasicRoutesParams } from './Dev';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
  ParamListBase,
} from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';

export { ModalRoutes, RootRoutes, HomeRoutes, TabRoutes };

export type ModalRoutesParams = {
  [ModalRoutes.CreateAccount]: NavigatorScreenParams<SubModalRoutesParams.CreateAccountRoutesParams>;
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
  [ModalRoutes.DappConnectionModal]: NavigatorScreenParams<SubModalRoutesParams.DappConnectionRoutesParams>;
  [ModalRoutes.Password]: NavigatorScreenParams<SubModalRoutesParams.PasswordRoutesParams>;
  [ModalRoutes.ManageToken]: NavigatorScreenParams<SubModalRoutesParams.ManageTokenRoutesParams>;
  [ModalRoutes.Collectibles]: NavigatorScreenParams<SubModalRoutesParams.CollectiblesRoutesParams>;
  [ModalRoutes.EnableLocalAuthentication]: NavigatorScreenParams<SubModalRoutesParams.EnableLocalAuthenticationRoutesParams>;
  [ModalRoutes.ManageNetwork]: NavigatorScreenParams<SubModalRoutesParams.ManageNetworkRoutesParams>;
  [ModalRoutes.OnekeyHardware]: NavigatorScreenParams<SubModalRoutesParams.OnekeyHardwareRoutesParams>;
  [ModalRoutes.HardwareUpdate]: NavigatorScreenParams<SubModalRoutesParams.HardwareUpdateRoutesParams>;
  [ModalRoutes.Discover]: NavigatorScreenParams<SubModalRoutesParams.DiscoverRoutesParams>;
  [ModalRoutes.Swap]: NavigatorScreenParams<SubModalRoutesParams.SwapRoutesParams>;
  [ModalRoutes.UpdateFeature]: NavigatorScreenParams<SubModalRoutesParams.UpdateFeatureRoutesParams>;
  [ModalRoutes.ScanQrcode]: NavigatorScreenParams<SubModalRoutesParams.ScanQrcodeRoutesParams>;
  [ModalRoutes.FiatPay]: NavigatorScreenParams<SubModalRoutesParams.FiatPayModalRoutesParams>;
  [ModalRoutes.AddressBook]: NavigatorScreenParams<SubModalRoutesParams.AddressBookRoutesParams>;
  [ModalRoutes.ImportBackupPassword]: NavigatorScreenParams<SubModalRoutesParams.ImportBackupPasswordRoutesParams>;
  [ModalRoutes.Staking]: NavigatorScreenParams<SubModalRoutesParams.StakingRoutesParams>;
  [ModalRoutes.ManageConnectedSites]: NavigatorScreenParams<SubModalRoutesParams.ManageConnectedSitesRoutesParams>;
  [ModalRoutes.PushNotification]: NavigatorScreenParams<SubModalRoutesParams.PushNotificationRoutesParams>;
  [ModalRoutes.Webview]: NavigatorScreenParams<SubModalRoutesParams.WebviewRoutesParams>;
  [ModalRoutes.Revoke]: NavigatorScreenParams<SubModalRoutesParams.RevokeRoutesParams>;
  [ModalRoutes.SearchNFT]: NavigatorScreenParams<SubModalRoutesParams.SearchNFTCollectionRoutesParams>;
};
/** Modal */

/** Tab */

export type TabRoutesParams = {
  [TabRoutes.Home]: undefined;
  [TabRoutes.Swap]:
    | undefined
    | { inputTokenId?: string; outputTokenId?: string };
  [TabRoutes.Developer]: undefined;
  [TabRoutes.Discover]: undefined;
  [TabRoutes.Me]: undefined;
  [TabRoutes.Send]: undefined;
  [TabRoutes.Receive]: undefined;
  [TabRoutes.Market]: undefined;
  [TabRoutes.NFT]: undefined;
};
/** Tab */

export type HomeRoutesParams = {
  [HomeRoutes.InitialTab]: undefined;
  [HomeRoutes.Dev]: NavigatorScreenParams<StackBasicRoutesParams>;
  [HomeRoutes.HomeOnboarding]: undefined;
  [HomeRoutes.ScreenTokenDetail]: {
    accountId: string;
    networkId: string;
    tokenId: string; // tokenIdOnNetwork
    historyFilter?: (item: any) => boolean;
  };
  [HomeRoutes.FullTokenListScreen]: {
    accountId?: string;
    networkId?: string;
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
    onItemSelect?: (item: DAppItemType) => void;
  };
  [HomeRoutes.MyDAppListScreen]: {
    defaultIndex?: number;
    onItemSelect?: (item: MatchDAppItemType) => void;
  };
  [HomeRoutes.TransactionHistoryScreen]: {
    tokenId?: string;
    historyFilter?: (item: any) => boolean;
  };
  [HomeRoutes.Protected]: undefined;
  [HomeRoutes.AddressBook]: undefined;
  [HomeRoutes.SwapHistory]: undefined;
  [HomeRoutes.VolumeHaptic]: undefined;
  [HomeRoutes.CloudBackup]: undefined;
  [HomeRoutes.CloudBackupPreviousBackups]: undefined;
  [HomeRoutes.CloudBackupDetails]: {
    backupUUID: string;
    backupTime: number;
    numOfHDWallets: number;
    numOfImportedAccounts: number;
    numOfWatchingAccounts: number;
    numOfContacts: number;
  };
  [HomeRoutes.PushNotification]: undefined;
  [HomeRoutes.PushNotificationManagePriceAlert]: {
    alerts: PriceAlertItem[];
  };
  [HomeRoutes.PushNotificationManageAccountDynamic]: undefined;
  [HomeRoutes.MarketDetail]: {
    marketTokenId: string;
  };
  [HomeRoutes.Revoke]: undefined;
  [HomeRoutes.NFTMarketStatsList]: { network: Network; selectedIndex?: number };
  [HomeRoutes.NFTMarketLiveMintingList]: { network: Network };
  [HomeRoutes.NFTMarketCollectionScreen]: {
    networkId: string;
    contractAddress: string;
    collection?: Collection;
    title?: string;
  };
  [HomeRoutes.RevokeRedirect]: undefined;
};
/** HomeStack */

/** Root */

export type RootRoutesParams = {
  [RootRoutes.Root]: NavigatorScreenParams<HomeRoutesParams> | undefined;
  [RootRoutes.Modal]: NavigatorScreenParams<ModalRoutesParams>;
  [RootRoutes.Tab]: NavigatorScreenParams<TabRoutesParams>;
  // TODO remove, use HomeRoutes.HomeOnboarding instead
  [RootRoutes.Onboarding]:
    | NavigatorScreenParams<IOnboardingRoutesParams>
    | undefined;
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
