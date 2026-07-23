import type {
  IHomeRuntimeOwnerToken,
  IHomeRuntimeSourceId,
} from '@onekeyhq/shared/src/types/homeRuntime';

import type {
  IHomeSectionId,
  IHomeSectionSemanticModel,
} from '../semantic/homeSemanticTypes';

type IHomeSectionSourceIdentity = {
  owner: IHomeRuntimeOwnerToken;
  sectionId: IHomeSectionId;
  sourceId: IHomeRuntimeSourceId;
  sourceKeyIdentity: string;
  producerInstanceId: string;
  sourceRevision: number;
};

type IHomeSectionCoordinatorEvent<T> =
  | (IHomeSectionSourceIdentity & { kind: 'loading'; requestSeq: number })
  | (IHomeSectionSourceIdentity & {
      kind: 'seedConfirmed';
      requestSeq: number;
      data: T;
      rowIds: readonly string[];
      refresh: 'idle' | 'refreshing';
    })
  | (IHomeSectionSourceIdentity & {
      kind: 'partial';
      requestSeq: number;
      coverageFingerprint: string;
    })
  | (IHomeSectionSourceIdentity & {
      kind: 'complete';
      requestSeq: number;
      coverageFingerprint: string;
      result:
        | { kind: 'empty' }
        | { kind: 'success'; data: T; rowIds: readonly string[] };
    })
  | (IHomeSectionSourceIdentity & {
      kind: 'error';
      requestSeq: number;
      errorKind:
        | 'source'
        | 'transport'
        | 'schemaMismatch'
        | 'runtimeUnavailable';
    });

type IHomeSectionAuthoritativePayload<T> =
  | { kind: 'none' }
  | { kind: 'live'; data: T }
  | { kind: 'confirmedCache'; data: T };

type IHomeSectionCoordinatorResolution<T> = {
  accepted: boolean;
  staleReason?:
    | 'disposed'
    | 'ownerMismatch'
    | 'sectionMismatch'
    | 'sourceMismatch'
    | 'producerMismatch'
    | 'sourceRevisionStale'
    | 'requestStale';
  semantic: IHomeSectionSemanticModel;
  authoritative: IHomeSectionAuthoritativePayload<T>;
};

type IHomeSectionCacheRecord<T> = {
  identity: string;
  data: T;
  rowIds: readonly string[];
};

const MAX_CACHE_ENTRIES = 8;

function identityKey(sectionId: IHomeSectionId, sourceKeyIdentity: string) {
  return `${sectionId.length}:${sectionId}${sourceKeyIdentity}`;
}

class HomeSectionCoordinator<T> {
  private identity: IHomeSectionSourceIdentity;

  private requestSeq = 0;

  private requestPhase = 0;

  private disposed = false;

  private readonly cache = new Map<string, IHomeSectionCacheRecord<T>>();

  private resolution: IHomeSectionCoordinatorResolution<T>;

  constructor(identity: IHomeSectionSourceIdentity) {
    this.identity = identity;
    this.resolution = {
      accepted: true,
      semantic: { kind: 'loading', placeholder: identity.sectionId },
      authoritative: { kind: 'none' },
    };
  }

  setOwner(identity: IHomeSectionSourceIdentity): void {
    if (this.disposed || sameIdentity(this.identity, identity)) {
      return;
    }
    this.identity = identity;
    this.requestSeq = 0;
    this.requestPhase = 0;
    this.resolution = {
      accepted: true,
      semantic: { kind: 'loading', placeholder: identity.sectionId },
      authoritative: { kind: 'none' },
    };
  }

  dispatch(
    event: IHomeSectionCoordinatorEvent<T>,
  ): IHomeSectionCoordinatorResolution<T> {
    const staleReason = this.validate(event);
    if (staleReason) {
      return { ...this.resolution, accepted: false, staleReason };
    }
    if (event.requestSeq > this.requestSeq) {
      this.requestPhase = 0;
    }
    this.requestSeq = event.requestSeq;
    this.requestPhase = eventPhase(event);
    if (event.kind === 'seedConfirmed') {
      const record = {
        identity: identityKey(event.sectionId, event.sourceKeyIdentity),
        data: event.data,
        rowIds: event.rowIds,
      };
      this.writeCache(record);
      this.resolution = {
        accepted: true,
        semantic: {
          kind: 'ready',
          rowIds: record.rowIds,
          freshness: 'confirmedCache',
          refresh: event.refresh,
        },
        authoritative: { kind: 'confirmedCache', data: record.data },
      };
      return this.resolution;
    }
    if (event.kind === 'loading' || event.kind === 'partial') {
      const cached = this.readCache(event);
      this.resolution = cached
        ? {
            accepted: true,
            semantic: {
              kind: 'ready',
              rowIds: cached.rowIds,
              freshness: 'confirmedCache',
              refresh: 'refreshing',
            },
            authoritative: { kind: 'confirmedCache', data: cached.data },
          }
        : {
            accepted: true,
            semantic: { kind: 'loading', placeholder: event.sectionId },
            authoritative: { kind: 'none' },
          };
      return this.resolution;
    }
    if (event.kind === 'error') {
      const cached = this.readCache(event);
      this.resolution = cached
        ? {
            accepted: true,
            semantic: {
              kind: 'ready',
              rowIds: cached.rowIds,
              freshness: 'confirmedCache',
              refresh: 'failed',
            },
            authoritative: { kind: 'confirmedCache', data: cached.data },
          }
        : {
            accepted: true,
            semantic: { kind: 'error', errorState: event.sectionId },
            authoritative: { kind: 'none' },
          };
      return this.resolution;
    }
    if (event.result.kind === 'empty') {
      this.deleteCache(event);
      this.resolution = {
        accepted: true,
        semantic: { kind: 'empty', emptyState: event.sectionId },
        authoritative: { kind: 'none' },
      };
      return this.resolution;
    }
    const record = {
      identity: identityKey(event.sectionId, event.sourceKeyIdentity),
      data: event.result.data,
      rowIds: event.result.rowIds,
    };
    this.writeCache(record);
    this.resolution = {
      accepted: true,
      semantic: {
        kind: 'ready',
        rowIds: record.rowIds,
        freshness: 'live',
        refresh: 'idle',
      },
      authoritative: { kind: 'live', data: record.data },
    };
    return this.resolution;
  }

  getSnapshot(): IHomeSectionCoordinatorResolution<T> {
    return this.resolution;
  }

  dispose(): void {
    this.disposed = true;
  }

  private validate(
    event: IHomeSectionCoordinatorEvent<T>,
  ): IHomeSectionCoordinatorResolution<T>['staleReason'] {
    if (this.disposed) return 'disposed';
    if (
      event.owner.scopeKey !== this.identity.owner.scopeKey ||
      event.owner.sessionId !== this.identity.owner.sessionId
    )
      return 'ownerMismatch';
    if (event.sectionId !== this.identity.sectionId) return 'sectionMismatch';
    if (
      event.sourceId !== this.identity.sourceId ||
      event.sourceKeyIdentity !== this.identity.sourceKeyIdentity
    )
      return 'sourceMismatch';
    if (event.producerInstanceId !== this.identity.producerInstanceId)
      return 'producerMismatch';
    if (event.sourceRevision !== this.identity.sourceRevision)
      return 'sourceRevisionStale';
    if (
      event.requestSeq < this.requestSeq ||
      (event.requestSeq === this.requestSeq &&
        (eventPhase(event) < this.requestPhase || this.requestPhase === 2))
    )
      return 'requestStale';
    return undefined;
  }

  private readCache(event: IHomeSectionSourceIdentity) {
    const key = identityKey(event.sectionId, event.sourceKeyIdentity);
    const record = this.cache.get(key);
    if (record) {
      this.cache.delete(key);
      this.cache.set(key, record);
    }
    return record;
  }

  private writeCache(record: IHomeSectionCacheRecord<T>) {
    this.cache.delete(record.identity);
    this.cache.set(record.identity, record);
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (!oldest) break;
      this.cache.delete(oldest);
    }
  }

  private deleteCache(identity: IHomeSectionSourceIdentity) {
    this.cache.delete(
      identityKey(identity.sectionId, identity.sourceKeyIdentity),
    );
  }
}

function sameIdentity(
  first: IHomeSectionSourceIdentity,
  second: IHomeSectionSourceIdentity,
): boolean {
  return (
    first.owner.scopeKey === second.owner.scopeKey &&
    first.owner.sessionId === second.owner.sessionId &&
    first.sectionId === second.sectionId &&
    first.sourceId === second.sourceId &&
    first.sourceKeyIdentity === second.sourceKeyIdentity &&
    first.producerInstanceId === second.producerInstanceId &&
    first.sourceRevision === second.sourceRevision
  );
}

function eventPhase<T>(event: IHomeSectionCoordinatorEvent<T>): number {
  if (event.kind === 'loading' || event.kind === 'seedConfirmed') return 0;
  if (event.kind === 'partial') return 1;
  return 2;
}

export { HomeSectionCoordinator };
export type {
  IHomeSectionAuthoritativePayload,
  IHomeSectionCoordinatorEvent,
  IHomeSectionCoordinatorResolution,
  IHomeSectionSourceIdentity,
};
