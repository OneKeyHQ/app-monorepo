/* eslint-disable no-var,vars-on-top */

import type { ICheckCurrentDBIsMigratedToBucketResult } from '@onekeyhq/kit-bg/src/migrations/indexedToBucketsMigration/indexedToBucketsMigration';
import type {
  ETranslations,
  ETranslationsMock,
} from '@onekeyhq/shared/src/locale';
import type { IWebEmbedOnekeyAppSettings } from '@onekeyhq/web-embed/utils/webEmbedAppSettings';

import type { ProviderPrivate } from '@onekeyfe/onekey-private-provider';
import type { BrowserWindow } from 'electron';

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
  var $desktopMainAppFunctions: {
    getSafelyMainWindow: () => BrowserWindow | undefined;
    getSafelyBrowserWindow: () => BrowserWindow | undefined;
    getBackgroundColor: (themeKey: string) => string;
    quitOrMinimizeApp: () => void;
    showMainWindow: () => void;
    refreshMenu: () => void;
    getAppName: () => string;
  };

  var $$appGlobals: IAppGlobals;
  var $onekeySystemDiskIsFull: boolean | undefined;
  var $indexedDBIsMigratedToBucket:
    | ICheckCurrentDBIsMigratedToBucketResult
    | undefined;

  // eslint-disable-next-line
  // var onekey: WindowOneKey;
  var $onekey: IWindowOneKeyHub;
  var $onekeyAppWebembedApiWebviewInitFailed: boolean | undefined;

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

  var WEB_EMBED_ONEKEY_APP_SETTINGS: IWebEmbedOnekeyAppSettings | undefined;

  // Added for webpack/bundler injected variables
  var __CURRENT_FILE_PATH__: string | undefined;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Error extends Error {
    $$autoPrintErrorIgnore?: boolean;
    $$autoToastErrorTriggered?: boolean;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
  interface Promise<T> {
    toString(
      PromiseToStringNotAllowed1: boolean,
      PromiseToStringNotAllowed2: string,
      PromiseToStringNotAllowed3: number,
      PromiseToStringNotAllowed4: null,
      PromiseToStringNotAllowed5: undefined,
    ): string;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Buffer {
    toString(
      BufferToStringIsNotSafeInNative: boolean,
      UseBufferUtilsInstead: boolean,
      // encoding?: BufferEncoding,
      // start?: number,
      // end?: number,
    ): string;
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

declare global {
  interface IStorageBucketOptions {
    durability?: 'strict' | 'relaxed';
    persisted?: boolean;
  }

  interface IStorageBucket {
    indexedDB: IDBFactory;
  }

  interface IStorageBucketManager {
    open(
      name: string,
      options?: IStorageBucketOptions,
    ): Promise<IStorageBucket>;
    keys(): Promise<string[]>;
    delete(name: string): Promise<void>;
  }

  interface INavigator extends Navigator {
    storageBuckets?: IStorageBucketManager;
  }

  var navigator: INavigator!;
}
