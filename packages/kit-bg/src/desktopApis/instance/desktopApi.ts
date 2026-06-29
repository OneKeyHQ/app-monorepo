/* eslint-disable new-cap, global-require, @typescript-eslint/no-var-requires */
import { buildCallRemoteApiMethod } from '@onekeyhq/kit-bg/src/apis/RemoteApiProxyBase';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { DESKTOP_API_MESSAGE_TYPE } from '../base/consts';
import { JsBridgeDesktopApiOfMain } from '../base/JsBridgeDesktopApiOfMain';

import type {
  IDesktopApi,
  IDesktopApiKeys,
  IDesktopApiMessagePayload,
} from '../base/types';
import type DesktopApiAppleAuth from '../DesktopApiAppleAuth';
import type DesktopApiAppUpdate from '../DesktopApiAppUpdate';
import type DesktopApiBluetooth from '../DesktopApiBluetooth';
import type DesktopApiBundleUpdate from '../DesktopApiBundleUpdate';
import type DesktopApiCloudKit from '../DesktopApiCloudKit';
import type DesktopApiDev from '../DesktopApiDev';
import type DesktopApiInAppPurchase from '../DesktopApiInAppPurchase';
import type DesktopApiKeychain from '../DesktopApiKeychain';
import type DesktopApiNotification from '../DesktopApiNotification';
import type DesktopApiOAuthLocalServer from '../DesktopApiOAuthLocalServer';
import type DesktopApiSecurity from '../DesktopApiSecurity';
import type DesktopApiSniRequest from '../DesktopApiSniRequest';
import type DesktopApiStorage from '../DesktopApiStorage';
import type DesktopApiSystem from '../DesktopApiSystem';
import type DesktopApiWebview from '../DesktopApiWebview';

type IDesktopApiModuleConstructor<T> = new (params: {
  desktopApi: IDesktopApi;
}) => T;
type IDesktopApiModuleImport<T> = {
  default: IDesktopApiModuleConstructor<T>;
};

class DesktopApi implements IDesktopApi {
  // Keep desktop API modules off the main-process bootstrap path while
  // preserving the existing synchronous cross-module property access.
  private moduleCache = new Map<
    IDesktopApiKeys,
    IDesktopApi[IDesktopApiKeys]
  >();

  private getOrCreateModule<K extends IDesktopApiKeys>(
    name: K,
    create: () => IDesktopApi[K],
  ): IDesktopApi[K] {
    const existing = this.moduleCache.get(name);
    if (existing) {
      return existing as IDesktopApi[K];
    }
    const module = create();
    this.moduleCache.set(name, module);
    return module;
  }

  private createModule<T>(moduleImport: IDesktopApiModuleImport<T>): T {
    const Module = moduleImport.default;
    return new Module({ desktopApi: this });
  }

  get inAppPurchase(): DesktopApiInAppPurchase {
    return this.getOrCreateModule('inAppPurchase', () =>
      this.createModule(
        require('../DesktopApiInAppPurchase') as typeof import('../DesktopApiInAppPurchase'),
      ),
    );
  }

  get system(): DesktopApiSystem {
    return this.getOrCreateModule('system', () =>
      this.createModule(
        require('../DesktopApiSystem') as typeof import('../DesktopApiSystem'),
      ),
    );
  }

  get security(): DesktopApiSecurity {
    return this.getOrCreateModule('security', () =>
      this.createModule(
        require('../DesktopApiSecurity') as typeof import('../DesktopApiSecurity'),
      ),
    );
  }

  get storage(): DesktopApiStorage {
    return this.getOrCreateModule('storage', () =>
      this.createModule(
        require('../DesktopApiStorage') as typeof import('../DesktopApiStorage'),
      ),
    );
  }

  get webview(): DesktopApiWebview {
    return this.getOrCreateModule('webview', () =>
      this.createModule(
        require('../DesktopApiWebview') as typeof import('../DesktopApiWebview'),
      ),
    );
  }

  get notification(): DesktopApiNotification {
    return this.getOrCreateModule('notification', () =>
      this.createModule(
        require('../DesktopApiNotification') as typeof import('../DesktopApiNotification'),
      ),
    );
  }

  get dev(): DesktopApiDev {
    return this.getOrCreateModule('dev', () =>
      this.createModule(
        require('../DesktopApiDev') as typeof import('../DesktopApiDev'),
      ),
    );
  }

  get bluetooth(): DesktopApiBluetooth {
    return this.getOrCreateModule('bluetooth', () =>
      this.createModule(
        require('../DesktopApiBluetooth') as typeof import('../DesktopApiBluetooth'),
      ),
    );
  }

  get appUpdate(): DesktopApiAppUpdate {
    return this.getOrCreateModule('appUpdate', () =>
      this.createModule(
        require('../DesktopApiAppUpdate') as typeof import('../DesktopApiAppUpdate'),
      ),
    );
  }

  get bundleUpdate(): DesktopApiBundleUpdate {
    return this.getOrCreateModule('bundleUpdate', () =>
      this.createModule(
        require('../DesktopApiBundleUpdate') as typeof import('../DesktopApiBundleUpdate'),
      ),
    );
  }

  get cloudKit(): DesktopApiCloudKit {
    return this.getOrCreateModule('cloudKit', () =>
      this.createModule(
        require('../DesktopApiCloudKit') as typeof import('../DesktopApiCloudKit'),
      ),
    );
  }

  get keychain(): DesktopApiKeychain {
    return this.getOrCreateModule('keychain', () =>
      this.createModule(
        require('../DesktopApiKeychain') as typeof import('../DesktopApiKeychain'),
      ),
    );
  }

  get sniRequest(): DesktopApiSniRequest {
    return this.getOrCreateModule('sniRequest', () =>
      this.createModule(
        require('../DesktopApiSniRequest') as typeof import('../DesktopApiSniRequest'),
      ),
    );
  }

  get oauthLocalServer(): DesktopApiOAuthLocalServer {
    return this.getOrCreateModule('oauthLocalServer', () =>
      this.createModule(
        require('../DesktopApiOAuthLocalServer') as typeof import('../DesktopApiOAuthLocalServer'),
      ),
    );
  }

  get appleAuth(): DesktopApiAppleAuth {
    return this.getOrCreateModule('appleAuth', () =>
      this.createModule(
        require('../DesktopApiAppleAuth') as typeof import('../DesktopApiAppleAuth'),
      ),
    );
  }
}

const desktopApi = new DesktopApi();

const createDesktopApiModule = memoizee(
  async (name: IDesktopApiKeys) => {
    return desktopApi[name];
  },
  {
    promise: true,
  },
);

const callDesktopApiMethod =
  buildCallRemoteApiMethod<IDesktopApiMessagePayload>(
    createDesktopApiModule,
    'desktopApi',
  );

function desktopApiSetup() {
  const bridge = new JsBridgeDesktopApiOfMain({
    receiveHandler: async (payload) => {
      const msg = payload.data as IDesktopApiMessagePayload | undefined;
      if (msg && msg.type === DESKTOP_API_MESSAGE_TYPE) {
        const result: unknown = await callDesktopApiMethod(msg);
        return result;
      }
    },
  });
  return bridge;
}

export default { callDesktopApiMethod, desktopApiSetup };
