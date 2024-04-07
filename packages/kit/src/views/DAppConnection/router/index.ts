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

export const DAppConnectionRouter: IModalFlowNavigatorConfig<
  EDAppConnectionModal,
  IDAppConnectionModalParamList
>[] = [
  {
    name: EDAppConnectionModal.ConnectionModal,
    component: ConnectionModal,
  },
  {
    name: EDAppConnectionModal.ConnectionList,
    component: ConnectionList,
  },
  {
    name: EDAppConnectionModal.WalletConnectSessionProposalModal,
    component: WalletConnectSessionProposalModal,
  },
  {
    name: EDAppConnectionModal.SignMessageModal,
    component: SignMessageModal,
  },
  {
    name: EDAppConnectionModal.CurrentConnectionModal,
    component: CurrentConnectionModal,
  },
  {
    name: EDAppConnectionModal.DefaultWalletSettingsModal,
    component: DefaultWalletSettingsModal,
  },
];
