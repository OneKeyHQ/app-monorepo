import type { IRuntimeHealthReport } from '@onekeyhq/shared/src/performance/collectors/jsBlockCollector';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { BaseScene } from '../../../base/baseScene';
import { LogToConsole, LogToLocal } from '../../../base/decorators';

let _renderStartAt = 0;

export function markRenderStart() {
  if (_renderStartAt === 0) {
    _renderStartAt = Date.now();
  }
}

export function getRenderElapsedMs(): number {
  return _renderStartAt > 0 ? Date.now() - _renderStartAt : 0;
}

export class AppPerfScene extends BaseScene {
  @LogToConsole()
  public logTime(params: { message: string; data?: any }) {
    return [params];
  }

  @LogToLocal()
  public longTask(params: {
    durationMs: number;
    name?: string;
    stack?: string;
  }) {
    return [params];
  }

  @LogToLocal()
  public longTaskInitFailed(error: unknown) {
    return [
      {
        message: error instanceof Error ? error.message : String(error),
      },
    ];
  }

  @LogToLocal()
  public intervalCensus(params: {
    totalLive: number;
    bySource: { source: string; count: number }[];
  }) {
    return [params];
  }

  // Atom names only, aggregated per window: never a line per write.
  @LogToLocal()
  public uiAtomWriteCensus(params: {
    windowMs: number;
    total: number;
    atomCount: number;
    byAtom: { atom: string; count: number }[];
  }) {
    return [params];
  }

  // Aggregated per window: event-loop blocks, JS heap and GC, process CPU
  // and memory, including compact numeric frame-window tuples.
  @LogToLocal()
  public runtimeHealthCensus(params: IRuntimeHealthReport) {
    return [params];
  }

  // How much data the background pushed into this runtime, per window.
  // Sender names and sizes only, never payloads.
  @LogToLocal()
  public mainInboundCensus(params: {
    windowMs: number;
    total: number;
    totalKB: number;
    totalChars: number;
    byKind: { kind: string; count: number; kb: number }[];
    bySender: { sender: string; count: number; kb: number }[];
  }) {
    return [params];
  }

  @LogToLocal()
  public cpuWatchdogFired(params: {
    reason:
      | 'sustained-high-cpu-severe'
      | 'sustained-high-cpu-mild'
      | 'unresponsive';
    pid?: number;
    cpuTrend?: number[];
    uptimeMs?: number;
  }) {
    return [params];
  }

  @LogToLocal()
  public defensiveTriggered(params: {
    source: string;
    reason: string;
    details?: Record<string, unknown>;
  }) {
    return [params];
  }

  @LogToLocal({ level: 'warn' })
  public swrCacheCapacityLimit(params: {
    affectedEntryCount: number;
    cooldownMs: number;
    eventCount: number;
    maxEntries: number;
    maxEntrySerializedChars: number;
    maxObservedEntrySerializedChars: number;
    maxSerializedChars: number;
    namespaces: string[];
    reason:
      | 'bootstrapEntryCountLimit'
      | 'bootstrapSizeLimit'
      | 'entryCountLimit'
      | 'entryLimit'
      | 'keyLimit'
      | 'totalSizeLimit';
    retainedEntryCount: number;
    retainedSerializedChars: number;
  }) {
    return params;
  }

  // A deletion path waited for the snapshot store and the store reported the
  // batch still in memory: it re-queued the removal behind a timer that an
  // extension popup, closing right after the deletion, would take with it.
  @LogToLocal({ level: 'warn' })
  public swrCacheRemovalNotPersisted(params: {
    reason: 'removedWallet' | 'removedAccount';
  }) {
    return { ...params, runtime: platformEnv.runtimeRole };
  }

  // Whole-store SWR work is synchronous on the calling JS runtime, so a slow
  // pass on `main` is a UI stall. `runtime` tells main from background.
  @LogToLocal({ level: 'warn' })
  public swrCacheSlowOp(params: {
    op: 'flush' | 'reload' | 'mirrorApply';
    durationMs: number;
    storeChars: number;
    entryCount?: number;
    readMs?: number;
    pruneMs?: number;
    patchMs?: number;
    adoptMs?: number;
    updatedKeyCount?: number;
    patchChars?: number;
    source?: 'ack' | 'broadcast';
    mutationOp?: 'set' | 'patchSWR' | 'remove' | 'clear';
    replayedCount?: number;
    heapBytes?: number;
    allocatedBytes?: number;
    gcCount?: number;
    gcMs?: number;
  }) {
    return { ...params, runtime: platformEnv.runtimeRole };
  }

  @LogToLocal()
  public renderPhase(params: { name: string; elapsedMs: number }) {
    return params;
  }

  @LogToLocal()
  public profilerRender(params: {
    id: string;
    phase: string;
    actualDuration: number;
    baseDuration: number;
    renderCount: number;
    totalActualDuration: number;
    elapsedMs: number;
  }) {
    return params;
  }

  @LogToLocal()
  public tabPreloadStrategy(tier: string) {
    return { tier };
  }

  @LogToLocal()
  public tabPageMounted(routeName: string) {
    return { routeName };
  }

  @LogToLocal()
  public tabPreloadMount(routeName: string) {
    return { routeName };
  }

  @LogToLocal()
  public deviceTierDetected(params: {
    tier: string;
    source: 'cache' | 'default' | 'calibration';
    data?: any;
  }) {
    return params;
  }

  @LogToLocal()
  public deviceCapabilityDetected(params: {
    cpuTier: string;
    cpuSource: string;
    cpuConfidence: string;
    memoryClass: string;
    tabPreloadMode: string;
    tabPreloadReason: string;
    dataVersion: string;
  }) {
    return params;
  }

  // A root tab has to clear three gates before it can be shown without any
  // loading state, and preloading is only worth anything if all three happen
  // before the user taps. One line per transition, never one per render:
  //   dispatch          - the navigator sent CommonActions.preload
  //   sceneRevealed     - the scene laid out and SceneLoadingView came off
  //   pageBodyRendered  - LazyPageContainer let the page tree mount
  // `aheadOfFocus: false` means the stage only happened once the tab was
  // already focused, i.e. the user sat through it. `dispatch` carries no such
  // flag: it is a scheduler event, and whether the queue reached a tab first
  // is answered by the two stages that actually gate what the user sees.
  @LogToLocal()
  public tabPreloadStage(
    params:
      | { stage: 'dispatch'; tab: string }
      | {
          stage: 'sceneRevealed' | 'pageBodyRendered';
          tab: string;
          aheadOfFocus: boolean;
        },
  ) {
    return [params];
  }
}
