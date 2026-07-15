import type {
  ICancelFetchSpeedSwapQuoteV2Params,
  ISwapSpeedQuoteSessionIdentity,
} from '@onekeyhq/shared/types/swap/types';

export interface ISwapSpeedQuoteAbortController {
  abort: () => void;
}

export interface ISwapSpeedQuoteSessionLease {
  readonly session: ISwapSpeedQuoteSessionIdentity;
  readonly bgGeneration: number;
  status: 'preparing' | 'inflight' | 'settled' | 'cancelled';
  abortController?: ISwapSpeedQuoteAbortController;
}

/** Owns one speed-quote request per foreground surface in the bg runtime. */
export class SwapSpeedQuoteSessionRegistry {
  private readonly sessions = new Map<string, ISwapSpeedQuoteSessionLease>();

  private readonly latestIntentRevisionBySurface = new Map<string, number>();

  private nextGeneration = 0;

  reserve(
    session: ISwapSpeedQuoteSessionIdentity,
  ): ISwapSpeedQuoteSessionLease {
    this.nextGeneration += 1;
    const lease: ISwapSpeedQuoteSessionLease = {
      session,
      bgGeneration: this.nextGeneration,
      status: 'preparing',
    };
    const latestIntentRevision = this.latestIntentRevisionBySurface.get(
      session.surfaceId,
    );
    if (
      latestIntentRevision !== undefined &&
      session.intentRevision <= latestIntentRevision
    ) {
      lease.status = 'cancelled';
      return lease;
    }

    const current = this.sessions.get(session.surfaceId);
    if (current) {
      this.invalidate(current);
    }
    this.latestIntentRevisionBySurface.set(
      session.surfaceId,
      session.intentRevision,
    );
    this.sessions.set(session.surfaceId, lease);
    return lease;
  }

  isCurrent(lease: ISwapSpeedQuoteSessionLease): boolean {
    return (
      this.sessions.get(lease.session.surfaceId) === lease &&
      (lease.status === 'preparing' || lease.status === 'inflight')
    );
  }

  attachAbortController(
    lease: ISwapSpeedQuoteSessionLease,
    abortController: ISwapSpeedQuoteAbortController,
  ): boolean {
    if (!this.isCurrent(lease)) {
      this.abort(abortController);
      return false;
    }
    if (lease.abortController) {
      this.abort(lease.abortController);
    }
    lease.abortController = abortController;
    lease.status = 'inflight';
    return true;
  }

  finish(lease: ISwapSpeedQuoteSessionLease): boolean {
    if (!this.isCurrent(lease)) {
      return false;
    }
    this.sessions.delete(lease.session.surfaceId);
    lease.abortController = undefined;
    lease.status = 'settled';
    return true;
  }

  cancelExact(params: ICancelFetchSpeedSwapQuoteV2Params): boolean {
    const lease = this.sessions.get(params.surfaceId);
    if (!lease || lease.session.requestId !== params.requestId) {
      return false;
    }
    this.sessions.delete(params.surfaceId);
    lease.status = 'cancelled';
    const abortController = lease.abortController;
    lease.abortController = undefined;
    if (abortController) {
      this.abort(abortController);
    }
    return true;
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  private invalidate(lease: ISwapSpeedQuoteSessionLease) {
    if (this.sessions.get(lease.session.surfaceId) === lease) {
      this.sessions.delete(lease.session.surfaceId);
    }
    lease.status = 'cancelled';
    const abortController = lease.abortController;
    lease.abortController = undefined;
    if (abortController) {
      this.abort(abortController);
    }
  }

  private abort(abortController: ISwapSpeedQuoteAbortController) {
    try {
      abortController.abort();
    } catch {
      // A request that already settled is safe to ignore during cleanup.
    }
  }
}
