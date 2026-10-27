export type IPortfolioSyncRequestPhase =
  | 'queued'
  | 'refreshing'
  | 'settled'
  | 'communicating';

export interface IPortfolioSyncRequest {
  id: number;
  minimumAllNetworksGeneration?: number;
  phase: IPortfolioSyncRequestPhase;
  targetKey: string;
}

export interface IPortfolioSyncTarget {
  deviceDbId: string;
  indexedAccountId: string;
  networkId: string;
  walletId: string;
}

export function buildPortfolioSyncTargetKey({
  deviceDbId,
  indexedAccountId,
  networkId,
  walletId,
}: IPortfolioSyncTarget) {
  return [walletId, indexedAccountId, networkId, deviceDbId].join('|');
}

export interface IPortfolioSyncRequestTransition {
  accepted: boolean;
  nextRequest: IPortfolioSyncRequest | undefined;
  clearFallbackTimer: boolean;
}

// One tap opens a single sync request that several independent refreshes
// report into (all-networks fan-out, single-network derive, the fallback
// timer). Only the first report to reach `communicating` owns the hardware
// handoff: once claimed the phase is frozen, and a report carrying a
// superseded tap's id must never move the current request — otherwise a late
// refresh from the previous tap claims the new tap's device session.
export function resolvePortfolioSyncRequestTransition({
  request,
  requestId,
  phase,
}: {
  request: IPortfolioSyncRequest | undefined;
  requestId: number;
  phase: IPortfolioSyncRequestPhase;
}): IPortfolioSyncRequestTransition {
  if (request?.id !== requestId || request.phase === 'communicating') {
    return {
      accepted: false,
      nextRequest: request,
      clearFallbackTimer: false,
    };
  }
  return {
    accepted: true,
    nextRequest: { ...request, phase },
    // `settled` still waits on the all-networks snapshot, so it keeps the
    // fallback timer armed; every other phase has already produced a result.
    clearFallbackTimer: phase !== 'settled',
  };
}

export type IPortfolioSyncStageHold = {
  requestId: number;
  burstId: number | undefined;
};

// A stage exit speaks only for the request whose own stage hold it closes,
// matched by the burst the exit names. Arrival order proves nothing: on
// split runtimes the previous attempt's exit (its ✗ retiring under a page
// it no longer blocks, OK-64696) can land after the new hold has opened.
export function shouldPortfolioSyncStandDownOnStageOff({
  request,
  stageHold,
  offBurstId,
}: {
  request: IPortfolioSyncRequest | undefined;
  stageHold: IPortfolioSyncStageHold | undefined;
  offBurstId: number | undefined;
}): boolean {
  return (
    request !== undefined &&
    stageHold?.requestId === request.id &&
    stageHold.burstId !== undefined &&
    stageHold.burstId === offBurstId
  );
}
