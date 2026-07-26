import type { IRuntimeRequestPriority } from '@onekeyhq/shared/src/types/homeRuntime';

import type {
  IHomeMaterializedResult,
  IHomeResultAuthority,
  IHomeResultPhase,
} from './homeResultSink';

export interface IHomeCommitPublication<TModel> {
  authority: IHomeResultAuthority;
  phase: IHomeResultPhase;
  priority: IRuntimeRequestPriority;
  publicationId: string;
  publicationRevision: number;
  materialized: IHomeMaterializedResult<TModel>;
  commit(publication: IHomeCommitPublication<TModel>): void;
}

export interface IHomeStoreCommitBudgetSnapshot {
  bufferedCount: number;
  committedCount: number;
  peakBufferedCount: number;
}

export interface IHomeStoreCommitBudgetOptions {
  maxBuffered?: number;
  maxPerDispatch?: number;
  scheduleVisibleDrain?: (callback: () => void) => () => void;
  onSnapshot?: (snapshot: IHomeStoreCommitBudgetSnapshot) => void;
}

const PRIORITY_RANK: Record<IRuntimeRequestPriority, number> = {
  interactive: 0,
  critical: 1,
  background: 2,
};

export class HomeStoreCommitBudget {
  private readonly maxBuffered: number;

  private readonly maxPerDispatch: number;

  private readonly scheduleVisibleDrain: (callback: () => void) => () => void;

  private readonly onSnapshot:
    | ((snapshot: IHomeStoreCommitBudgetSnapshot) => void)
    | undefined;

  private readonly queue: IHomeCommitPublication<unknown>[] = [];

  private readonly availabilityListeners = new Set<() => void>();

  private cancelScheduledDrain: (() => void) | undefined;

  private committedCount = 0;

  private peakBufferedCount = 0;

  private disposed = false;

  constructor({
    maxBuffered = 32,
    // A publication commits through the Store dispatcher. Keeping this at one
    // guarantees that several sources settling together cannot create several
    // visible Store dispatches in the same frame.
    maxPerDispatch = 1,
    scheduleVisibleDrain = (callback) => {
      const frame =
        typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame(callback)
          : setTimeout(callback, 0);
      return () => {
        if (typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(frame);
        } else {
          clearTimeout(frame);
        }
      };
    },
    onSnapshot,
  }: IHomeStoreCommitBudgetOptions = {}) {
    this.maxBuffered = Math.max(1, maxBuffered);
    this.maxPerDispatch = Math.max(1, maxPerDispatch);
    this.scheduleVisibleDrain = scheduleVisibleDrain;
    this.onSnapshot = onSnapshot;
  }

  reserve(): boolean {
    return !this.disposed && this.queue.length < this.maxBuffered;
  }

  subscribeAvailability(listener: () => void): () => void {
    if (this.disposed) {
      return () => undefined;
    }
    this.availabilityListeners.add(listener);
    return () => {
      this.availabilityListeners.delete(listener);
    };
  }

  submit<TModel>(publication: IHomeCommitPublication<TModel>): boolean {
    if (!this.reserve()) {
      return false;
    }
    this.coalesce(publication);
    this.queue.push(publication as IHomeCommitPublication<unknown>);
    this.peakBufferedCount = Math.max(
      this.peakBufferedCount,
      this.queue.length,
    );
    this.queue.sort(
      (left, right) =>
        PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority],
    );
    this.scheduleDrain();
    this.emitSnapshot();
    return true;
  }

  discardAuthority(authority: {
    runtimeInstanceId?: string;
    sessionId?: string;
    requestGroupId?: string;
  }): void {
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      const candidate = this.queue[index];
      if (
        (authority.runtimeInstanceId === undefined ||
          candidate.authority.runtimeInstanceId ===
            authority.runtimeInstanceId) &&
        (authority.sessionId === undefined ||
          candidate.authority.sessionId === authority.sessionId) &&
        (authority.requestGroupId === undefined ||
          candidate.authority.requestGroupId === authority.requestGroupId)
      ) {
        this.queue.splice(index, 1);
      }
    }
    this.emitSnapshot();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.cancelScheduledDrain?.();
    this.cancelScheduledDrain = undefined;
    this.queue.length = 0;
    this.availabilityListeners.clear();
    this.emitSnapshot();
  }

  getSnapshot(): IHomeStoreCommitBudgetSnapshot {
    return {
      bufferedCount: this.queue.length,
      committedCount: this.committedCount,
      peakBufferedCount: this.peakBufferedCount,
    };
  }

  private coalesce<TModel>(publication: IHomeCommitPublication<TModel>): void {
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      const candidate = this.queue[index];
      const sameSourceLane =
        candidate.authority.runtimeInstanceId ===
          publication.authority.runtimeInstanceId &&
        candidate.authority.sessionId === publication.authority.sessionId &&
        candidate.authority.sourceId === publication.authority.sourceId &&
        candidate.authority.requestGroupId ===
          publication.authority.requestGroupId;
      const sameSourceRequest =
        sameSourceLane &&
        candidate.authority.requestSequence ===
          publication.authority.requestSequence;
      const olderSourceRequest =
        sameSourceLane &&
        candidate.authority.requestSequence <
          publication.authority.requestSequence;
      if (olderSourceRequest) {
        this.queue.splice(index, 1);
      } else if (
        sameSourceRequest &&
        (candidate.phase === 'intermediate' || publication.phase === 'final')
      ) {
        this.queue.splice(index, 1);
      }
    }
  }

  private scheduleDrain(): void {
    if (this.cancelScheduledDrain || this.disposed) {
      return;
    }
    this.cancelScheduledDrain = this.scheduleVisibleDrain(() => {
      this.cancelScheduledDrain = undefined;
      this.drain();
    });
  }

  private drain(): void {
    if (this.disposed || this.queue.length === 0) {
      return;
    }
    const batch = this.queue.splice(0, this.maxPerDispatch);
    batch.forEach((publication) => {
      publication.commit(publication);
      this.committedCount += 1;
    });
    if (this.queue.length > 0) {
      this.scheduleDrain();
    }
    this.emitSnapshot();
    if (this.reserve()) {
      [...this.availabilityListeners].forEach((listener) => listener());
    }
  }

  private emitSnapshot(): void {
    this.onSnapshot?.(this.getSnapshot());
  }
}
