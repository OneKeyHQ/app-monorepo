import type {
  ICancelSwapQuoteEventsV2Params,
  ISwapQuoteSessionIdentity,
} from '@onekeyhq/shared/types/swap/types';

export interface ISwapQuoteSessionConnection {
  close: () => void;
  removeAllListeners: () => void;
}

export interface ISwapQuoteSessionLease {
  readonly session: ISwapQuoteSessionIdentity;
  readonly bgGeneration: number;
  sequence: number;
  status: 'preparing' | 'open' | 'terminal' | 'cancelled';
  connection?: ISwapQuoteSessionConnection;
}

type ICancelCallback = (params: {
  lease: ISwapQuoteSessionLease;
  sequence: number;
}) => void;

/**
 * Owns the quote transport lifecycle in the background runtime.
 *
 * A lease is installed synchronously before quote request preparation starts.
 * This makes a later request authoritative even when an older async prepare
 * resumes after it. Connections are always disposed through the captured
 * lease, never through a mutable global source field.
 */
export class SwapQuoteSessionRegistry {
  private readonly sessions = new Map<string, ISwapQuoteSessionLease>();

  private readonly latestIntentRevisionBySurface = new Map<string, number>();

  private nextGeneration = 0;

  reserve(session: ISwapQuoteSessionIdentity): ISwapQuoteSessionLease {
    this.nextGeneration += 1;
    const bgGeneration = this.nextGeneration;
    const latestIntentRevision = this.latestIntentRevisionBySurface.get(
      session.surfaceId,
    );
    if (
      latestIntentRevision !== undefined &&
      session.intentRevision <= latestIntentRevision
    ) {
      return {
        session,
        bgGeneration,
        sequence: 0,
        status: 'cancelled',
      };
    }

    const current = this.sessions.get(session.surfaceId);
    if (current) {
      this.invalidate(current, 'cancelled');
    }

    this.latestIntentRevisionBySurface.set(
      session.surfaceId,
      session.intentRevision,
    );

    const lease: ISwapQuoteSessionLease = {
      session,
      bgGeneration,
      sequence: 0,
      status: 'preparing',
    };
    this.sessions.set(session.surfaceId, lease);
    return lease;
  }

  isCurrent(lease: ISwapQuoteSessionLease): boolean {
    return (
      this.sessions.get(lease.session.surfaceId) === lease &&
      (lease.status === 'preparing' || lease.status === 'open')
    );
  }

  attachConnection(
    lease: ISwapQuoteSessionLease,
    connection: ISwapQuoteSessionConnection,
  ): boolean {
    if (!this.isCurrent(lease)) {
      this.disposeConnection(connection);
      return false;
    }

    if (lease.connection) {
      this.disposeConnection(lease.connection);
    }
    lease.connection = connection;
    lease.status = 'open';
    return true;
  }

  nextSequence(lease: ISwapQuoteSessionLease): number | undefined {
    if (!this.isCurrent(lease)) {
      return undefined;
    }
    lease.sequence += 1;
    return lease.sequence;
  }

  finish(lease: ISwapQuoteSessionLease): boolean {
    if (!this.isCurrent(lease)) {
      return false;
    }
    this.invalidate(lease, 'terminal');
    return true;
  }

  cancelExact(
    params: ICancelSwapQuoteEventsV2Params,
    onCancel?: ICancelCallback,
  ): boolean {
    const lease = this.sessions.get(params.surfaceId);
    if (!lease || lease.session.requestId !== params.requestId) {
      return false;
    }

    this.sessions.delete(params.surfaceId);
    lease.status = 'cancelled';
    lease.sequence += 1;
    onCancel?.({ lease, sequence: lease.sequence });
    this.disposeLeaseConnection(lease);
    return true;
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  private invalidate(
    lease: ISwapQuoteSessionLease,
    status: 'terminal' | 'cancelled',
  ) {
    if (this.sessions.get(lease.session.surfaceId) === lease) {
      this.sessions.delete(lease.session.surfaceId);
    }
    lease.status = status;
    this.disposeLeaseConnection(lease);
  }

  private disposeLeaseConnection(lease: ISwapQuoteSessionLease) {
    const connection = lease.connection;
    lease.connection = undefined;
    if (connection) {
      this.disposeConnection(connection);
    }
  }

  private disposeConnection(connection: ISwapQuoteSessionConnection) {
    try {
      connection.removeAllListeners();
    } catch {
      // Cleanup must remain best-effort so close still runs.
    }
    try {
      connection.close();
    } catch {
      // A transport that is already closed is safe to ignore.
    }
  }
}
