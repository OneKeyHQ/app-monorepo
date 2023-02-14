/* eslint-disable @typescript-eslint/no-unused-vars */
import { memo } from 'react';

import { createStackNavigator } from '@react-navigation/stack';
import { RootSiblingParent } from 'react-native-root-siblings';

import { useIsVerticalLayout } from '@onekeyhq/components';

import { createLazyComponent } from '../../utils/createLazyComponent';
import { ModalRoutes } from '../types';

import { buildModalOpenAnimationOptions } from './buildModalStackNavigatorOptions';

import type { ModalRoutesParams } from '../types';

const BackupWalletModal = createLazyComponent(() => import('./BackupWallet'));

const CollectibleModal = createLazyComponent(() => import('./Collectibles'));
const CreateAccountModal = createLazyComponent(() => import('./CreateAccount'));
const CreateWalletModalStack = createLazyComponent(
  () => import('./CreateWallet'),
);
const DappConnectionStack = createLazyComponent(
  () => import('./DappConnection'),
);
const DiscoverModal = createLazyComponent(() => import('./Discover'));
const EnableLocalAuthenticationModal = createLazyComponent(
  () => import('./EnableLocalAuthentication'),
);
const BuyModal = createLazyComponent(() => import('./FiatPay'));
const OnekeyHardwareModal = createLazyComponent(
  () => import('./HardwareOnekey'),
);
const HardwareOnekeyLitePinModal = createLazyComponent(
  () => import('./HardwareOnekeyLiteChangePin'),
);
const HardwareOnekeyResetModal = createLazyComponent(
  () => import('./HardwareOnekeyLiteReset'),
);
const HardwareUpdateModal = createLazyComponent(
  () => import('./HardwareUpdate'),
);
const HistoryRequestModal = createLazyComponent(
  () => import('./HistoryRequest'),
);
const ImportBackupPassword = createLazyComponent(
  () => import('./ImportBackupPassword'),
);
const ManageConnectedSitesModal = createLazyComponent(
  () => import('./ManageConnectSites'),
);
const ManageNetworkModal = createLazyComponent(() => import('./ManageNetwork'));
const ManagerAccountModal = createLazyComponent(
  () => import('./ManagerAccount'),
);
const ManagerWalletModal = createLazyComponent(() => import('./ManagerWallet'));
const ManageTokenModal = createLazyComponent(() => import('./ManageToken'));
const NFTMarket = createLazyComponent(() => import('./NFTMarket'));
const PasswordModal = createLazyComponent(() => import('./Password'));
const PushNotification = createLazyComponent(
  () => import('./PushNotification'),
);
const ReceiveToken = createLazyComponent(() => import('./ReceiveToken'));
const Revoke = createLazyComponent(() => import('./Revoke'));
const BulkSender = createLazyComponent(() => import('./BulkSender'));
const ScanQrcode = createLazyComponent(() => import('./ScanQrcode'));
const Send = createLazyComponent(() => import('./Send'));
const StakingModal = createLazyComponent(() => import('./Staking'));
const SubmitRequestModal = createLazyComponent(() => import('./SubmitRequest'));
const SwapModal = createLazyComponent(() => import('./Swap'));
const TransactionDetailModal = createLazyComponent(
  () => import('./TransactionDetail'),
);
const UpdateFeatureModal = createLazyComponent(() => import('./UpdateFeature'));
const WebviewModal = createLazyComponent(() => import('./WebView'));

const AddressBookModal = createLazyComponent(() => import('./AddressBook'));
const AnnualReportModal = createLazyComponent(() => import('./AnnualReport'));

const OverviewModal = createLazyComponent(() => import('./Overview'));
const Market = createLazyComponent(() => import('./Market'));

const CurrencySelectModal = createLazyComponent(
  () => import('./CurrencySelect'),
);

export enum ModalNavigatorRoutes {
  ReceiveTokenNavigator = 'ReceiveTokenNavigator',
  SendNavigator = 'SendNavigator',
}

const modalStackScreenList = [
  {
    name: ModalRoutes.CreateAccount,
    component: CreateAccountModal,
  },
  {
    name: ModalRoutes.Receive,
    component: ReceiveToken,
  },
  {
    name: ModalRoutes.Send,
    component: Send,
  },
  {
    name: ModalRoutes.ScanQrcode,
    component: ScanQrcode,
  },
  {
    name: ModalRoutes.BackupWallet,
    component: BackupWalletModal,
  },
  {
    name: ModalRoutes.TransactionDetail,
    component: TransactionDetailModal,
  },
  {
    name: ModalRoutes.ManageToken,
    component: ManageTokenModal,
  },
  {
    name: ModalRoutes.SubmitRequest,
    component: SubmitRequestModal,
  },
  {
    name: ModalRoutes.HistoryRequest,
    component: HistoryRequestModal,
  },
  {
    name: ModalRoutes.Password,
    component: PasswordModal,
  },
  {
    name: ModalRoutes.OnekeyLiteReset,
    component: HardwareOnekeyResetModal,
  },
  {
    name: ModalRoutes.OnekeyLiteChangePinInputPin,
    component: HardwareOnekeyLitePinModal,
  },
  {
    name: ModalRoutes.DappConnectionModal,
    component: DappConnectionStack,
  },
  {
    name: ModalRoutes.Collectibles,
    component: CollectibleModal,
  },
  {
    name: ModalRoutes.CreateWallet,
    component: CreateWalletModalStack,
  },
  {
    name: ModalRoutes.ManagerWallet,
    component: ManagerWalletModal,
  },
  {
    name: ModalRoutes.ManagerAccount,
    component: ManagerAccountModal,
  },
  {
    name: ModalRoutes.EnableLocalAuthentication,
    component: EnableLocalAuthenticationModal,
  },
  {
    name: ModalRoutes.ManageNetwork,
    component: ManageNetworkModal,
  },
  {
    name: ModalRoutes.OnekeyHardware,
    component: OnekeyHardwareModal,
  },
  {
    name: ModalRoutes.HardwareUpdate,
    component: HardwareUpdateModal,
  },
  {
    name: ModalRoutes.Discover,
    component: DiscoverModal,
  },
  {
    name: ModalRoutes.Swap,
    component: SwapModal,
  },
  {
    name: ModalRoutes.UpdateFeature,
    component: UpdateFeatureModal,
  },
  {
    name: ModalRoutes.FiatPay,
    component: BuyModal,
  },
  {
    name: ModalRoutes.AddressBook,
    component: AddressBookModal,
  },
  {
    name: ModalRoutes.ImportBackupPassword,
    component: ImportBackupPassword,
  },
  {
    name: ModalRoutes.Staking,
    component: StakingModal,
  },
  {
    name: ModalRoutes.ManageConnectedSites,
    component: ManageConnectedSitesModal,
  },
  {
    name: ModalRoutes.PushNotification,
    component: PushNotification,
  },
  {
    name: ModalRoutes.Webview,
    component: WebviewModal,
  },
  {
    name: ModalRoutes.Revoke,
    component: Revoke,
  },
  {
    name: ModalRoutes.NFTMarket,
    component: NFTMarket,
  },
  {
    name: ModalRoutes.Overview,
    component: OverviewModal,
  },
  {
    name: ModalRoutes.AnnualReport,
    component: AnnualReportModal,
  },
  { name: ModalRoutes.CurrencySelect, component: CurrencySelectModal },
  {
    name: ModalRoutes.BulkSender,
    component: BulkSender,
  },
  { name: ModalRoutes.Market, component: Market },
];

const ModalStack = createStackNavigator<ModalRoutesParams>();

const ModalStackNavigator = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <RootSiblingParent>
      <ModalStack.Navigator
        screenOptions={{
          headerShown: false,
          ...buildModalOpenAnimationOptions({ isVerticalLayout }),
        }}
      >
        {modalStackScreenList.map((modal) => (
          <ModalStack.Screen
            key={modal.name}
            name={modal.name}
            component={modal.component}
          />
        ))}
      </ModalStack.Navigator>
    </RootSiblingParent>
  );
};

export default memo(ModalStackNavigator);
