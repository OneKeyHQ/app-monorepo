import {
  dispatchHomeStoreEventsTransaction,
  readHomeStoreState,
  readHomeStoreStateLazily,
} from '@onekeyhq/kit/src/states/jotai/contexts/home/actions';
import type { IHomeDisplaySnapshotLoadState } from '@onekeyhq/kit/src/states/jotai/contexts/home/atoms';
import type { IJotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IHomeRuntimeJsonValue,
  IHomeRuntimeOwnerScope,
  IRuntimeLeafResponseEnvelope,
} from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { HomeSnapshotRuntime } from '../cache/homeSnapshotRuntime';
import {
  HomeEffectMiddleware,
  type IHomeEffectEnvelope,
  type IHomeEffectHandlerMap,
} from '../effects/homeEffectMiddleware';
import { transitionHomeSession } from '../lifecycle/homeSessionMachine';
import { HomePersistenceRuntime } from '../persistence/homePersistenceRuntime';
import {
  HomeStoreCommitBudget,
  type IHomeStoreCommitBudgetOptions,
  type IHomeStoreCommitBudgetSnapshot,
} from '../results/homeStoreCommitBudget';
import { HomeLeafRequestPool } from '../scheduler/homeLeafRequestPool';
import {
  HomeRequestScheduler,
  type IHomeRequestSchedulerOptions,
  type IHomeRequestSchedulerSnapshot,
} from '../scheduler/homeRequestScheduler';
import { HomeSourceRuntime } from '../sources/homeSourceRuntime';

import { registerHomeRuntimeDispatcher } from './homeRuntimeRegistry';

import type { IHomeHeaderAccountPresentation } from '../presentation/homeHeaderPresentation';
import type {
  IHomeCommandCompletion,
  IHomeCommandExecution,
  IHomeDispatchReceipt,
  IHomeStoreEffect,
  IHomeStoreEvent,
  IHomeStoreIntent,
  IHomeStoreRejectReason,
} from '../store/homeStoreTypes';

type IHomeRuntimeMode = 'wallet' | 'urlAccount';

export interface IHomeRuntimeCapabilities {
  sourceExecution: boolean;
  displaySnapshots: boolean;
  persistence: boolean;
  commands: boolean;
}

export const HOME_RUNTIME_CAPABILITIES = {
  wallet: {
    sourceExecution: true,
    displaySnapshots: true,
    persistence: true,
    commands: true,
  },
  urlAccount: {
    sourceExecution: true,
    displaySnapshots: false,
    persistence: false,
    commands: false,
  },
} as const satisfies Record<IHomeRuntimeMode, IHomeRuntimeCapabilities>;

export interface IHomeRuntimeIdentity {
  runtimeInstanceId: string;
  clientInstanceId: string;
}

export interface IHomeOwnerPerfLabels {
  walletName?: string;
  accountName?: string;
}

export type IHomeRuntimeEffectExecutors = IHomeEffectHandlerMap;

export interface IAcquireHomeRuntimeOptions {
  mode: IHomeRuntimeMode;
  effectExecutors?: IHomeRuntimeEffectExecutors;
  requestLeaf?: IHomeRequestSchedulerOptions['requestLeaf'];
  commitBudget?: IHomeStoreCommitBudgetOptions;
  onSchedulerSnapshot?: IHomeRequestSchedulerOptions['onSnapshot'];
}

interface IHomeRuntimeLeaseEntry {
  mode: IHomeRuntimeMode;
  refCount: number;
  disposeScheduled: boolean;
  runtime: HomeStoreRuntime;
  unregisterDispatcher: () => void;
}

const HOME_COMMAND_TIMEOUT_MS = 30_000;

const runtimeByStore = new WeakMap<
  IJotaiContextStore,
  IHomeRuntimeLeaseEntry
>();

function createRuntimeIdentity(): IHomeRuntimeIdentity {
  const suffix = stringUtils.generateUUID({ removeDashes: true });
  return {
    runtimeInstanceId: `home-runtime-${suffix}`,
    clientInstanceId: `home-client-${suffix}`,
  };
}

function createUnavailableLeafResponse<
  TValue extends IHomeRuntimeJsonValue,
>(): IRuntimeLeafResponseEnvelope<TValue> {
  return {
    taskId: 'unavailable',
    clientInstanceId: 'unavailable',
    appEpoch: 'unavailable',
    sessionId: 'unavailable',
    requestGroupId: 'unavailable',
    producerInstanceId: 'unavailable',
    outcome: { kind: 'failed', errorCode: 'runtimeUnavailable' },
  };
}

export class HomeStoreRuntime {
  readonly identity = createRuntimeIdentity();

  readonly capabilities: IHomeRuntimeCapabilities;

  readonly scheduler: HomeRequestScheduler;

  readonly leafPool: HomeLeafRequestPool;

  readonly commitBudget: HomeStoreCommitBudget;

  readonly sources: HomeSourceRuntime;

  readonly persistence: HomePersistenceRuntime;

  readonly snapshots: HomeSnapshotRuntime;

  private readonly middleware: HomeEffectMiddleware;

  private readonly store: IJotaiContextStore;

  private readonly mode: IHomeRuntimeMode;

  private effectExecutors: IHomeRuntimeEffectExecutors;

  private eventSequence = 0;

  private ownerPerfLabels: IHomeOwnerPerfLabels = {};

  private lastSchedulerPerfLogAt = 0;

  private lastSchedulerPerfSnapshot = '';

  private lastCommitBudgetPerfLogAt = 0;

  private lastCommitBudgetPerfSnapshot = '';

  private readonly pendingCommands = new Map<
    string,
    {
      sessionId: string;
      timeout: ReturnType<typeof setTimeout>;
      resolve(completion: IHomeCommandCompletion<unknown>): void;
    }
  >();

  private disposed = false;

  constructor(store: IJotaiContextStore, options: IAcquireHomeRuntimeOptions) {
    this.store = store;
    this.mode = options.mode;
    this.capabilities = HOME_RUNTIME_CAPABILITIES[options.mode];
    this.effectExecutors = options.effectExecutors ?? {};
    this.commitBudget = new HomeStoreCommitBudget({
      ...options.commitBudget,
      onSnapshot: (snapshot) => {
        options.commitBudget?.onSnapshot?.(snapshot);
        this.logCommitBudgetPerf(snapshot);
      },
    });
    this.leafPool = new HomeLeafRequestPool(
      platformEnv.isNative ? 4 : 8,
      this.identity.clientInstanceId,
      64,
      () => readHomeStoreState(this.store.get).session.ownerToken?.sessionId,
    );
    this.scheduler = new HomeRequestScheduler({
      maxPending: 64,
      maxRunning: 4,
      onSnapshot: (snapshot) => {
        options.onSchedulerSnapshot?.(snapshot);
        this.logSchedulerPerf(snapshot);
      },
      requestLeaf:
        options.requestLeaf ?? (async () => createUnavailableLeafResponse()),
    });
    this.middleware = new HomeEffectMiddleware({
      handlers: {
        cancelSession: async (effect, context) => {
          this.cancelSessionWork(effect.effect.sessionId);
          await this.effectExecutors.cancelSession?.(effect, context);
        },
        connectRuntime: (effect, context) =>
          this.effectExecutors.connectRuntime?.(effect, context),
        executeCommand: (effect, context) =>
          this.effectExecutors.executeCommand?.(effect, context),
        reconcileSourcePlan: (effect, context) =>
          this.effectExecutors.reconcileSourcePlan?.(effect, context),
        recoverRuntime: (effect, context) =>
          this.effectExecutors.recoverRuntime?.(effect, context),
        traceReject: (effect, context) =>
          this.effectExecutors.traceReject?.(effect, context),
      },
      dispatchCompletion: ({ effect, error, value }) => {
        if (effect.effect.kind !== 'executeCommand' || !effect.correlationId) {
          return;
        }
        this.completeCommand(
          effect.correlationId,
          error
            ? { kind: 'failed', errorCode: 'commandExecutionFailed' }
            : { kind: 'completed', value },
        );
      },
    });
    this.sources = new HomeSourceRuntime(this);
    this.persistence = new HomePersistenceRuntime(this);
    this.snapshots = new HomeSnapshotRuntime(
      {
        publishHydration: ({ loadState, ownerToken, records, snapshot }) => {
          const hydrationRecords = snapshot?.records ?? records ?? [];
          this.applyEvents(
            snapshot || records
              ? [
                  {
                    type: 'displaySnapshotHydrated',
                    ownerScopeKey: ownerToken.scopeKey,
                    sessionId: ownerToken.sessionId,
                    records: hydrationRecords,
                    shell: snapshot?.shell,
                    navigation: snapshot?.navigation,
                  },
                ]
              : [],
            loadState,
          );
        },
      },
      this.capabilities.persistence,
    );
  }

  setEffectExecutors(effectExecutors: IHomeRuntimeEffectExecutors): void {
    this.effectExecutors = effectExecutors;
  }

  readonly dispatch = (event: IHomeStoreEvent): IHomeDispatchReceipt => {
    return this.dispatchAtomically([event]);
  };

  readonly dispatchAtomically = (
    events: readonly IHomeStoreEvent[],
  ): IHomeDispatchReceipt => {
    return this.applyEvents(events);
  };

  readonly replaceOwner = (
    owner: IHomeRuntimeOwnerScope | undefined,
    labels: IHomeOwnerPerfLabels = {},
    headerAccountPresentation?: IHomeHeaderAccountPresentation,
  ): IHomeDispatchReceipt => {
    const startedAt = Date.now();
    const state = this.getState();
    const transition = transitionHomeSession(state.session, {
      type: 'ownerChanged',
      owner,
    });
    if (transition.state === state.session) {
      return { accepted: true };
    }
    const previousLabels = this.ownerPerfLabels;
    const logFunctionTiming = (
      functionName: string,
      durationMs: number,
      outcome?: string,
    ) => {
      defaultLogger.wallet.homeFramePerf.frame({
        stage: 'functionTiming',
        functionName,
        durationMs,
        previousWalletName: previousLabels.walletName,
        previousAccountName: previousLabels.accountName,
        walletName: labels.walletName,
        accountName: labels.accountName,
        outcome,
      });
    };
    const logTransition = ({
      stage,
      cacheOutcome,
      storeCommitId,
    }: {
      stage: 'started' | 'cachePrepared' | 'storeCommitted';
      cacheOutcome?: 'hit' | 'miss' | 'async' | 'disabled' | 'ownerCleared';
      storeCommitId?: number;
    }) => {
      defaultLogger.wallet.homeOwnerPerf.transition({
        stage,
        previousWalletName: previousLabels.walletName,
        previousAccountName: previousLabels.accountName,
        walletName: labels.walletName,
        accountName: labels.accountName,
        cacheOutcome,
        elapsedMs: Date.now() - startedAt,
        storeCommitId,
      });
    };
    logTransition({ stage: 'started' });
    // Never retain the previous sessionId across an owner replacement.
    const ownerToken = transition.state.ownerToken;
    const previousSessionId = state.session.ownerToken?.sessionId;
    if (previousSessionId && previousSessionId !== ownerToken?.sessionId) {
      this.cancelSessionWork(previousSessionId);
    }
    this.ownerPerfLabels = labels;
    if (!ownerToken) {
      this.snapshots.adoptPreparedOwner(undefined);
      const receipt = this.applyEvents(
        [
          {
            type: 'ownerChanged',
            owner,
            headerAccountPresentation,
            topology: state.runtime.topology,
          },
        ],
        { status: 'idle' },
      );
      logTransition({
        stage: 'storeCommitted',
        cacheOutcome: 'ownerCleared',
        storeCommitId: this.getState().commitIdentity.storeCommitId,
      });
      return receipt;
    }
    if (!this.capabilities.displaySnapshots) {
      this.snapshots.adoptPreparedOwner(ownerToken);
      const receipt = this.applyEvents([
        {
          type: 'ownerChanged',
          owner,
          ownerToken,
          headerAccountPresentation,
          topology: state.runtime.topology,
        },
      ]);
      logTransition({
        stage: 'storeCommitted',
        cacheOutcome: 'disabled',
        storeCommitId: this.getState().commitIdentity.storeCommitId,
      });
      return receipt;
    }
    const prepareOwnerStartedAt = performance.now();
    const prepared = this.snapshots.prepareOwner(ownerToken.scopeKey);
    let prepareOwnerOutcome = 'miss';
    if (prepared instanceof Promise) {
      prepareOwnerOutcome = 'async';
    } else if (prepared) {
      prepareOwnerOutcome = 'hit';
    }
    logFunctionTiming(
      'HomeSnapshotRuntime.prepareOwner',
      performance.now() - prepareOwnerStartedAt,
      prepareOwnerOutcome,
    );
    if (prepared instanceof Promise) {
      logTransition({ stage: 'cachePrepared', cacheOutcome: 'async' });
      this.snapshots.adoptPreparedOwner(ownerToken);
      const receipt = this.applyEvents(
        [
          {
            type: 'ownerChanged',
            owner,
            ownerToken,
            headerAccountPresentation,
            topology: state.runtime.topology,
          },
        ],
        {
          ownerScopeKey: ownerToken.scopeKey,
          sessionId: ownerToken.sessionId,
          status: 'loading',
        },
      );
      logTransition({
        stage: 'storeCommitted',
        cacheOutcome: 'async',
        storeCommitId: this.getState().commitIdentity.storeCommitId,
      });
      void prepared.then(
        (snapshot) => this.snapshots.publishPreparedOwner(ownerToken, snapshot),
        () => this.snapshots.publishPreparedOwner(ownerToken, undefined),
      );
      return receipt;
    }
    logTransition({
      stage: 'cachePrepared',
      cacheOutcome: prepared ? 'hit' : 'miss',
    });
    this.snapshots.adoptPreparedOwner(ownerToken, prepared);
    // Replace owner-scoped Store slices atomically; never reinterpret or
    // mutate the previous owner's Store data as data for the target owner.
    const events: IHomeStoreEvent[] = [
      {
        type: 'ownerChanged',
        owner,
        ownerToken,
        headerAccountPresentation,
        topology: state.runtime.topology,
      },
    ];
    if (prepared) {
      if (platformEnv.isNativeIOS) {
        this.sources.deferAutomaticReconcileUntilCachedFrame(
          ownerToken.sessionId,
        );
      }
      events.push({
        type: 'displaySnapshotHydrated',
        ownerScopeKey: ownerToken.scopeKey,
        sessionId: ownerToken.sessionId,
        records: prepared.records,
        shell: prepared.shell,
        navigation: prepared.navigation,
      });
    }
    const receipt = this.applyEvents(events, {
      ownerScopeKey: ownerToken.scopeKey,
      sessionId: ownerToken.sessionId,
      status: prepared ? 'hit' : 'miss',
    });
    logTransition({
      stage: 'storeCommitted',
      cacheOutcome: prepared ? 'hit' : 'miss',
      storeCommitId: this.getState().commitIdentity.storeCommitId,
    });
    return receipt;
  };

  private applyEvents(
    events: readonly IHomeStoreEvent[],
    displaySnapshotLoadState?: IHomeDisplaySnapshotLoadState,
  ): IHomeDispatchReceipt {
    if (this.disposed) {
      return { accepted: false, rejectReason: 'runtimeDisposed' };
    }
    const measureOwnerTransition = events.some(
      (event) => event.type === 'ownerChanged',
    );
    const applyEventsStartedAt = performance.now();
    const logFunctionTiming = (
      functionName: string,
      durationMs: number,
      extra: {
        effectCount?: number;
        outcome?: string;
      } = {},
    ) => {
      if (!measureOwnerTransition) {
        return;
      }
      defaultLogger.wallet.homeFramePerf.frame({
        stage: 'functionTiming',
        functionName,
        durationMs,
        walletName: this.ownerPerfLabels.walletName,
        accountName: this.ownerPerfLabels.accountName,
        eventCount: events.length,
        effectCount: extra.effectCount,
        outcome: extra.outcome,
      });
    };
    this.eventSequence += 1;
    const eventSequence = this.eventSequence;
    let stepStartedAt = performance.now();
    const effects = dispatchHomeStoreEventsTransaction.call(this.store.set, {
      events,
      displaySnapshotLoadState,
    });
    logFunctionTiming(
      'dispatchHomeStoreEventsTransaction',
      performance.now() - stepStartedAt,
      { effectCount: effects.length },
    );
    stepStartedAt = performance.now();
    const snapshot = readHomeStoreState(this.store.get);
    logFunctionTiming('readHomeStoreState', performance.now() - stepStartedAt);
    if (this.persistence) {
      stepStartedAt = performance.now();
      this.persistence.onStoreCommit(snapshot);
      logFunctionTiming(
        'HomePersistenceRuntime.onStoreCommit',
        performance.now() - stepStartedAt,
      );
    }
    if (this.snapshots) {
      stepStartedAt = performance.now();
      this.snapshots.onStoreCommit(snapshot);
      logFunctionTiming(
        'HomeSnapshotRuntime.onStoreCommit',
        performance.now() - stepStartedAt,
      );
    }
    const sessionId = snapshot.session.ownerToken?.sessionId ?? 'idle';
    stepStartedAt = performance.now();
    const envelopes = effects.map<IHomeEffectEnvelope>((effect, index) => ({
      effectId: `${this.identity.runtimeInstanceId}:${eventSequence}:${index}`,
      eventSequence,
      sessionId,
      correlationId:
        effect.kind === 'executeCommand' ? effect.intent.intentId : undefined,
      effect,
    }));
    logFunctionTiming(
      'HomeRuntimeLease.buildEffectEnvelopes',
      performance.now() - stepStartedAt,
      { effectCount: effects.length },
    );
    stepStartedAt = performance.now();
    this.middleware.enqueue(envelopes);
    logFunctionTiming(
      'HomeEffectMiddleware.enqueue',
      performance.now() - stepStartedAt,
      { effectCount: effects.length },
    );
    const rejected = effects.find(
      (effect): effect is Extract<IHomeStoreEffect, { kind: 'traceReject' }> =>
        effect.kind === 'traceReject',
    );
    const receipt = rejected
      ? {
          accepted: false,
          correlationId: rejected.intentId,
          rejectReason: rejected.reason,
        }
      : {
          accepted: true,
          correlationId: events.find(
            (candidate) => candidate.type === 'intentReceived',
          )?.intent.intentId,
        };
    logFunctionTiming(
      'HomeRuntimeLease.applyEvents',
      performance.now() - applyEventsStartedAt,
      {
        effectCount: effects.length,
        outcome: receipt.accepted ? 'accepted' : 'rejected',
      },
    );
    return receipt;
  }

  readonly executeIntent = <TResult>(
    intent: IHomeStoreIntent,
  ): IHomeCommandExecution<TResult> => {
    if (this.disposed) {
      return {
        receipt: { accepted: false, rejectReason: 'runtimeDisposed' },
        completion: Promise.resolve({
          kind: 'cancelled',
          reason: 'disposed',
        }),
      };
    }
    let resolveCompletion:
      | ((completion: IHomeCommandCompletion<TResult>) => void)
      | undefined;
    const completion = new Promise<IHomeCommandCompletion<TResult>>(
      (resolve) => {
        resolveCompletion = resolve;
      },
    );
    this.pendingCommands.set(intent.intentId, {
      sessionId: intent.sessionId,
      timeout: setTimeout(() => {
        this.completeCommand(intent.intentId, { kind: 'timedOut' });
      }, HOME_COMMAND_TIMEOUT_MS),
      resolve: (result) => {
        resolveCompletion?.(result as IHomeCommandCompletion<TResult>);
      },
    });
    const receipt = this.dispatch({
      type: 'intentReceived',
      intent,
    });
    if (!receipt.accepted) {
      this.completeCommand(intent.intentId, {
        kind: 'failed',
        errorCode: receipt.rejectReason ?? 'commandRejected',
      });
    }
    return { receipt, completion };
  };

  getStore(): IJotaiContextStore {
    return this.store;
  }

  getState() {
    return readHomeStoreState(this.store.get);
  }

  getStateView() {
    return readHomeStoreStateLazily(this.store.get);
  }

  getMode(): IHomeRuntimeMode {
    return this.mode;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.cancelPendingCommands(undefined, 'disposed');
    this.snapshots.dispose();
    this.persistence.dispose();
    this.sources.dispose();
    this.scheduler.dispose();
    this.leafPool.dispose();
    this.commitBudget.dispose();
    this.middleware.dispose();
  }

  private completeCommand(
    intentId: string,
    completion: IHomeCommandCompletion<unknown>,
  ): void {
    const pending = this.pendingCommands.get(intentId);
    if (!pending) {
      return;
    }
    this.pendingCommands.delete(intentId);
    clearTimeout(pending.timeout);
    pending.resolve(completion);
  }

  private cancelPendingCommands(
    sessionId: string | undefined,
    reason: 'ownerChanged' | 'disposed' | 'superseded',
  ): void {
    Array.from(this.pendingCommands.entries()).forEach(
      ([intentId, pending]) => {
        if (sessionId === undefined || pending.sessionId === sessionId) {
          this.completeCommand(intentId, { kind: 'cancelled', reason });
        }
      },
    );
  }

  private cancelSessionWork(sessionId: string): void {
    this.sources.cancelSession(sessionId);
    this.commitBudget.discardAuthority({ sessionId });
    this.cancelPendingCommands(sessionId, 'ownerChanged');
  }

  private logSchedulerPerf(snapshot: IHomeRequestSchedulerSnapshot): void {
    const snapshotKey = `${snapshot.pendingCount}:${snapshot.runningCount}:${snapshot.peakPendingCount}:${snapshot.peakRunningCount}`;
    if (snapshotKey === this.lastSchedulerPerfSnapshot) {
      return;
    }
    const now = Date.now();
    const atBoundary =
      snapshot.disposed ||
      snapshot.pendingCount === 0 ||
      snapshot.runningCount === 0;
    if (!atBoundary && now - this.lastSchedulerPerfLogAt < 100) {
      return;
    }
    this.lastSchedulerPerfSnapshot = snapshotKey;
    this.lastSchedulerPerfLogAt = now;
    defaultLogger.wallet.homeSchedulerPerf.snapshot({
      stage: 'requestQueue',
      walletName: this.ownerPerfLabels.walletName,
      accountName: this.ownerPerfLabels.accountName,
      pendingCount: snapshot.pendingCount,
      runningCount: snapshot.runningCount,
      peakPendingCount: snapshot.peakPendingCount,
      peakRunningCount: snapshot.peakRunningCount,
    });
  }

  private logCommitBudgetPerf(snapshot: IHomeStoreCommitBudgetSnapshot): void {
    const snapshotKey = `${snapshot.bufferedCount}:${snapshot.committedCount}:${snapshot.peakBufferedCount}`;
    if (snapshotKey === this.lastCommitBudgetPerfSnapshot) {
      return;
    }
    const now = Date.now();
    if (
      snapshot.bufferedCount !== 0 &&
      now - this.lastCommitBudgetPerfLogAt < 100
    ) {
      return;
    }
    this.lastCommitBudgetPerfSnapshot = snapshotKey;
    this.lastCommitBudgetPerfLogAt = now;
    defaultLogger.wallet.homeFramePerf.frame({
      stage: 'commitBudget',
      walletName: this.ownerPerfLabels.walletName,
      accountName: this.ownerPerfLabels.accountName,
      bufferedCount: snapshot.bufferedCount,
      committedCount: snapshot.committedCount,
      peakBufferedCount: snapshot.peakBufferedCount,
    });
  }
}

export interface IHomeRuntimeLease {
  runtime: HomeStoreRuntime;
  retain(): void;
  release(): void;
}

export function acquireHomeRuntime(
  store: IJotaiContextStore,
  options: IAcquireHomeRuntimeOptions,
): IHomeRuntimeLease {
  const existing = runtimeByStore.get(store);
  if (existing) {
    if (existing.mode !== options.mode) {
      throw new OneKeyLocalError('A Home Store cannot change runtime mode');
    }
    existing.refCount += 1;
    existing.disposeScheduled = false;
    existing.runtime.setEffectExecutors(options.effectExecutors ?? {});
    return createLease(store, existing);
  }
  const entry: IHomeRuntimeLeaseEntry = {
    mode: options.mode,
    refCount: 1,
    disposeScheduled: false,
    runtime: new HomeStoreRuntime(store, options),
    unregisterDispatcher: () => undefined,
  };
  entry.unregisterDispatcher = registerHomeRuntimeDispatcher(
    store,
    entry.runtime,
  );
  runtimeByStore.set(store, entry);
  return createLease(store, entry);
}

function createLease(
  store: IJotaiContextStore,
  entry: IHomeRuntimeLeaseEntry,
): IHomeRuntimeLease {
  let active = true;
  let releasePending = false;
  return {
    runtime: entry.runtime,
    retain() {
      if (active) {
        return;
      }
      active = true;
      if (releasePending) {
        releasePending = false;
        entry.disposeScheduled = false;
        return;
      }
      const current = runtimeByStore.get(store);
      if (current !== entry) {
        throw new OneKeyLocalError(
          'A disposed Home runtime lease cannot be retained',
        );
      }
      entry.refCount += 1;
      entry.disposeScheduled = false;
    },
    release() {
      if (!active || releasePending) {
        return;
      }
      active = false;
      releasePending = true;
      queueMicrotask(() => {
        if (!releasePending || active) {
          return;
        }
        releasePending = false;
        entry.refCount = Math.max(0, entry.refCount - 1);
        if (entry.refCount > 0 || entry.disposeScheduled) {
          return;
        }
        entry.disposeScheduled = true;
        const current = runtimeByStore.get(store);
        if (
          current === entry &&
          current.refCount === 0 &&
          current.disposeScheduled
        ) {
          current.runtime.dispatch({
            type: 'sessionEvent',
            event: { type: 'stopped' },
          });
          current.runtime.dispose();
          current.unregisterDispatcher();
          runtimeByStore.delete(store);
        }
      });
    },
  };
}

export function getHomeRuntime(
  store: IJotaiContextStore,
): HomeStoreRuntime | undefined {
  return runtimeByStore.get(store)?.runtime;
}

export type { IHomeStoreRejectReason };
