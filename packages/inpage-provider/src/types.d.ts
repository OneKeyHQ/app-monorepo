import React from 'react';

export type WindowOneKey = {
  jsBridge: IJsBridge;
  ethereum: unknown;
};

export type JsBridgeEventPayload = {
  id?: number | string;
  remoteId?: number | string;
  data?: unknown;
  origin?: string;
  resolve?: (payload: unknown) => void;
  reject?: () => null;
};

export type IJsBridgeMessagePayload = {
  id?: number | string;
  remoteId?: number | string;
  data?: unknown | IInpageProviderRequestPayload;
  type?: string; // 'request', 'response'
  origin?: string;
  resolve?: ((value: unknown) => void) | undefined;
  reject?: () => null;
};

export type IInpageProviderRequestPayload = {
  id: number | string;
  method: string;
  params: Record<string, unknown> | Array<unknown> | unknown;
  others: Record<string, unknown> | Array<unknown> | unknown;
};

export type ICreateJsBridgeParams = {
  sendPayload?: (data: string | unknown) => void;
  sendAsString?: boolean;
};

export type ICreateJsBridgeHostParams = {
  webviewRef?: React.RefObject<IReactNativeWebViewRef | IElectronWebViewRef>;
  isReactNative?: boolean;
  isElectron?: boolean;
  isExtension?: boolean;
};

export type IReactNativeWebViewRef = {
  injectJavaScript: (code: string) => void;
};

export type IElectronWebViewRef = {
  closeDevTools: () => void;
  openDevTools: () => void;
  addEventListener: (name: string, callback: unknown) => void;
  removeEventListener: (name: string, callback: unknown) => void;
  executeJavaScript: (code: string) => void;
};

export type IWebViewWrapperRef = {
  jsBridge?: IJsBridge | null;
};

export type IJsBridge = {
  version: string;
  MESSAGE_TYPES: Record<string, string>;
  remoteInfo: Record<any, any>;
  on: (
    eventName: string,
    callback: (event: JsBridgeEventPayload) => void,
  ) => void;
  off: () => void;
  send: (payload: IJsBridgeMessagePayload) => Promise<any>;
  receive: (payload: string) => void;
  request: (data: any, remoteId?: unknown) => Promise<unknown>;
  response: (
    id?: number | string,
    data: any,
    error?: Error | null,
    remoteId?: unknown,
  ) => void;
  responseMessage: (data: string) => void;
  trigger: (event: string, payload: any) => void;
};
