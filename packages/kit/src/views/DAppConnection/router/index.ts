import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IDAppConnectionModalParamList } from '@onekeyhq/shared/src/routes';
import { EDAppConnectionModal } from '@onekeyhq/shared/src/routes';

import ConnectionList from '../pages/ConnectionList';
import ConnectionModal from '../pages/ConnectionModal';
import SignMessageModal from '../pages/SignMessageModal';
import WalletConnectSessionProposalModal from '../pages/WalletConnect/WCSessionProposalModal';

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
];
