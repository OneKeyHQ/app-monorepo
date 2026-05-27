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

  // Micro-batch broadcast: same-microtask atom writes coalesce into one
  // SharedRPC slot via the native batch broadcast bridge. This is the
  // primary lever for the bg→main cascade storm — see OK-perp/swap freeze
  // case where 2395 setAtomValue + their reverse broadcasts saturated the
  // main JS thread.
  //
  // Each item carries its own `resolve` / `reject` so that callers awaiting
  // `broadcastStateUpdateFromBgToUi` settle on the actual flush outcome —
  // a flush exception (bridge unavailable, sharedRPC missing, serialize
  // failure) propagates back through every awaiter in the same batch
  // instead of becoming an orphan microtask rejection.
  private microBatchBuffer: Array<{
    name: EAtomNames;
    payload: any;
    resolve: () => void;
    reject: (reason: unknown) => void;
  }> = [];

  private microBatchFlushScheduled = false;

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

  /**
   * Drain `microBatchBuffer` and either:
   *   - noop (empty buffer),
   *   - emit a single broadcast via the legacy path (size 1), or
   *   - emit a batch broadcast (size >1).
   *
   * Same-named writes are deduplicated last-write-wins; the surviving write's
   * position follows the LAST occurrence of each atom so derived UI subscribers
   * observe values in the same sequence as without micro-batch coalescing.
   * `Map#set` alone preserves first-insertion position, which would re-order
   * sequences like `A1 -> B -> A2` into `[A2, B]` instead of `[B, A2]`; delete
   * before set to refresh the insertion slot.
   */
  private flushBroadcastMicroBatch() {
    this.microBatchFlushScheduled = false;
    const buffer = this.microBatchBuffer.splice(0);
    if (buffer.length === 0) {
      return;
    }

    const dedup = new Map<EAtomNames, any>();
    for (const item of buffer) {
      dedup.delete(item.name);
      dedup.set(item.name, item.payload);
    }

    try {
      if (dedup.size === 1) {
        const [name, payload] = dedup.entries().next().value as [
          EAtomNames,
          any,
        ];
        this.deliverBroadcast({ name, payload });
      } else if (dedup.size > 1) {
        const items: Array<{ name: EAtomNames; payload: any }> = [];
        dedup.forEach((payload, name) => {
          items.push({ name, payload });
        });
        this.deliverBroadcastBatch(items);
      }
      for (const item of buffer) {
        item.resolve();
      }
    } catch (error) {
      // Surface delivery failure to every caller awaiting this batch flush.
      // `deliverBroadcast` throws OneKeyLocalError when the native bridge
      // isn't ready; without this propagation the rejection becomes an
      // orphan microtask and the original awaiters resolve on a phantom
      // success path while bg/main state silently diverges.
      for (const item of buffer) {
        item.reject(error);
      }
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

    // Native dual-thread: enqueue into a same-microtask micro-batch so the N
    // setAtomValue writes triggered by a single service response collapse
    // into one (or a few) SharedRPC slot writes. Cross-tab cascade storms
    // (e.g. 2395 setAtomValue in 13s during the OK-perp/swap freeze case)
    // pay the bridge cost ~once instead of N times.
    //
    // The returned Promise settles only after `flushBroadcastMicroBatch`
    // has actually delivered (or attempted to deliver) the broadcast.
    // Callers like `wrapAtomPro.doSet` that `await` this method therefore
    // observe the original await-barrier semantics: an in-flight write
    // continues past the await only on real success, and bridge failures
    // surface back through the original call site instead of as an
    // orphan microtask rejection.
    //
    // Extension background path keeps the immediate-send behavior: the
    // ext bridge already supports requestToAllUi batching internally and
    // we have no measured cascade pressure there yet.
    if (
      platformEnv.isNativeBackgroundThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      return new Promise<void>((resolve, reject) => {
        this.microBatchBuffer.push({ name, payload, resolve, reject });
        if (!this.microBatchFlushScheduled) {
          this.microBatchFlushScheduled = true;
          queueMicrotask(() => this.flushBroadcastMicroBatch());
        }
      });
    }

    this.deliverBroadcast({ name, payload });
  }

  /**
   * Send one atom broadcast to all UI runtimes. Equivalent to the
   * pre-micro-batch behavior — used both for non-native bridge mode and as
   * the single-item flush path.
   */
  private deliverBroadcast({
    name,
    payload,
  }: {
    name: EAtomNames;
    payload: any;
  }) {
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

  /**
   * Native batch broadcast — only invoked from `flushBroadcastMicroBatch`
   * once it has accumulated >1 deduped items.
   *
   * Two independent capabilities have to be satisfied before the batch wire
   * protocol is safe to use:
   *
   *   1. `broadcastStateUpdateBatchFromBgToUi` exists on this bg runtime's
   *      bridge object (i.e. the writer can produce the new `onekey:bg:
   *      jotai-batch:` keys at all).
   *   2. The main runtime has advertised that it knows how to consume those
   *      keys via `isMainBatchProtocolReady()`. Without this handshake a
   *      partial OTA / split-runtime mismatch (new bg bundle + old main
   *      bundle that only listens on `onekey:bg:jotai:`) would silently
   *      drop every batched update and freeze the UI on stale state.
   *
   * If either check fails we fan out via the per-item `deliverBroadcast`
   * path — that path uses the legacy `onekey:bg:jotai:` keys that every
   * release/v6.3.0 main runtime supports.
   */
  private deliverBroadcastBatch(
    items: Array<{ name: EAtomNames; payload: any }>,
  ) {
    const runtimeGlobal = globalThis as typeof globalThis & {
      __onekeyNativeBackgroundThreadJotaiBridge?: {
        broadcastStateUpdateBatchFromBgToUi?: (params: {
          items: Array<{ name: string; payload: any }>;
        }) => boolean;
        isMainBatchProtocolReady?: () => boolean;
      };
    };

    const bridge = runtimeGlobal.__onekeyNativeBackgroundThreadJotaiBridge;
    if (
      bridge?.broadcastStateUpdateBatchFromBgToUi &&
      bridge.isMainBatchProtocolReady?.()
    ) {
      bridge.broadcastStateUpdateBatchFromBgToUi({ items });
      return;
    }

    // Capability not (yet) confirmed on main side — emit each broadcast via
    // the legacy single-broadcast key so the older observer keeps working.
    // Bursts that happen before the handshake completes therefore pay the
    // full bridge cost per item; once main advertises support every later
    // burst collapses into a single batch slot again.
    for (const item of items) {
      this.deliverBroadcast(item);
    }
  }
}

export const jotaiBgSync = new JotaiBgSync();
// use global var to avoid circular dependency
appGlobals.$jotaiBgSync = jotaiBgSync;
