import React from 'react';

import { WebView } from 'react-native-webview';

export enum IJsBridgeMessageTypes {
  RESPONSE = 'RESPONSE', // response result or error
  REQUEST = 'REQUEST',
}

export type IJsBridgeMessageTypesStrings = keyof typeof IJsBridgeMessageTypes;

export enum IInjectedProviderNames {
  ethereum = 'ethereum',
  conflux = 'conflux',
  solana = 'solana',
  sollet = 'sollet',
}

export type IInjectedProviderNamesStrings = keyof typeof IInjectedProviderNames;

export type IJsonRpcRequest = {
  id?: number | string;
  jsonrpc?: '2.0' | '1.0';
  method: string;
  params: Record<string, unknown> | Array<unknown> | unknown;
};

export type IJsonRpcResponse<T> = {
  id?: number | string;
  jsonrpc: string;
  result: any | unknown | T;
};

export type IJsBridgeCallback = {
  id: number;
  resolve: (value: unknown) => void;
  reject: (value: unknown) => void;
  created: number;
};

export type IJsBridgeMessagePayload = {
  id?: number;
  data?: unknown | IJsonRpcRequest;
  error?: unknown;
  remoteId?: number | string | null;
  type?: IJsBridgeMessageTypesStrings;
  scope?: IInjectedProviderNamesStrings;
  origin?: string;
  resolve?: (value: unknown) => void;
  reject?: (value: unknown) => void;
  created?: number;
  sync?: boolean;
  internal?: boolean;
};

export type IJsBridgeConfig = {
  sendAsString?: boolean;
  debug?: boolean;
  receiveHandler?: IJsBridgeReceiveHandler;
  webviewRef?: React.RefObject<IElectronWebView | WebView | any>;
};

export type IJsBridgeReceiveHandler = (
  payload: IJsBridgeMessagePayload,
) => any | Promise<any>;

export type IElectronWebView = {
  reload: () => void;
  closeDevTools: () => void;
  openDevTools: () => void;
  getURL: () => string;
  addEventListener: (name: string, callback: unknown) => void;
  removeEventListener: (name: string, callback: unknown) => void;
  executeJavaScript: (code: string) => void;
};

export type IPostMessageEventData = {
  channel: string;
  direction: string;
  payload: any;
};
