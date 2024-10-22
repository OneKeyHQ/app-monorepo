/* eslint-disable no-var,vars-on-top */
import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type BackgroundApi from '@onekeyhq/kit-bg/src/apis/BackgroundApi';
import type BackgroundApiProxy from '@onekeyhq/kit-bg/src/apis/BackgroundApiProxy';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { LocalDbBase } from '@onekeyhq/kit-bg/src/dbs/local/LocalDbBase';
import type { IOffscreenApi } from '@onekeyhq/kit-bg/src/offscreens/instance/IOffscreenApi';
import type { JotaiBgSync } from '@onekeyhq/kit-bg/src/states/jotai/jotaiBgSync';
import type { IWebembedApi } from '@onekeyhq/kit-bg/src/webembeds/instance/IWebembedApi';
import type { Analytics } from '@onekeyhq/shared/src/analytics';
import type {
  ETranslations,
  ETranslationsMock,
} from '@onekeyhq/shared/src/locale';
import type { DefaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type { ProviderPrivate } from '@onekeyfe/onekey-private-provider';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { EnhancedStore } from '@reduxjs/toolkit';
import type WebView from 'react-native-webview';
import type Realm from 'realm';

declare const self: ServiceWorkerGlobalScope;

type IWindowOneKeyHub = {
  $private: ProviderPrivate & {
    webembedReceiveHandler: (payload: IJsBridgeMessagePayload) => Promise<any>;
  };
};
declare global {
  // eslint-disable-next-line
  // var onekey: WindowOneKey;

  var $rootAppNavigation: IAppNavigation | undefined;
  var $$scanNavigation: IAppNavigation | undefined;
  var $appIsReduxReady: boolean;
  var $onekey: IWindowOneKeyHub;
  var $backgroundApiProxy: BackgroundApiProxy;
  var $$backgroundApi: BackgroundApi; // not available for ext ui
  var $jotaiBgSync: JotaiBgSync;
  var $analytics: Analytics;

  var $$Toast: any;
  var $$navigationShortcuts: any;
  var $$jotaiContextStore: any;
  var $$jotaiContextStorePrint: any;
  var $$simpleDb: any;
  var $$simpleDbV4: any;
  var $$localDb: LocalDbBase;
  var $$localDbV4: any;
  var $$appEventBus: any;
  var $$appUIEventBus: any;
  var $$appStore: EnhancedStore;
  var $$appDispatch: any;
  var $$realm: Realm;
  var $$appSelector: any;
  var $$appStorage: any;
  var $$allAtoms: any; // jotai global atoms
  var $$defaultLogger: DefaultLogger;
  var $$platformEnv: any;
  var $$localforage: any;
  var $$navigationActions: any;
  var $$wcTransports: any;
  var $$onekeyDisabledSetTimeout: boolean | undefined;
  var $$onekeyDisabledSetInterval: boolean | undefined;
  var $$onekeyPerfTrace:
    | {
        log: (options: { name: string; payload?: any }) => void;
        timeline: Array<{
          time: string;
          elapsed: number;
          lag: number;
          name: string;
          payload?: any;
        }>;
      }
    | undefined;
  var $navigationRef: React.RefObject<NavigationContainerRef<any>>;

  var $offscreenApiProxy: IOffscreenApi;
  var $webembedApiProxy: IWebembedApi;

  var chrome: typeof chrome; // chrome api
  var browser: typeof chrome; // firefox api

  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Window {
    // All website
    ethereum: any;
    web3: any;
    $onekey: IWindowOneKeyHub;

    // Native App webview content
    ReactNativeWebView: WebView;

    // Desktop internal (main,renderer)
    // ONEKEY_DESKTOP_GLOBALS: Record<any, any>;

    // Ext internal (ui,background,contentScript)
    extJsBridgeUiToBg: JsBridgeBase;
    extJsBridgeOffscreenToBg: JsBridgeBase;
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

declare global {
  namespace FormatjsIntl {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    interface Message {
      ids: ETranslations | ETranslationsMock;
    }
  }
}
