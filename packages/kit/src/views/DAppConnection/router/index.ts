import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';

import ConnectionList from '../pages/ConnectionList';
import ConnectionModal from '../pages/ConnectionModal';
import SignMessageModal from '../pages/SignMessageModal';
import WalletConnectSessionProposalModal from '../pages/WalletConnect/WCSessionProposalModal';

import { EDAppConnectionModal } from './type';

import type { Web3WalletTypes } from '@walletconnect/web3wallet';

export type IDAppConnectionModalParamList = {
  [EDAppConnectionModal.ConnectionModal]: undefined;
  [EDAppConnectionModal.ConnectionList]: undefined;
  [EDAppConnectionModal.WalletConnectSessionProposalModal]: {
    proposal: Web3WalletTypes.SessionProposal;
  };
  [EDAppConnectionModal.SignMessageModal]: {
    unsignedMessage: IUnsignedMessage;
    accountId: string;
    networkId: string;
  };
};

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
