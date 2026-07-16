import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IDAppConnectionModalParamList } from '@onekeyhq/shared/src/routes';
import { EDAppConnectionModal } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const ConnectionList = LazyLoadPage(() => import('../pages/ConnectionList'));

const ConnectionModal = LazyLoadPage(() => import('../pages/ConnectionModal'));

const SignMessageModal = LazyLoadPage(
  () => import('../pages/SignMessageModal'),
);

const WalletConnectSessionProposalModal = LazyLoadPage(
  () => import('../pages/WalletConnect/WCSessionProposalModal'),
);

// For Extension Only
const CurrentConnectionModal = LazyLoadPage(
  () => import('../pages/CurrentConnectionModal'),
);

const DefaultWalletSettingsModal = LazyLoadPage(
  () => import('../pages/DefaultWalletSettingsModal'),
);

// For Lightning WebLN
const MakeInvoiceModal = LazyLoadPage(
  () => import('../../LightningNetwork/pages/Webln/WeblnMakeInvoiceModal'),
);

const NostrSignEventModal = LazyLoadPage(
  () => import('../pages/NostrSignEventModal'),
);

const CosmosEnigmaUnlockModal = LazyLoadPage(
  () => import('../pages/CosmosEnigmaUnlockModal'),
);

const RiskWhiteListModal = LazyLoadPage(
  () => import('../pages/RiskWhiteListModal'),
);

const ClipboardPermissionModal = LazyLoadPage(
  () => import('../pages/ClipboardPermissionModal'),
);

const DeriveContextHashModal = LazyLoadPage(
  () => import('../pages/DeriveContextHashModal'),
);

// Custom Network
const SettingCustomNetworkModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Setting/pages/CustomNetwork'),
);

// Custom Token
const AddCustomTokenModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/AssetList/pages/AddCustomTokenModal'),
);

export const DAppConnectionRouter: IModalFlowNavigatorConfig<
  EDAppConnectionModal,
  IDAppConnectionModalParamList
>[] = [
  // Extension standalone windows cold-start from a hash URL built by
  // ServiceDApp.openModal. Keep every screen in this stack available to the
  // Extension compiler target without exposing these internal routes on Web.
  {
    name: EDAppConnectionModal.ConnectionModal,
    component: ConnectionModal,
    allowColdStart: platformEnv.isExtension,
    dismissOnOverlayPress: false,
  },
  {
    name: EDAppConnectionModal.ConnectionList,
    component: ConnectionList,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EDAppConnectionModal.WalletConnectSessionProposalModal,
    component: WalletConnectSessionProposalModal,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EDAppConnectionModal.SignMessageModal,
    component: SignMessageModal,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EDAppConnectionModal.AddCustomNetworkModal,
    component: SettingCustomNetworkModal,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EDAppConnectionModal.AddCustomTokenModal,
    component: AddCustomTokenModal,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EDAppConnectionModal.CurrentConnectionModal,
    component: CurrentConnectionModal,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EDAppConnectionModal.DefaultWalletSettingsModal,
    component: DefaultWalletSettingsModal,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EDAppConnectionModal.MakeInvoice,
    component: MakeInvoiceModal,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EDAppConnectionModal.NostrSignEventModal,
    component: NostrSignEventModal,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EDAppConnectionModal.CosmosEnigmaUnlockModal,
    component: CosmosEnigmaUnlockModal,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EDAppConnectionModal.RiskWhiteListModal,
    component: RiskWhiteListModal,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EDAppConnectionModal.ClipboardPermissionModal,
    component: ClipboardPermissionModal,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EDAppConnectionModal.DeriveContextHashModal,
    component: DeriveContextHashModal,
    allowColdStart: platformEnv.isExtension,
  },
];
