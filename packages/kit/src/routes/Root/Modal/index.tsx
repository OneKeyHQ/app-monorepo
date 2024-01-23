/* eslint-disable @typescript-eslint/no-unused-vars */
import { memo, useMemo } from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import { createLazyComponent } from '../../../utils/createLazyComponent';
import { ModalRoutes } from '../../routesEnum';

import { buildModalOpenAnimationOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';
import ManagerWalletModal from './ManagerWallet';

import type { ModalRoutesParams } from '../../types';

const BackupWalletModal = createLazyComponent(() => import('./BackupWallet'));

const CollectibleModal = createLazyComponent(() => import('./Collectibles'));
const CreateAccountModal = createLazyComponent(() => import('./CreateAccount'));
const RecoverAccountModal = createLazyComponent(
  () => import('./RecoverAccount'),
);
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
// const ManagerWalletModal = createLazyComponent(() => import('./ManagerWallet'));
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
const WebviewModal = createLazyComponent(
  () => import('../../../views/Webview'),
);

const AddressBookModal = createLazyComponent(() => import('./AddressBook'));

const OverviewModal = createLazyComponent(() => import('./Overview'));
const Market = createLazyComponent(() => import('./Market'));

const CurrencySelectModal = createLazyComponent(
  () => import('./CurrencySelect'),
);
const CoinControlModal = createLazyComponent(() => import('./CoinControl'));

const ClearCacheModal = createLazyComponent(() => import('./ClearCache'));

const GasPanelModal = createLazyComponent(() => import('./GasPanel'));

const InscribeModal = createLazyComponent(() => import('./Inscribe'));

const WeblnModal = createLazyComponent(() => import('./Webln'));

const NostrModal = createLazyComponent(() => import('./Nostr'));

const MonitorModal = createLazyComponent(() => import('./Monitor'));

const InscriptionControlModal = createLazyComponent(
  () => import('./InscriptionControl'),
);

const modalStackScreenList = [
  {
    name: ModalRoutes.CreateAccount,
    component: CreateAccountModal,
  },
  {
    name: ModalRoutes.RecoverAccount,
    component: RecoverAccountModal,
  },
  {
    name: ModalRoutes.Receive,
    component: ReceiveToken,
  },
  {
    name: ModalRoutes.Monitor,
    component: MonitorModal,
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
  { name: ModalRoutes.CurrencySelect, component: CurrencySelectModal },
  {
    name: ModalRoutes.BulkSender,
    component: BulkSender,
  },
  { name: ModalRoutes.Market, component: Market },
  { name: ModalRoutes.ClearCache, component: ClearCacheModal },
  { name: ModalRoutes.CoinControl, component: CoinControlModal },
  { name: ModalRoutes.GasPanel, component: GasPanelModal },
  { name: ModalRoutes.Inscribe, component: InscribeModal },
  { name: ModalRoutes.Webln, component: WeblnModal },
  { name: ModalRoutes.Nostr, component: NostrModal },
  { name: ModalRoutes.InscriptionControl, component: InscriptionControlModal },
];

const ModalStack = createStackNavigator<ModalRoutesParams>();

const ModalStackNavigator = () => {
  const isVerticalLayout = useIsVerticalLayout();
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      presentation: 'modal' as const,
      ...buildModalOpenAnimationOptions({ isVerticalLayout }),
    }),
    [isVerticalLayout],
  );
  return (
    <ModalStack.Navigator screenOptions={screenOptions}>
      {modalStackScreenList.map((modal) => (
        <ModalStack.Screen
          key={modal.name}
          name={modal.name}
          component={modal.component}
        />
      ))}
    </ModalStack.Navigator>
  );
};

export default memo(ModalStackNavigator);
