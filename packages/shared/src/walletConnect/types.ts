import type { IWalletKit } from '@reown/walletkit';
import type { IKeyValueStorage } from '@walletconnect/keyvaluestorage';
import type { pino } from '@walletconnect/logger';
import type SignClient from '@walletconnect/sign-client';
import type {
  ProposalTypes,
  SessionTypes,
  SignClientTypes,
} from '@walletconnect/types';
import type { ConnectParams } from '@walletconnect/universal-provider';
import type UniversalProvider from '@walletconnect/universal-provider';

export type IWalletConnectUniversalProvider = UniversalProvider;
export type IWalletConnectConnectParams = ConnectParams;
export type IWalletConnectNamespaces = SessionTypes.Namespaces;
export type IWalletConnectRequiredNamespaces = ProposalTypes.RequiredNamespaces;
export type IWalletConnectOptionalNamespaces = ProposalTypes.OptionalNamespaces;
export type IWalletConnectNamespace = SessionTypes.Namespace;
export type IWalletConnectSession = SessionTypes.Struct;
export type IWalletConnectPeerMeta = SignClientTypes.Metadata;

export type INamespaceUnion =
  | 'eip155'
  // | 'cosmos'
  // | 'solana'
  // | 'polkadot'
  // | 'tron'
  | 'algorand';

export enum EWalletConnectNamespaceType {
  evm = 'eip155',
  // cosmos = 'cosmos',
  // solana = 'solana',
  // dot = 'polkadot',
  // tron = 'tron',
  algo = 'algorand',
}

// Inlined from @walletconnect/sign-client to avoid pulling the entire
// sign-client package (98 transitive deps) into the eager bundle.
export const WALLET_CONNECT_SIGN_CLIENT_EVENTS = {
  session_proposal: 'session_proposal',
  session_update: 'session_update',
  session_extend: 'session_extend',
  session_ping: 'session_ping',
  session_delete: 'session_delete',
  session_expire: 'session_expire',
  session_request: 'session_request',
  session_request_sent: 'session_request_sent',
  session_event: 'session_event',
  proposal_expire: 'proposal_expire',
  session_authenticate: 'session_authenticate',
  session_request_expire: 'session_request_expire',
  session_connect: 'session_connect',
} as const;
// https://docs.walletconnect.com/advanced/providers/universal#events
export enum EWalletConnectSessionEvents {
  display_uri = 'display_uri',
  session_ping = 'session_ping',
  session_event = 'session_event',
  session_update = 'session_update',
  session_delete = 'session_delete',
  session_connect = 'session_connect',
  session_proposal = 'session_proposal',
  session_request = 'session_request',
  auth_request = 'auth_request', // TODO rename to session_authenticate
  session_authenticate = 'session_authenticate',
}
/*
session_proposal: SessionProposal;
session_request: SessionRequest;
session_delete: Omit<BaseEventArgs, "params">;
proposal_expire: ProposalExpire;
session_request_expire: SessionRequestExpire;
session_authenticate: SessionAuthenticate;
*/
export type IWalletConnectSignClientEvents = SignClientTypes.Event;
export type IWalletConnectSignClientEventsParams =
  SignClientTypes.EventArguments;
export type IWalletConnectEventSessionDeleteParams =
  IWalletConnectSignClientEventsParams['session_delete'];
export type IWalletConnectEventSessionUpdateParams =
  IWalletConnectSignClientEventsParams['session_update'];
export type IWalletConnectEventSessionEventParams =
  IWalletConnectSignClientEventsParams['session_event'];

export type IWalletConnectLoggerLevel = pino.Level;
export type IWalletConnectKeyValueStorage = IKeyValueStorage;
export type IWalletConnectSignClient = SignClient;
export type IWalletConnectWeb3Wallet = IWalletKit;
export type IWalletConnectConnectToWalletParams = { impl?: string };
export type IWalletConnectChainString = string; // "eip155:137"
export type IWalletConnectAddressString = string; // "eip155:137:0x275841633e1e5bF0B382B95Cd3f31E141EE15D88"
export interface IWalletConnectChainInfo {
  networkName: string; // "Polygon" chainName
  networkId: string; // "evm--137"
  chainId: string; // "137"
  wcChain: IWalletConnectChainString; // "eip155:137"
  wcNamespace: INamespaceUnion; // "eip155" wcNamespace
}

export type IWcChainAddress = IWalletConnectChainInfo & {
  address: string; // "0x275841633e1e5bF0B382B95Cd3f31E141EE15D88"
  wcAddress: IWalletConnectAddressString; // "eip155:137:0x275841633e1e5bF0B382B95Cd3f31E141EE15D88"
};

export interface ICaipsInfo {
  caipsChainId: string;
  networkId: string;
  impl: string;
  namespace: INamespaceUnion;
}
