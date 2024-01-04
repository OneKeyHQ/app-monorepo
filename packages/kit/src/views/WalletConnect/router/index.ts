import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import SessionProposalModal from '../container/SessionProposalModal';

import type { Web3WalletTypes } from '@walletconnect/web3wallet';

export enum EWalletConnectPages {
  'SessionProposalModal' = 'SessionProposalModal',
}

export type IWalletConnectPagesParam = {
  [EWalletConnectPages.SessionProposalModal]: {
    proposal: Web3WalletTypes.SessionProposal;
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
];
