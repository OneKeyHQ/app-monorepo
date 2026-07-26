import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IRuntimeRequestPriority } from '@onekeyhq/shared/src/types/homeRuntime';

type IQueuedLeaf = {
  clientId: string;
  enqueuedAt: number;
  priority: IRuntimeRequestPriority;
  reject(reason: unknown): void;
  resolve(value: unknown): void;
  run(): Promise<unknown>;
};

const PRIORITIES: readonly IRuntimeRequestPriority[] = [
  'interactive',
  'critical',
  'background',
];
const PRIORITY_AGING_MS = 3000;
const DEFAULT_PER_CLIENT_PENDING = 32;

export class SharedHomeLeafRequestPool {
  private readonly queues = new Map<string, IQueuedLeaf[]>();

  private readonly clientOrder: string[] = [];

  private runningCount = 0;

  private roundRobinCursor = 0;

  constructor(
    private readonly maxRunning: number,
    private readonly maxPending: number,
    private readonly perClientPending: number,
  ) {}

  run<TResult>(
    clientId: string,
    priority: IRuntimeRequestPriority,
    request: () => Promise<TResult>,
  ): Promise<TResult> {
    const queue = this.getClientQueue(clientId);
    if (
      this.pendingCount() >= this.maxPending ||
      queue.length >= this.perClientPending
    ) {
      const disposableIndex = queue.findIndex(
        (leaf) => leaf.priority === 'background',
      );
      if (disposableIndex >= 0) {
        const [disposable] = queue.splice(disposableIndex, 1);
        disposable?.reject(
          new OneKeyLocalError('Shared leaf request was superseded'),
        );
      } else {
        return Promise.reject(
          new OneKeyLocalError('Shared leaf request queue is full'),
        );
      }
    }
    return new Promise<TResult>((resolve, reject) => {
      queue.push({
        clientId,
        enqueuedAt: Date.now(),
        priority,
        reject,
        resolve,
        run: request,
      });
      this.drain();
    });
  }

  cancelClient(clientId: string): void {
    const queue = this.queues.get(clientId);
    if (queue) {
      this.queues.delete(clientId);
      queue.forEach((leaf) =>
        leaf.reject(
          new OneKeyLocalError('Shared leaf request client is disposed'),
        ),
      );
    }
    const index = this.clientOrder.indexOf(clientId);
    if (index >= 0) {
      this.clientOrder.splice(index, 1);
      if (this.clientOrder.length === 0) {
        this.roundRobinCursor = 0;
      } else {
        this.roundRobinCursor %= this.clientOrder.length;
      }
    }
  }

  getSnapshot(clientId: string) {
    return {
      clientPendingCount: this.queues.get(clientId)?.length ?? 0,
      pendingCount: this.pendingCount(),
      runningCount: this.runningCount,
    };
  }

  private getClientQueue(clientId: string): IQueuedLeaf[] {
    const existing = this.queues.get(clientId);
    if (existing) {
      return existing;
    }
    const queue: IQueuedLeaf[] = [];
    this.queues.set(clientId, queue);
    this.clientOrder.push(clientId);
    return queue;
  }

  private pendingCount(): number {
    let count = 0;
    this.queues.forEach((queue) => {
      count += queue.length;
    });
    return count;
  }

  private effectivePriority(leaf: IQueuedLeaf): IRuntimeRequestPriority {
    const ageSteps = Math.floor(
      (Date.now() - leaf.enqueuedAt) / PRIORITY_AGING_MS,
    );
    const index = Math.max(0, PRIORITIES.indexOf(leaf.priority) - ageSteps);
    return PRIORITIES[index] ?? 'interactive';
  }

  private pickNext(): IQueuedLeaf | undefined {
    if (this.clientOrder.length === 0) {
      return undefined;
    }
    for (const priority of PRIORITIES) {
      for (let offset = 0; offset < this.clientOrder.length; offset += 1) {
        const index =
          (this.roundRobinCursor + offset) % this.clientOrder.length;
        const clientId = this.clientOrder[index];
        const queue = clientId ? this.queues.get(clientId) : undefined;
        const leafIndex = queue?.findIndex(
          (leaf) => this.effectivePriority(leaf) === priority,
        );
        if (queue && leafIndex !== undefined && leafIndex >= 0) {
          const [leaf] = queue.splice(leafIndex, 1);
          this.roundRobinCursor = (index + 1) % this.clientOrder.length;
          return leaf;
        }
      }
    }
    return undefined;
  }

  private drain(): void {
    while (this.runningCount < this.maxRunning && this.pendingCount() > 0) {
      const leaf = this.pickNext();
      if (!leaf) {
        return;
      }
      if (
        leaf.priority === 'background' &&
        this.maxRunning > 1 &&
        this.runningCount >= this.maxRunning - 1
      ) {
        this.getClientQueue(leaf.clientId).unshift(leaf);
        return;
      }
      this.runningCount += 1;
      void leaf
        .run()
        .then(
          (value) => leaf.resolve(value),
          (error) => leaf.reject(error),
        )
        .finally(() => {
          this.runningCount -= 1;
          this.drain();
        });
    }
  }
}

const sharedPools = new Map<string, SharedHomeLeafRequestPool>();

export function getSharedHomeLeafRequestPool(
  maxRunning: number,
  maxPending: number,
): SharedHomeLeafRequestPool {
  const key = `${maxRunning}:${maxPending}`;
  let pool = sharedPools.get(key);
  if (!pool) {
    pool = new SharedHomeLeafRequestPool(
      maxRunning,
      maxPending,
      DEFAULT_PER_CLIENT_PENDING,
    );
    sharedPools.set(key, pool);
  }
  return pool;
}
