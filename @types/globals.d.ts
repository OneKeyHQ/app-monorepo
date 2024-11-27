/* eslint-disable no-var,vars-on-top */

import type {
  ETranslations,
  ETranslationsMock,
} from '@onekeyhq/shared/src/locale';

import type { ProviderPrivate } from '@onekeyfe/onekey-private-provider';

type IWindowOneKeyHub = {
  $private: ProviderPrivate & {
    webembedReceiveHandler: (payload: IJsBridgeMessagePayload) => Promise<any>;
  };
};

type IOneKeyPerfTrace = {
  log: (options: { name: string; payload?: any }) => void;
  timeline: Array<{
    time: string;
    elapsed: number;
    lag: number;
    name: string;
    payload?: any;
  }>;
};

declare global {
  var $$appGlobals: IAppGlobals;

  // eslint-disable-next-line
  // var onekey: WindowOneKey;
  var $onekey: IWindowOneKeyHub;

  var $$onekeyDisabledSetTimeout: boolean | undefined;
  var $$onekeyDisabledSetInterval: boolean | undefined;

  // defined in preload-html-head.js, check ext html bootstrap timeline:
  //      window.$$onekeyPerfTrace.timeline
  var $$onekeyPerfTrace: IOneKeyPerfTrace | undefined;

  var chrome: typeof chrome; // chrome api
  var browser: typeof chrome; // firefox api

  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Window {
    // All website
    ethereum: any;
    web3: any;
    $onekey: IWindowOneKeyHub;

    // Desktop internal (main,renderer)
    // ONEKEY_DESKTOP_GLOBALS: Record<any, any>;

    ONEKEY_DESKTOP_DEEP_LINKS: any[];
  }

  // All website
  var ethereum: any;
  var web3: any;
  var $onekey: IWindowOneKeyHub;

  // Native App webview content
  var ReactNativeWebView: WebView;

  // Desktop internal (main,renderer)
  var ONEKEY_DESKTOP_GLOBALS: Record<any, any>;

  // Ext internal (ui,background,contentScript)
  var extJsBridgeUiToBg: JsBridgeBase;
  var extJsBridgeOffscreenToBg: JsBridgeBase;
  var ONEKEY_DESKTOP_DEEP_LINKS: any[];

  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Error extends Error {
    $$autoPrintErrorIgnore?: boolean;
    $$autoToastErrorTriggered?: boolean;
  }
}

declare const self: ServiceWorkerGlobalScope;

declare global {
  namespace FormatjsIntl {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    interface Message {
      ids: ETranslations | ETranslationsMock;
    }
  }
}
