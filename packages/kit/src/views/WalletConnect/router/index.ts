import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import ConnectionList from '../pages/ConnectionList';
import SessionProposalModal from '../pages/SessionProposalModal';

import type { Web3WalletTypes } from '@walletconnect/web3wallet';

export enum EWalletConnectPages {
  'SessionProposalModal' = 'SessionProposalModal',
  'ConnectionList' = 'ConnectionList',
}

export type IWalletConnectPagesParam = {
  [EWalletConnectPages.SessionProposalModal]: {
    proposal: Web3WalletTypes.SessionProposal;
  };
  [EWalletConnectPages.ConnectionList]: undefined;
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
];
