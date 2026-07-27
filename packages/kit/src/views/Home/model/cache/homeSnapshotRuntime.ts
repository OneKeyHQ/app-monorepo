import type { IHomeDisplaySnapshotLoadState } from '@onekeyhq/kit/src/states/jotai/contexts/home/atoms';
import { registerColdStartFlushTrigger } from '@onekeyhq/shared/src/storage/coldStartFlushTrigger';
import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';

import { homeDisplaySnapshotPersistQueue } from './homeDisplaySnapshotPersistQueue';
import { loadHomeSnapshotSource } from './homeSnapshotLoader';
import { loadPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot';

import type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';
import type {
  IHomeCachedSourceRecord,
  IHomeStoreCommitIdentity,
  IHomeStoreSourceId,
  IHomeStoreState,
} from '../store/homeStoreTypes';

interface IHomeSnapshotRuntimeHost {
  publishHydration(input: {
    loadState: IHomeDisplaySnapshotLoadState;
    ownerToken: IHomeRuntimeOwnerToken;
    records?: readonly IHomeCachedSourceRecord[];
    snapshot?: Pick<
      IPreparedHomeDisplaySnapshot,
      'navigation' | 'records' | 'shell'
    >;
  }): void;
}

export class HomeSnapshotRuntime {
  private ownerToken: IHomeRuntimeOwnerToken | undefined;

  private loadSequence = 0;

  private lastCommitId = -1;

  private context: IPreparedHomeDisplaySnapshot['context'] | undefined;

  private readonly loadedSourceIds = new Set<IHomeStoreSourceId>();

  private readonly inFlightSourceIds = new Map<
    IHomeStoreSourceId,
    Promise<void>
  >();

  private readonly unregisterFlush: () => void;

  private disposed = false;

  constructor(
    private readonly host: IHomeSnapshotRuntimeHost,
    private readonly persistenceEnabled: boolean,
  ) {
    this.unregisterFlush = persistenceEnabled
      ? registerColdStartFlushTrigger(() =>
          homeDisplaySnapshotPersistQueue.flushAndCompact(),
        )
      : () => undefined;
  }

  prepareOwner(
    ownerScopeKey: string,
  ):
    | IPreparedHomeDisplaySnapshot
    | Promise<IPreparedHomeDisplaySnapshot | undefined>
    | undefined {
    if (!this.persistenceEnabled) {
      return undefined;
    }
    return loadPreparedHomeDisplaySnapshot({ ownerScopeKey }) as
      | IPreparedHomeDisplaySnapshot
      | Promise<IPreparedHomeDisplaySnapshot | undefined>
      | undefined;
  }

  adoptPreparedOwner(
    ownerToken: IHomeRuntimeOwnerToken | undefined,
    snapshot?: IPreparedHomeDisplaySnapshot,
  ): void {
    this.loadSequence += 1;
    this.ownerToken = ownerToken;
    this.context = snapshot?.context;
    this.loadedSourceIds.clear();
    snapshot?.records.forEach((record) => {
      this.loadedSourceIds.add(record.sourceId);
    });
    this.inFlightSourceIds.clear();
  }

  publishPreparedOwner(
    ownerToken: IHomeRuntimeOwnerToken,
    snapshot: IPreparedHomeDisplaySnapshot | undefined,
  ): void {
    if (
      this.disposed ||
      ownerToken.scopeKey !== this.ownerToken?.scopeKey ||
      ownerToken.sessionId !== this.ownerToken.sessionId
    ) {
      return;
    }
    this.context = snapshot?.context;
    snapshot?.records.forEach((record) => {
      this.loadedSourceIds.add(record.sourceId);
    });
    this.host.publishHydration({
      loadState: {
        ownerScopeKey: ownerToken.scopeKey,
        sessionId: ownerToken.sessionId,
        status: snapshot ? 'hit' : 'miss',
      },
      ownerToken,
      snapshot,
    });
  }

  onStoreCommit(state: IHomeStoreState): void {
    if (this.disposed) {
      return;
    }
    const ownerToken = state.session.ownerToken;
    if (!this.persistenceEnabled) {
      if (
        ownerToken?.scopeKey !== this.ownerToken?.scopeKey ||
        ownerToken?.sessionId !== this.ownerToken?.sessionId
      ) {
        this.adoptPreparedOwner(ownerToken);
      }
      return;
    }
    if (
      ownerToken?.scopeKey !== this.ownerToken?.scopeKey ||
      ownerToken?.sessionId !== this.ownerToken?.sessionId
    ) {
      this.replaceOwner(ownerToken);
    }
    if (state.commitIdentity.storeCommitId !== this.lastCommitId) {
      this.lastCommitId = state.commitIdentity.storeCommitId;
      if (this.persistenceEnabled) {
        homeDisplaySnapshotPersistQueue.enqueue(state, state.commitIdentity);
      }
    }
    const preferredSourceId = state.interaction.preferredTabId;
    if (ownerToken && preferredSourceId) {
      void this.ensureSource(ownerToken, preferredSourceId);
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.loadSequence += 1;
    this.ownerToken = undefined;
    this.context = undefined;
    this.loadedSourceIds.clear();
    this.inFlightSourceIds.clear();
    this.unregisterFlush();
    if (this.persistenceEnabled) {
      void homeDisplaySnapshotPersistQueue.flushNow();
    }
  }

  private replaceOwner(ownerToken: IHomeRuntimeOwnerToken | undefined): void {
    this.loadSequence += 1;
    const sequence = this.loadSequence;
    this.ownerToken = ownerToken;
    this.context = undefined;
    this.loadedSourceIds.clear();
    this.inFlightSourceIds.clear();
    if (!ownerToken) {
      return;
    }
    this.host.publishHydration({
      loadState: {
        ownerScopeKey: ownerToken.scopeKey,
        sessionId: ownerToken.sessionId,
        status: 'loading',
      },
      ownerToken,
    });
    const loaded = this.prepareOwner(ownerToken.scopeKey);
    if (loaded instanceof Promise) {
      void loaded.then(
        (snapshot) => this.acceptInitial(sequence, ownerToken, snapshot),
        () => this.acceptInitial(sequence, ownerToken, undefined),
      );
    } else {
      this.acceptInitial(sequence, ownerToken, loaded);
    }
  }

  private acceptInitial(
    sequence: number,
    ownerToken: IHomeRuntimeOwnerToken,
    snapshot: IPreparedHomeDisplaySnapshot | undefined,
  ): void {
    if (!this.isCurrent(sequence, ownerToken)) {
      return;
    }
    this.context = snapshot?.context;
    snapshot?.records.forEach((record) => {
      this.loadedSourceIds.add(record.sourceId);
    });
    this.host.publishHydration({
      loadState: {
        ownerScopeKey: ownerToken.scopeKey,
        sessionId: ownerToken.sessionId,
        status: snapshot ? 'hit' : 'miss',
      },
      ownerToken,
      snapshot,
    });
  }

  private ensureSource(
    ownerToken: IHomeRuntimeOwnerToken,
    sourceId: IHomeStoreSourceId,
  ): Promise<void> {
    if (
      !this.context ||
      this.loadedSourceIds.has(sourceId) ||
      !this.context.manifest.chunks[sourceId]
    ) {
      return Promise.resolve();
    }
    const existing = this.inFlightSourceIds.get(sourceId);
    if (existing) {
      return existing;
    }
    const sequence = this.loadSequence;
    const context = this.context;
    const loaded = loadHomeSnapshotSource(context, sourceId);
    const task = Promise.resolve(loaded)
      .then((records) => {
        if (!this.isCurrent(sequence, ownerToken)) {
          return;
        }
        this.loadedSourceIds.add(sourceId);
        if (records.length > 0) {
          this.host.publishHydration({
            loadState: {
              ownerScopeKey: ownerToken.scopeKey,
              sessionId: ownerToken.sessionId,
              status: 'hit',
            },
            ownerToken,
            records,
          });
        }
      })
      .finally(() => {
        this.inFlightSourceIds.delete(sourceId);
      });
    this.inFlightSourceIds.set(sourceId, task);
    return task;
  }

  private isCurrent(
    sequence: number,
    ownerToken: IHomeRuntimeOwnerToken,
  ): boolean {
    return (
      !this.disposed &&
      sequence === this.loadSequence &&
      ownerToken.scopeKey === this.ownerToken?.scopeKey &&
      ownerToken.sessionId === this.ownerToken.sessionId
    );
  }
}

export type { IHomeStoreCommitIdentity };
