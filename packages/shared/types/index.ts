import type {
  IInjectedProviderNamesStrings,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

export type IDappSourceInfo = {
  id: string | number; // ServicePromise callback id to reject/resolve
  origin: string;
  hostname: string;
  scope: IInjectedProviderNamesStrings;
  data: IJsonRpcRequest;
  isWalletConnectRequest: boolean;
};

export enum ENetworkStatus {
  TRASH = 'TRASH',
  LISTED = 'LISTED',
}

export const SIDE_PANEL_PORT_NAME = 'ONEKEY_SIDE_PANEL';
export const EXT_POP_UP_PORT_NAME = 'onekey@EXT_PORT_UI_TO_BG';

export interface INetworkFeeInfo {
  code: string;
  symbol: string;
  decimals: number;
  isEIP1559FeeEnabled?: boolean;
  isWithL1BaseFee?: boolean;
  maxSendFeeUpRatio?: number;
}

export interface INetworkRpcURL {
  url: string;
  indexer?: string;
}

export interface INetworkPriceConfig {
  channel: string;
  native?: string;
  platform?: string;
}

export interface INetworkExplorerConfig {
  name?: string;
  address?: string;
  transaction?: string;
  block?: string;
  token?: string;
}

export type IServerNetwork = {
  id: string;
  impl: string;
  chainId: string;
  name: string;
  code: string;
  shortname: string;
  shortcode: string;
  symbol: string;
  logoURI: string;
  decimals: number;
  feeMeta: INetworkFeeInfo;
  defaultEnabled: boolean;
  backendIndex?: boolean;
  support?: string[];
  status: ENetworkStatus;
  isTestnet: boolean;
  extensions?: Record<string, unknown>;
  isAllNetworks?: boolean;
};

export enum EOnekeyDomain {
  ONEKEY_SO = 'onekey.so',
}

export enum EAccountSelectorSceneName {
  home = 'home',
  homeUrlAccount = 'homeUrlAccount',
  swap = 'swap',
  discover = 'discover',
  addressInput = 'addressInput', // test Gallery AddressInput test
}

export type INotPromise<T> = T extends Promise<any> ? never : T;

export enum EHomeTab {
  TOKENS = 'tokens',
  NFT = 'nft',
  HISTORY = 'history',
  TOOLS = 'tools',
}

export enum EAssetType {
  Token = 'Token',
  NFT = 'NFT',
}

export enum ETxActionComponentType {
  ListView = 'ListView',
  DetailView = 'DetailView',
}
