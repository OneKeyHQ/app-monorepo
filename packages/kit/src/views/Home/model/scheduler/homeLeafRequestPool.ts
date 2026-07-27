import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IRuntimeRequestPriority } from '@onekeyhq/shared/src/types/homeRuntime';

import {
  type SharedHomeLeafRequestPool,
  getSharedHomeLeafRequestPool,
} from './sharedHomeLeafRequestPool';

export class HomeLeafRequestPool {
  private readonly pool: SharedHomeLeafRequestPool;

  private disposed = false;

  constructor(
    maxRunning: number,
    private readonly clientId: string,
    maxPending = 64,
    private readonly getSessionId?: () => string | undefined,
  ) {
    this.pool = getSharedHomeLeafRequestPool(maxRunning, maxPending);
  }

  run<TResult>(
    priority: IRuntimeRequestPriority,
    request: () => Promise<TResult>,
    sessionId?: string,
  ): Promise<TResult> {
    if (this.disposed) {
      return Promise.reject(
        new OneKeyLocalError('Home leaf request pool is disposed'),
      );
    }
    return this.pool.run(
      this.clientId,
      priority,
      request,
      sessionId ?? this.getSessionId?.(),
    );
  }

  cancelSession(sessionId: string): void {
    if (!this.disposed) {
      this.pool.cancelSession(this.clientId, sessionId);
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.pool.cancelClient(this.clientId);
  }

  getSnapshot() {
    return this.pool.getSnapshot(this.clientId);
  }
}
