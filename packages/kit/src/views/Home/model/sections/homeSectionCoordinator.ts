import type {
  IHomeRuntimeOwnerToken,
  IHomeRuntimeSourceId,
} from '@onekeyhq/shared/src/types/homeRuntime';

import type { IHomeDataPriority } from '../core/homeDataPriority';
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
  | (IHomeSectionSourceIdentity & { kind: 'loading' })
  | (IHomeSectionSourceIdentity & {
      kind: 'seedConfirmed';
      data: T;
      rowIds: readonly string[];
      refresh: 'idle' | 'refreshing';
    })
  | (IHomeSectionSourceIdentity & { kind: 'partial' })
  | (IHomeSectionSourceIdentity & {
      kind: 'complete';
      result:
        | { kind: 'empty' }
        | { kind: 'success'; data: T; rowIds: readonly string[] };
    })
  | (IHomeSectionSourceIdentity & { kind: 'error' });

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
    | 'sourceRevisionStale';
  semantic: IHomeSectionSemanticModel;
  authoritative: IHomeSectionAuthoritativePayload<T>;
};

type IHomeSectionCacheRecord<T> = {
  identity: string;
  data: T;
  rowIds: readonly string[];
  priority: IHomeDataPriority;
};

const MAX_CACHE_ENTRIES = 8;

function identityKey(identity: IHomeSectionSourceIdentity) {
  return [
    identity.owner.scopeKey,
    identity.owner.sessionId,
    identity.sectionId,
    identity.sourceId,
    identity.sourceKeyIdentity,
    identity.producerInstanceId,
    String(identity.sourceRevision),
  ]
    .map((part) => `${part.length}:${part}`)
    .join('');
}

function authoritativeFromRecord<T>(
  record: IHomeSectionCacheRecord<T>,
): IHomeSectionAuthoritativePayload<T> {
  return record.priority === 1
    ? { kind: 'live', data: record.data }
    : { kind: 'confirmedCache', data: record.data };
}

class HomeSectionCoordinator<T> {
  private identity: IHomeSectionSourceIdentity;

  private disposed = false;

  private readonly cache = new Map<string, IHomeSectionCacheRecord<T>>();

  private appliedPriority: IHomeDataPriority | undefined;

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
    this.appliedPriority = undefined;
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
    if (event.kind === 'seedConfirmed') {
      if (this.appliedPriority === 1) {
        return { ...this.resolution, accepted: true };
      }
      const record = this.writeCache({
        identity: identityKey(event),
        data: event.data,
        rowIds: event.rowIds,
        priority: 0,
      });
      this.appliedPriority = record.priority;
      this.resolution = {
        accepted: true,
        semantic: {
          kind: 'ready',
          rowIds: record.rowIds,
          priority: record.priority,
          refresh: event.refresh,
        },
        authoritative: authoritativeFromRecord(record),
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
              priority: cached.priority,
              refresh: 'refreshing',
            },
            authoritative: authoritativeFromRecord(cached),
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
              priority: cached.priority,
              refresh: 'failed',
            },
            authoritative: authoritativeFromRecord(cached),
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
      this.appliedPriority = 1;
      this.resolution = {
        accepted: true,
        semantic: { kind: 'empty', emptyState: event.sectionId },
        authoritative: { kind: 'none' },
      };
      return this.resolution;
    }
    const record = this.writeCache({
      identity: identityKey(event),
      data: event.result.data,
      rowIds: event.result.rowIds,
      priority: 1,
    });
    this.appliedPriority = record.priority;
    this.resolution = {
      accepted: true,
      semantic: {
        kind: 'ready',
        rowIds: record.rowIds,
        priority: record.priority,
        refresh: 'idle',
      },
      authoritative: authoritativeFromRecord(record),
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
    return undefined;
  }

  private readCache(event: IHomeSectionSourceIdentity) {
    const key = identityKey(event);
    const record = this.cache.get(key);
    if (record) {
      this.cache.delete(key);
      this.cache.set(key, record);
    }
    return record;
  }

  private writeCache(
    record: IHomeSectionCacheRecord<T>,
  ): IHomeSectionCacheRecord<T> {
    const current = this.cache.get(record.identity);
    if (current && current.priority > record.priority) {
      this.cache.delete(record.identity);
      this.cache.set(record.identity, current);
      return current;
    }
    this.cache.delete(record.identity);
    this.cache.set(record.identity, record);
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (!oldest) break;
      this.cache.delete(oldest);
    }
    return record;
  }

  private deleteCache(identity: IHomeSectionSourceIdentity) {
    this.cache.delete(identityKey(identity));
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

export { HomeSectionCoordinator };
export type {
  IHomeSectionAuthoritativePayload,
  IHomeSectionCoordinatorEvent,
  IHomeSectionCoordinatorResolution,
  IHomeSectionSourceIdentity,
};
