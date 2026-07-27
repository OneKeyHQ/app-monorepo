import {
  dispatchHomeStoreEventsAtomically,
  readHomeStoreState,
  readHomeStoreStateLazily,
} from '@onekeyhq/kit/src/states/jotai/contexts/home/actions';
import type { IHomeDisplaySnapshotLoadState } from '@onekeyhq/kit/src/states/jotai/contexts/home/atoms';
import type { IJotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IHomeRuntimeJsonValue,
  IHomeRuntimeOwnerScope,
  IRuntimeLeafResponseEnvelope,
} from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { HomeSnapshotRuntime } from '../cacheV2/homeSnapshotRuntime';
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
} from '../results/homeStoreCommitBudget';
import { HomeLeafRequestPool } from '../scheduler/homeLeafRequestPool';
import {
  HomeRequestScheduler,
  type IHomeRequestSchedulerOptions,
} from '../scheduler/homeRequestScheduler';
import { HomeSourceRuntime } from '../sources/homeSourceRuntime';

import { registerHomeRuntimeDispatcher } from './homeRuntimeRegistry';

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
    this.commitBudget = new HomeStoreCommitBudget(options.commitBudget);
    this.leafPool = new HomeLeafRequestPool(
      platformEnv.isNative ? 4 : 8,
      this.identity.clientInstanceId,
      64,
      () => readHomeStoreState(this.store.get).session.ownerToken?.sessionId,
    );
    this.scheduler = new HomeRequestScheduler({
      maxPending: 64,
      maxRunning: 4,
      onSnapshot: options.onSchedulerSnapshot,
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
  ): IHomeDispatchReceipt => {
    const state = this.getState();
    const transition = transitionHomeSession(state.session, {
      type: 'ownerChanged',
      owner,
    });
    if (transition.state === state.session) {
      return { accepted: true };
    }
    // Never retain the previous sessionId across an owner replacement.
    const ownerToken = transition.state.ownerToken;
    const previousSessionId = state.session.ownerToken?.sessionId;
    if (previousSessionId && previousSessionId !== ownerToken?.sessionId) {
      this.cancelSessionWork(previousSessionId);
    }
    if (!ownerToken) {
      this.snapshots.adoptPreparedOwner(undefined);
      return this.applyEvents(
        [
          {
            type: 'ownerChanged',
            owner,
            topology: state.runtime.topology,
          },
        ],
        { status: 'idle' },
      );
    }
    if (!this.capabilities.displaySnapshots) {
      this.snapshots.adoptPreparedOwner(ownerToken);
      return this.applyEvents([
        {
          type: 'ownerChanged',
          owner,
          ownerToken,
          topology: state.runtime.topology,
        },
      ]);
    }
    const prepared = this.snapshots.prepareOwner(ownerToken.scopeKey);
    if (prepared instanceof Promise) {
      this.snapshots.adoptPreparedOwner(ownerToken);
      const receipt = this.applyEvents(
        [
          {
            type: 'ownerChanged',
            owner,
            ownerToken,
            topology: state.runtime.topology,
          },
        ],
        {
          ownerScopeKey: ownerToken.scopeKey,
          sessionId: ownerToken.sessionId,
          status: 'loading',
        },
      );
      void prepared.then(
        (snapshot) => this.snapshots.publishPreparedOwner(ownerToken, snapshot),
        () => this.snapshots.publishPreparedOwner(ownerToken, undefined),
      );
      return receipt;
    }
    this.snapshots.adoptPreparedOwner(ownerToken, prepared);
    // Replace owner-scoped Store slices atomically; never reinterpret or
    // mutate the previous owner's Store data as data for the target owner.
    const events: IHomeStoreEvent[] = [
      {
        type: 'ownerChanged',
        owner,
        ownerToken,
        topology: state.runtime.topology,
      },
    ];
    if (prepared) {
      events.push({
        type: 'displaySnapshotHydrated',
        ownerScopeKey: ownerToken.scopeKey,
        sessionId: ownerToken.sessionId,
        records: prepared.records,
        shell: prepared.shell,
        navigation: prepared.navigation,
      });
    }
    return this.applyEvents(events, {
      ownerScopeKey: ownerToken.scopeKey,
      sessionId: ownerToken.sessionId,
      status: prepared ? 'hit' : 'miss',
    });
  };

  private applyEvents(
    events: readonly IHomeStoreEvent[],
    displaySnapshotLoadState?: IHomeDisplaySnapshotLoadState,
  ): IHomeDispatchReceipt {
    if (this.disposed) {
      return { accepted: false, rejectReason: 'runtimeDisposed' };
    }
    this.eventSequence += 1;
    const eventSequence = this.eventSequence;
    const effects = dispatchHomeStoreEventsAtomically(
      this.store.get,
      this.store.set,
      { events, displaySnapshotLoadState },
    );
    const snapshot = readHomeStoreState(this.store.get);
    this.persistence?.onStoreCommit(snapshot);
    this.snapshots?.onStoreCommit(snapshot);
    const sessionId = snapshot.session.ownerToken?.sessionId ?? 'idle';
    const envelopes = effects.map<IHomeEffectEnvelope>((effect, index) => ({
      effectId: `${this.identity.runtimeInstanceId}:${eventSequence}:${index}`,
      eventSequence,
      sessionId,
      correlationId:
        effect.kind === 'executeCommand' ? effect.intent.intentId : undefined,
      effect,
    }));
    this.middleware.enqueue(envelopes);
    const rejected = effects.find(
      (effect): effect is Extract<IHomeStoreEffect, { kind: 'traceReject' }> =>
        effect.kind === 'traceReject',
    );
    return rejected
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
