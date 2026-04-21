import appGlobals from '@onekeyhq/shared/src/appGlobals';
import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';
import { GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME } from '@onekeyhq/shared/src/background/backgroundUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { jotaiInitFromUi } from './jotaiInitFromUi';
import {
  MMKV_MIGRATION_COMPLETE_KEY,
  globalJotaiStorageReadyHandler,
} from './jotaiStorage';

import type { EAtomNames } from './atomNames';
import type BackgroundApiProxy from '../../apis/BackgroundApiProxy';

export class JotaiBgSync {
  backgroundApiProxy!: BackgroundApiProxy;

  // Batch broadcast: when paused, broadcasts are collected and flushed once.
  private broadcastPaused = false;

  private pendingBroadcasts: Array<{ name: EAtomNames; payload: any }> = [];

  pauseBroadcast() {
    this.broadcastPaused = true;
    this.pendingBroadcasts = [];
  }

  async flushBroadcast() {
    this.broadcastPaused = false;
    const pending = this.pendingBroadcasts.splice(0);
    if (pending.length === 0) {
      return;
    }
    // Send all pending broadcasts sequentially (they are cheap individually,
    // the saving is from not triggering UI-side parse+set for identical values).
    for (const item of pending) {
      await this.broadcastStateUpdateFromBgToUi(item);
    }
  }

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

  private syncLog(msg: string) {
    if (platformEnv.isNative) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { NativeLogger, LogLevel } =
          require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
        NativeLogger.write(LogLevel.Info, `[JotaiBgSync] ${msg}`);
      } catch {
        /* noop */
      }
    }
  }

  async jotaiInitFromUi() {
    this.syncLog(
      `shouldSync=${this.shouldSyncFromUiToBg}, isMainThread=${platformEnv.isNativeMainThread}, enableBg=${platformEnv.enableNativeBackgroundThread}`,
    );
    if (!this.shouldSyncFromUiToBg) {
      return;
    }
    const jsEntry: number =
      (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || Date.now();

    // Native dual-thread: MMKV per-key is always available.
    // crossAtomBuilder reads directly from MMKV — no snapshot blob needed.
    // Resolve ready immediately so GlobalJotaiReady can render.
    if (
      platformEnv.isNativeMainThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      this.syncLog(
        `native MMKV per-key: resolving ready immediately, +${Date.now() - jsEntry}ms from JS entry`,
      );
      // Signal SplashProvider: check if MMKV per-key data exists (not first install).
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { default: jotaiMMKV } =
          require('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance');
        if (jotaiMMKV.getString(MMKV_MIGRATION_COMPLETE_KEY) === '1') {
          (globalThis as any).__ONEKEY_JOTAI_SNAPSHOT_USED__ = true;
        }
      } catch {
        /* noop */
      }
      globalJotaiStorageReadyHandler.resolveReady(true);
      return;
    }

    // Extension UI: keep existing RPC path (unchanged)
    const rpcStart = Date.now();
    this.syncLog(
      `getAtomStates RPC start at +${rpcStart - jsEntry}ms from JS entry`,
    );
    const { states } = await this.backgroundApi.getAtomStates();
    const rpcEnd = Date.now();
    this.syncLog(
      `getAtomStates RPC done in ${rpcEnd - rpcStart}ms, ${Object.keys(states).length} keys, +${rpcEnd - jsEntry}ms from JS entry`,
    );
    const initStart = Date.now();
    await jotaiInitFromUi({ states });
    const initEnd = Date.now();
    this.syncLog(
      `jotaiInitFromUi (from RPC) done in ${initEnd - initStart}ms, total: ${initEnd - rpcStart}ms, +${initEnd - jsEntry}ms from JS entry`,
    );
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
    // When paused (during jotaiInit batch), collect instead of sending.
    if (this.broadcastPaused) {
      this.pendingBroadcasts.push({ name, payload });
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
