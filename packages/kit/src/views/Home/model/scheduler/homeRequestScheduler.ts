import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IHomeRuntimeJsonValue,
  IRuntimeLeafResponseEnvelope,
  IRuntimeRequestPriority,
} from '@onekeyhq/shared/src/types/homeRuntime';

export type IHomeRequestPolicy = 'takeLatest' | 'exhaust' | 'queue';

export type IHomeRequestOutcome<TResult> =
  | { kind: 'fulfilled'; value: TResult }
  | { kind: 'cancelled' }
  | { kind: 'superseded' }
  | { kind: 'ignored' }
  | { kind: 'timedOut' }
  | { kind: 'failed'; error: unknown };

export interface IHomeWorkflowContext {
  signal: AbortSignal;
  requestLeaf: <
    TDescriptor extends IHomeRuntimeJsonValue,
    TValue extends IHomeRuntimeJsonValue,
  >(
    descriptor: TDescriptor,
    options: {
      priority: IRuntimeRequestPriority;
      deadlineAt: number;
    },
  ) => Promise<IRuntimeLeafResponseEnvelope<TValue>>;
  yieldIfMainBudgetExceeded: () => Promise<void>;
}

export interface IHomeLogicalRequestTask<TResult> {
  taskId: string;
  key: string;
  groupKey: string;
  clientInstanceId: string;
  appEpoch: string;
  sessionId: string;
  requestGroupId: string;
  priority: IRuntimeRequestPriority;
  policy: IHomeRequestPolicy;
  timeoutMs: number;
  run(context: IHomeWorkflowContext): Promise<TResult>;
}

export interface IHomeRequestSchedulerSnapshot {
  disposed: boolean;
  pendingCount: number;
  runningCount: number;
  peakPendingCount: number;
  peakRunningCount: number;
}

interface IQueuedTask<TResult> {
  task: IHomeLogicalRequestTask<TResult>;
  enqueuedAt: number;
  resolve: (outcome: IHomeRequestOutcome<TResult>) => void;
}

interface IRunningTask<TResult> {
  task: IHomeLogicalRequestTask<TResult>;
  controller: AbortController;
  outcomeOverride?: 'cancelled' | 'superseded';
  resolve: (outcome: IHomeRequestOutcome<TResult>) => void;
}

export interface IHomeRequestSchedulerOptions {
  maxPending?: number;
  maxRunning?: number;
  now?: () => number;
  requestLeaf: IHomeWorkflowContext['requestLeaf'];
  scheduleYield?: () => Promise<void>;
  onSnapshot?: (snapshot: IHomeRequestSchedulerSnapshot) => void;
}

const PRIORITY_RANK: Record<IRuntimeRequestPriority, number> = {
  interactive: 0,
  critical: 1,
  background: 2,
};

const PRIORITY_AGING_MS = 3000;
const HOME_REQUEST_TIMEOUT = Symbol('homeRequestTimeout');

function createOutcome<TResult>(
  kind: 'cancelled' | 'ignored' | 'superseded' | 'timedOut',
): IHomeRequestOutcome<TResult> {
  return { kind };
}

function isSameRequestLane(
  left: IHomeLogicalRequestTask<unknown>,
  right: IHomeLogicalRequestTask<unknown>,
): boolean {
  return (
    left.clientInstanceId === right.clientInstanceId &&
    left.appEpoch === right.appEpoch &&
    left.sessionId === right.sessionId &&
    left.requestGroupId === right.requestGroupId
  );
}

export class HomeRequestScheduler {
  private readonly maxPending: number;

  private readonly maxRunning: number;

  private readonly now: () => number;

  private readonly requestLeaf: IHomeWorkflowContext['requestLeaf'];

  private readonly scheduleYield: () => Promise<void>;

  private readonly onSnapshot:
    | ((snapshot: IHomeRequestSchedulerSnapshot) => void)
    | undefined;

  private readonly pending: IQueuedTask<unknown>[] = [];

  private readonly running = new Map<string, IRunningTask<unknown>>();

  private peakPendingCount = 0;

  private peakRunningCount = 0;

  private disposed = false;

  constructor({
    maxPending = 64,
    maxRunning = 4,
    now = Date.now,
    requestLeaf,
    scheduleYield = () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      }),
    onSnapshot,
  }: IHomeRequestSchedulerOptions) {
    this.maxPending = Math.max(1, maxPending);
    this.maxRunning = Math.max(1, maxRunning);
    this.now = now;
    this.requestLeaf = requestLeaf;
    this.scheduleYield = scheduleYield;
    this.onSnapshot = onSnapshot;
  }

  schedule<TResult>(
    task: IHomeLogicalRequestTask<TResult>,
  ): Promise<IHomeRequestOutcome<TResult>> {
    if (this.disposed) {
      return Promise.resolve(createOutcome('cancelled'));
    }
    const duplicatePending = this.pending.filter(
      (candidate) =>
        isSameRequestLane(candidate.task, task) &&
        (task.policy === 'takeLatest' || candidate.task.key === task.key),
    );
    const duplicateRunning = Array.from(this.running.values()).filter(
      (candidate) =>
        isSameRequestLane(candidate.task, task) &&
        (task.policy === 'takeLatest' || candidate.task.key === task.key),
    );
    if (
      task.policy === 'exhaust' &&
      (duplicatePending.length > 0 || duplicateRunning.length > 0)
    ) {
      return Promise.resolve(createOutcome('ignored'));
    }
    if (task.policy === 'takeLatest') {
      duplicatePending.forEach((candidate) => {
        this.removePending(candidate.task.taskId, 'superseded');
      });
      duplicateRunning.forEach((candidate) => {
        candidate.outcomeOverride = 'superseded';
        candidate.controller.abort();
      });
    }
    if (this.pending.length >= this.maxPending) {
      const superseded = this.findOldestBackgroundTask(task.clientInstanceId);
      if (superseded) {
        this.removePending(superseded.task.taskId, 'superseded');
      } else {
        return Promise.resolve({
          kind: 'failed',
          error: new OneKeyLocalError('Home request queue is full'),
        });
      }
    }
    return new Promise<IHomeRequestOutcome<TResult>>((resolve) => {
      this.pending.push({
        task,
        enqueuedAt: this.now(),
        resolve,
      } as IQueuedTask<unknown>);
      this.updatePeaks();
      this.emitSnapshot();
      this.drain();
    });
  }

  cancelGroup(groupKey: string): void {
    [...this.pending]
      .filter((candidate) => candidate.task.groupKey === groupKey)
      .forEach((candidate) => {
        this.removePending(candidate.task.taskId, 'cancelled');
      });
    this.running.forEach((candidate) => {
      if (candidate.task.groupKey === groupKey) {
        candidate.outcomeOverride = 'cancelled';
        candidate.controller.abort();
      }
    });
    this.emitSnapshot();
  }

  cancelSession(sessionId: string): void {
    [...this.pending]
      .filter((candidate) => candidate.task.sessionId === sessionId)
      .forEach((candidate) => {
        this.removePending(candidate.task.taskId, 'cancelled');
      });
    this.running.forEach((candidate) => {
      if (candidate.task.sessionId === sessionId) {
        candidate.outcomeOverride = 'cancelled';
        candidate.controller.abort();
      }
    });
    this.emitSnapshot();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    [...this.pending].forEach((candidate) => {
      this.removePending(candidate.task.taskId, 'cancelled');
    });
    this.running.forEach((candidate) => {
      candidate.outcomeOverride = 'cancelled';
      candidate.controller.abort();
    });
    this.emitSnapshot();
  }

  getSnapshot(): IHomeRequestSchedulerSnapshot {
    return {
      disposed: this.disposed,
      pendingCount: this.pending.length,
      runningCount: this.running.size,
      peakPendingCount: this.peakPendingCount,
      peakRunningCount: this.peakRunningCount,
    };
  }

  private findOldestBackgroundTask(
    clientInstanceId: string,
  ): IQueuedTask<unknown> | undefined {
    return this.pending.find(
      (candidate) =>
        candidate.task.clientInstanceId === clientInstanceId &&
        candidate.task.priority === 'background',
    );
  }

  private removePending(
    taskId: string,
    kind: 'cancelled' | 'superseded',
  ): void {
    const index = this.pending.findIndex(
      (candidate) => candidate.task.taskId === taskId,
    );
    if (index < 0) {
      return;
    }
    const [candidate] = this.pending.splice(index, 1);
    candidate?.resolve(createOutcome(kind));
  }

  private pickNext(): IQueuedTask<unknown> | undefined {
    if (this.pending.length === 0) {
      return undefined;
    }
    const now = this.now();
    let selectedIndex = 0;
    let selectedRank = Number.POSITIVE_INFINITY;
    this.pending.forEach((candidate, index) => {
      const ageBoost = Math.floor(
        (now - candidate.enqueuedAt) / PRIORITY_AGING_MS,
      );
      const rank = Math.max(
        0,
        PRIORITY_RANK[candidate.task.priority] - ageBoost,
      );
      if (rank < selectedRank) {
        selectedIndex = index;
        selectedRank = rank;
      }
    });
    const [selected] = this.pending.splice(selectedIndex, 1);
    return selected;
  }

  private drain(): void {
    while (
      !this.disposed &&
      this.running.size < this.maxRunning &&
      this.pending.length > 0
    ) {
      const queued = this.pickNext();
      if (!queued) {
        return;
      }
      this.start(queued);
    }
    this.emitSnapshot();
  }

  private start(queued: IQueuedTask<unknown>): void {
    const controller = new AbortController();
    const running: IRunningTask<unknown> = {
      task: queued.task,
      controller,
      resolve: queued.resolve,
    };
    this.running.set(queued.task.taskId, running);
    this.updatePeaks();
    this.emitSnapshot();
    const deadlineAt = this.now() + Math.max(1, queued.task.timeoutMs);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const run = async (): Promise<void> => {
      let outcome: IHomeRequestOutcome<unknown>;
      try {
        const value = await Promise.race([
          queued.task.run({
            signal: controller.signal,
            requestLeaf: this.requestLeaf,
            yieldIfMainBudgetExceeded: this.scheduleYield,
          }),
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(
              () => {
                controller.abort();
                reject(HOME_REQUEST_TIMEOUT);
              },
              Math.max(1, deadlineAt - this.now()),
            );
          }),
        ]);
        outcome = running.outcomeOverride
          ? createOutcome(running.outcomeOverride)
          : { kind: 'fulfilled', value };
      } catch (error) {
        if (running.outcomeOverride) {
          outcome = createOutcome(running.outcomeOverride);
        } else if (error === HOME_REQUEST_TIMEOUT) {
          outcome = createOutcome('timedOut');
        } else if (controller.signal.aborted) {
          outcome = createOutcome('cancelled');
        } else {
          outcome = { kind: 'failed', error };
        }
      } finally {
        if (timeout) {
          clearTimeout(timeout);
        }
      }
      this.running.delete(queued.task.taskId);
      queued.resolve(outcome);
      this.emitSnapshot();
      this.drain();
    };
    void run();
  }

  private updatePeaks(): void {
    this.peakPendingCount = Math.max(
      this.peakPendingCount,
      this.pending.length,
    );
    this.peakRunningCount = Math.max(this.peakRunningCount, this.running.size);
  }

  private emitSnapshot(): void {
    this.onSnapshot?.(this.getSnapshot());
  }
}
