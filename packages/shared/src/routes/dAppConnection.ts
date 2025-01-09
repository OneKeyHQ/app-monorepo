import type { INostrEvent } from '@onekeyhq/core/src/chains/nostr/types';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import type { IAddEthereumChainParameter } from '@onekeyhq/kit-bg/src/providers/ProviderApiEthereum';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

import type { EAccountSelectorSceneName } from '../../types';
import type {
  IRequestInvoiceArgs,
  IVerifyMessageArgs,
} from '../../types/lightning/webln';
import type {
  IAccountToken,
  IAddCustomTokenRouteParams,
} from '../../types/token';
import type { Web3WalletTypes } from '@walletconnect/web3wallet';

export enum EDAppConnectionModal {
  'ConnectionModal' = 'ConnectionModal',
  'ConnectionList' = 'ConnectionList',
  'WalletConnectSessionProposalModal' = 'WalletConnectSessionProposalModal',
  'SignMessageModal' = 'SignMessageModal',
  'AddCustomNetworkModal' = 'AddCustomNetworkModal',
  'AddCustomTokenModal' = 'AddCustomTokenModal',
  'CurrentConnectionModal' = 'CurrentConnectionModal',
  'DefaultWalletSettingsModal' = 'DefaultWalletSettingsModal',

  // WebLN
  MakeInvoice = 'MakeInvoice',
  VerifyMessage = 'VerifyMessage',
  // Nostr
  NostrSignEventModal = 'NostrSignEventModal',
}

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
    sceneName?: EAccountSelectorSceneName;
  };
  [EDAppConnectionModal.AddCustomNetworkModal]: {
    networkInfo: IAddEthereumChainParameter;
  };
  [EDAppConnectionModal.AddCustomTokenModal]: IAddCustomTokenRouteParams;
  [EDAppConnectionModal.CurrentConnectionModal]: {
    origin: string;
    faviconUrl: string;
  };
  [EDAppConnectionModal.DefaultWalletSettingsModal]: undefined;
  // WebLN
  [EDAppConnectionModal.MakeInvoice]: IRequestInvoiceArgs & {
    accountId: string;
    networkId: string;
  };
  [EDAppConnectionModal.VerifyMessage]: IVerifyMessageArgs;
  // Nostr
  [EDAppConnectionModal.NostrSignEventModal]: {
    event?: INostrEvent;
    pubkey?: string;
    plaintext?: string;
    ciphertext?: string;
    sigHash?: string;
    walletId: string;
    accountId: string;
    networkId: string;
  };
};
