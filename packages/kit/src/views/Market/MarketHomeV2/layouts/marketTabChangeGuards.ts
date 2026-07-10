interface IShouldIgnoreProgrammaticSettlingTabParams {
  expectedTabName?: string;
  incomingTabName: string;
  lastProgrammaticAcceptedTabName?: string;
  programmaticAcceptedElapsedMs?: number;
  programmaticSettleGuardMs: number;
  isRecentPagerDrag: boolean;
  wasDraggedAfterExpectedTab: boolean;
}

export function shouldIgnoreProgrammaticSettlingTab({
  expectedTabName,
  incomingTabName,
  lastProgrammaticAcceptedTabName,
  programmaticAcceptedElapsedMs,
  programmaticSettleGuardMs,
  isRecentPagerDrag,
  wasDraggedAfterExpectedTab,
}: IShouldIgnoreProgrammaticSettlingTabParams): boolean {
  return Boolean(
    !expectedTabName &&
    programmaticSettleGuardMs > 0 &&
    lastProgrammaticAcceptedTabName &&
    incomingTabName !== lastProgrammaticAcceptedTabName &&
    programmaticAcceptedElapsedMs !== undefined &&
    programmaticAcceptedElapsedMs < programmaticSettleGuardMs &&
    !isRecentPagerDrag &&
    !wasDraggedAfterExpectedTab,
  );
}
