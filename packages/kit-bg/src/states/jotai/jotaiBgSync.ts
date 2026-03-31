import appGlobals from '@onekeyhq/shared/src/appGlobals';
import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';
import { GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME } from '@onekeyhq/shared/src/background/backgroundUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { jotaiInitFromUi } from './jotaiInitFromUi';

import type { EAtomNames } from './atomNames';
import type BackgroundApiProxy from '../../apis/BackgroundApiProxy';

export class JotaiBgSync {
  backgroundApiProxy!: BackgroundApiProxy;

  private get shouldSyncFromUiToBg() {
    return (
      platformEnv.isExtensionUi ||
      (platformEnv.isNativeMainThread &&
        platformEnv.enableNativeBackgroundThread)
    );
  }

  private get shouldBroadcastFromBgToUi() {
    return (
      platformEnv.isExtensionBackground ||
      (platformEnv.isNativeBackgroundThread &&
        platformEnv.enableNativeBackgroundThread)
    );
  }

  get backgroundApi() {
    return this.backgroundApiProxy?.backgroundApi || this.backgroundApiProxy;
  }

  setBackgroundApi(backgroundApi: BackgroundApiProxy) {
    this.backgroundApiProxy = backgroundApi;
  }

  proxyStateUpdateActionFromUiToBg({
    name,
    payload,
  }: {
    name: EAtomNames;
    payload: any;
  }) {
    if (!this.shouldSyncFromUiToBg) {
      return;
    }
    return this.backgroundApi.setAtomValue(name, payload);
  }

  // allAtoms: Promise<{
  //   [key: string]: CrossAtom<any>;
  // }>;

  async jotaiInitFromUi() {
    if (!this.shouldSyncFromUiToBg) {
      return;
    }
    const { states } = await this.backgroundApi.getAtomStates();
    await jotaiInitFromUi({ states });
  }

  async broadcastStateUpdateFromBgToUi({
    name,
    payload,
  }: {
    name: EAtomNames;
    payload: any;
  }) {
    if (!this.shouldBroadcastFromBgToUi) {
      return;
    }
    const p: IGlobalStatesSyncBroadcastParams = {
      $$isFromBgStatesSyncBroadcast: true,
      name,
      payload,
    };
    if (
      platformEnv.isNativeBackgroundThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      const runtimeGlobal = globalThis as typeof globalThis & {
        __onekeyNativeBackgroundThreadJotaiBridge?: {
          broadcastStateUpdateFromBgToUi: (params: {
            name: string;
            payload: any;
          }) => boolean;
        };
      };

      const bridge = runtimeGlobal.__onekeyNativeBackgroundThreadJotaiBridge;
      if (!bridge) {
        throw new OneKeyLocalError(
          'native background thread jotai bridge is not ready',
        );
      }
      bridge.broadcastStateUpdateFromBgToUi({
        name,
        payload,
      });
      return;
    }
    if (!this.backgroundApi.bridgeExtBg) {
      throw new OneKeyLocalError('backgroundApi.bridgeExtBg is not ready');
    }
    this.backgroundApi.bridgeExtBg.requestToAllUi({
      method: GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME,
      params: p,
    });
  }
}

export const jotaiBgSync = new JotaiBgSync();
// use global var to avoid circular dependency
appGlobals.$jotaiBgSync = jotaiBgSync;
