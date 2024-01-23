import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';

import ConnectionList from '../pages/ConnectionList';
import SessionProposalModal from '../pages/SessionProposalModal';
import SignMessageModal from '../pages/SignMessageModal';

import type { Web3WalletTypes } from '@walletconnect/web3wallet';

export enum EWalletConnectPages {
  'SessionProposalModal' = 'SessionProposalModal',
  'ConnectionList' = 'ConnectionList',
  'SignMessageModal' = 'SignMessageModal',
}

export type IWalletConnectPagesParam = {
  [EWalletConnectPages.SessionProposalModal]: {
    proposal: Web3WalletTypes.SessionProposal;
  };
  [EWalletConnectPages.ConnectionList]: undefined;
  [EWalletConnectPages.SignMessageModal]: {
    unsignedMessage: IUnsignedMessage;
    accountId: string;
    networkId: string;
  };
};

export const WalletConnectRouter: IModalFlowNavigatorConfig<
  EWalletConnectPages,
  IWalletConnectPagesParam
>[] = [
  {
    name: EWalletConnectPages.SessionProposalModal,
    component: SessionProposalModal,
  },
  {
    name: EWalletConnectPages.ConnectionList,
    component: ConnectionList,
  },
  {
    name: EWalletConnectPages.SignMessageModal,
    component: SignMessageModal,
  },
];
