import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';
import { GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME } from '@onekeyhq/shared/src/background/backgroundUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { jotaiInitFromUi } from './jotaiInit';

import type { EAtomNames } from './atomNames';
import type BackgroundApiProxy from '../../apis/BackgroundApiProxy';

export class JotaiBgSync {
  backgroundApiProxy!: BackgroundApiProxy;

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
    if (!platformEnv.isExtensionUi) {
      return;
    }
    return this.backgroundApi.setAtomValue(name, payload);
  }

  // allAtoms: Promise<{
  //   [key: string]: CrossAtom<any>;
  // }>;

  async jotaiInitFromUi() {
    if (!platformEnv.isExtensionUi) {
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
    if (!platformEnv.isExtensionBackground) {
      return;
    }
    const p: IGlobalStatesSyncBroadcastParams = {
      $$isFromBgStatesSyncBroadcast: true,
      name,
      payload,
    };
    if (!this.backgroundApi.bridgeExtBg) {
      throw new Error('backgroundApi.bridgeExtBg is not ready');
    }
    this.backgroundApi.bridgeExtBg.requestToAllUi({
      method: GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME,
      params: p,
    });
  }
}

export const jotaiBgSync = new JotaiBgSync();
// use global var to avoid circular dependency
global.$jotaiBgSync = jotaiBgSync;
