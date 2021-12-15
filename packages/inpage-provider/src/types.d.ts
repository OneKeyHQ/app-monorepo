import React from 'react';
import { WebView } from 'react-native-webview';

export enum IJsBridgeMessageTypes {
  RESPONSE = 'RESPONSE', // response result or error
  REQUEST = 'REQUEST',
}

export type IJsBridgeMessageTypesStrings = keyof typeof IJsBridgeMessageTypes;

export type IInpageProviderRequestData = {
  id?: number | string;
  method: string;
  params: Record<string, unknown> | Array<unknown> | unknown;
};

export type IJsBridgeMessageData = {
  scope: string; // ONEKEY_INPAGE_PROVIDER_MESSAGE
  provider: string; // ethereum, solana, sollet, conflux
  request: IInpageProviderRequestData;
};

export type IJsBridgeCallback = {
  id: number;
  resolve: (value: unknown) => void;
  reject: (value: unknown) => void;
  created: number;
};

export type IJsBridgeMessagePayload = {
  id?: number;
  data?: unknown | IJsBridgeMessageData | IInpageProviderRequestData;
  error?: unknown;
  remoteId?: number | string | null;
  type?: IJsBridgeMessageTypesStrings;
  origin?: string;
  resolve?: (value: unknown) => void;
  reject?: (value: unknown) => void;
  created?: number;
  sync?: boolean;
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
  addEventListener: (name: string, callback: unknown) => void;
  removeEventListener: (name: string, callback: unknown) => void;
  executeJavaScript: (code: string) => void;
};

export type IPostMessageEventData = {
  channel: string;
  direction: string;
  payload: any;
};
