import { SIGN_CLIENT_EVENTS } from '@walletconnect/sign-client';

import type { IKeyValueStorage } from '@walletconnect/keyvaluestorage';
import type { pino } from '@walletconnect/logger';
import type SignClient from '@walletconnect/sign-client';
import type {
  ProposalTypes,
  SessionTypes,
  SignClientTypes,
} from '@walletconnect/types';
import type Web3Wallet from '@walletconnect/web3wallet';

export type IWalletConnectNamespaces = SessionTypes.Namespaces;
export type IWalletConnectRequiredNamespaces = ProposalTypes.RequiredNamespaces;
export type IWalletConnectOptionalNamespaces = ProposalTypes.OptionalNamespaces;
export type IWalletConnectNamespace = SessionTypes.Namespace;
export type IWalletConnectSession = SessionTypes.Struct;

export type INamespaceUnion =
  | 'eip155'
  | 'cosmos'
  | 'solana'
  | 'polkadot'
  | 'tron';

export enum EWalletConnectNamespaceType {
  evm = 'eip155',
  cosmos = 'cosmos',
  solana = 'solana',
  dot = 'polkadot',
  tron = 'tron',
}

export const WALLET_CONNECT_SIGN_CLIENT_EVENTS = SIGN_CLIENT_EVENTS;
// https://docs.walletconnect.com/advanced/providers/universal#events
export enum EWalletConnectSessionEvents {
  display_uri = 'display_uri',
  session_ping = 'session_ping',
  session_event = 'session_event',
  session_update = 'session_update',
  session_delete = 'session_delete',
  session_proposal = 'session_proposal',
  session_request = 'session_request',
  auth_request = 'auth_request',
}
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
export type IWalletConnectWeb3Wallet = Web3Wallet;

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
