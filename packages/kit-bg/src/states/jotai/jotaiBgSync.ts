import appGlobals from '@onekeyhq/shared/src/appGlobals';
import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';
import { GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME } from '@onekeyhq/shared/src/background/backgroundUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { syncStorage } from '@onekeyhq/shared/src/storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import { EAtomNames } from './atomNames';
import { jotaiInitFromUi } from './jotaiInitFromUi';

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
        const { NativeLogger, LogLevel } = require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
        NativeLogger.write(LogLevel.Info, `[JotaiBgSync] ${msg}`);
      } catch { /* noop */ }
    }
  }

  /**
   * Read atom states snapshot.
   * Fast path: use pre-read snapshot from globalThis (set in index.ts at JS entry).
   * Fallback: read from MMKV directly (synchronous, ~1ms).
   * Returns null if no snapshot exists (first install).
   */
  private readLocalCachedStates(): Record<string, any> | null {
    // Fast path: snapshot was pre-read in index.ts at JS entry time
    const preRead = (globalThis as any).__ONEKEY_JOTAI_SNAPSHOT__;
    if (preRead && typeof preRead === 'object') {
      const keys = Object.keys(preRead);
      this.syncLog(`pre-read snapshot hit: ${keys.length} keys`);
      // Clear to avoid stale references
      delete (globalThis as any).__ONEKEY_JOTAI_SNAPSHOT__;
      return keys.length > 0 ? preRead : null;
    }

    // Fallback: read MMKV directly
    try {
      const raw = syncStorage.getString(
        EAppSyncStorageKeys.onekey_jotai_atoms_snapshot,
      );
      if (!raw) {
        this.syncLog('mmkv snapshot miss');
        return null;
      }
      const snapshot = JSON.parse(raw) as Record<string, any>;
      const keys = Object.keys(snapshot);
      this.syncLog(`mmkv snapshot hit: ${keys.length} keys`);
      return keys.length > 0 ? snapshot : null;
    } catch (e) {
      this.syncLog(`mmkv snapshot error: ${(e as Error)?.message}`);
      return null;
    }
  }

  /**
   * Save globalAtom states to MMKV snapshot.
   */
  private saveSnapshot(states: Record<string, any>) {
    try {
      syncStorage.set(
        EAppSyncStorageKeys.onekey_jotai_atoms_snapshot,
        JSON.stringify(states),
      );
      this.syncLog(
        `globalAtom snapshot saved: ${Object.keys(states).length} keys`,
      );
    } catch {
      /* best-effort */
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

    // P0 optimization: for native dual-thread mode, read from MMKV snapshot
    // instead of waiting for BG thread RPC (saves ~1.3s).
    // BG thread's jotaiInit() will broadcast any diffs after it's ready.
    if (
      platformEnv.isNativeMainThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      const cacheStart = Date.now();
      this.syncLog(
        `local cache read start at +${cacheStart - jsEntry}ms from JS entry`,
      );
      const cachedStates = this.readLocalCachedStates();
      const cacheEnd = Date.now();

      if (cachedStates) {
        const keyCount = Object.keys(cachedStates).length;
        this.syncLog(
          `local cache hit: ${keyCount} keys in ${cacheEnd - cacheStart}ms, +${cacheEnd - jsEntry}ms from JS entry`,
        );
        const initStart = Date.now();
        await jotaiInitFromUi({
          states: cachedStates as Record<EAtomNames, any>,
          useSnapshotInjection: true,
        });
        const initEnd = Date.now();
        this.syncLog(
          `jotaiInitFromUi (snapshot injection) done in ${initEnd - initStart}ms, total: ${initEnd - cacheStart}ms, +${initEnd - jsEntry}ms from JS entry`,
        );
        // Signal SplashProvider to skip processPendingInstallTask gate
        (globalThis as any).__ONEKEY_JOTAI_SNAPSHOT_USED__ = true;
        // Save globalAtom snapshot (separate key from contextAtom snapshot)
        this.saveSnapshot(cachedStates);
        return;
      }

      this.syncLog(
        `local cache miss in ${cacheEnd - cacheStart}ms, falling back to RPC`,
      );
      // Fall through to RPC path below
    }

    // Original RPC path: wait for BG thread (used by extension UI and as fallback)
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
    // Save snapshot for next startup
    if (
      platformEnv.isNativeMainThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      this.saveSnapshot(states);
    }
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
