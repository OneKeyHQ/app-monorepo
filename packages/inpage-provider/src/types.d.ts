import Electron from 'electron';

export type WindowOneKey = {
  jsBridge: IJsBridge;
  ethereum: any;
};

export type JsBridgeEventPayload = {
  id?: number | string;
  data?: any;
  origin?: string;
  resolve?: (payload: Record<any, any>) => void;
  reject?: () => null;
};

export type IJsBridgeMessagePayload = {
  id?: number | string;
  data?: any;
  type?: string;
  origin?: string;
  resolve?: ((value: unknown) => void) | undefined;
  reject?: () => null;
};

export type IInpageProviderRequestPayload = {
  id: number | string;
  method: string;
  params: any;
};

export type ICreateJsBridgeParams = {
  sendPayload?: (data: string) => void;
};

export type ICreateJsBridgeHostParams = {
  webviewRef: any;
  isReactNative?: boolean;
  isElectron?: boolean;
};

export type IWebViewWrapperRef = {
  jsBridge?: IJsBridge | null;
};

export type IJsBridge = {
  version: string;
  MESSAGE_TYPES: Record<any, any>;
  remoteInfo: Record<any, any>;
  on: (
    eventName: string,
    callback: (event: JsBridgeEventPayload) => void,
  ) => void;
  off: () => void;
  send: (data: IJsBridgeMessagePayload) => Promise<any>;
  receive: (data: string) => void;
  request: (data: any) => Promise<any>;
  response: (id: number | string, data: any, error?: Error | null) => void;
  responseMessage: (data: string) => void;
  trigger: (event: string, payload: any) => void;
};

export type ElectronWebviewTag = Electron.WebviewTag;
