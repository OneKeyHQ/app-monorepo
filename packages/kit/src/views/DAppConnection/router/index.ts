import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
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
  // ServiceDApp.openModal. Cold-start route declarations are shared by every
  // platform even when only one platform currently opens a specific entry.
  {
    name: EDAppConnectionModal.ConnectionModal,
    component: ConnectionModal,
    allowColdStart: true,
    dismissOnOverlayPress: false,
  },
  {
    name: EDAppConnectionModal.ConnectionList,
    component: ConnectionList,
    allowColdStart: true,
  },
  {
    name: EDAppConnectionModal.WalletConnectSessionProposalModal,
    component: WalletConnectSessionProposalModal,
    allowColdStart: true,
  },
  {
    name: EDAppConnectionModal.SignMessageModal,
    component: SignMessageModal,
    allowColdStart: true,
  },
  {
    name: EDAppConnectionModal.AddCustomNetworkModal,
    component: SettingCustomNetworkModal,
    allowColdStart: true,
  },
  {
    name: EDAppConnectionModal.AddCustomTokenModal,
    component: AddCustomTokenModal,
    allowColdStart: true,
  },
  {
    name: EDAppConnectionModal.CurrentConnectionModal,
    component: CurrentConnectionModal,
    allowColdStart: true,
  },
  {
    name: EDAppConnectionModal.DefaultWalletSettingsModal,
    component: DefaultWalletSettingsModal,
    allowColdStart: true,
  },
  {
    name: EDAppConnectionModal.MakeInvoice,
    component: MakeInvoiceModal,
    allowColdStart: true,
  },
  {
    name: EDAppConnectionModal.NostrSignEventModal,
    component: NostrSignEventModal,
    allowColdStart: true,
  },
  {
    name: EDAppConnectionModal.CosmosEnigmaUnlockModal,
    component: CosmosEnigmaUnlockModal,
    allowColdStart: true,
  },
  {
    name: EDAppConnectionModal.RiskWhiteListModal,
    component: RiskWhiteListModal,
    allowColdStart: true,
  },
  {
    name: EDAppConnectionModal.ClipboardPermissionModal,
    component: ClipboardPermissionModal,
    allowColdStart: true,
  },
  {
    name: EDAppConnectionModal.DeriveContextHashModal,
    component: DeriveContextHashModal,
    allowColdStart: true,
  },
];
