// Composes a scheduler turn from a chain's step primitive, for chains that don't bound their own turn.
// A step only starts if it would still finish inside budget -- an overrun gets the chain quarantined.
export type ILocalWalletSyncStepResult = {
  done: boolean;
  stateChanged?: boolean;
};

export type ILocalWalletSyncTurnResult = {
  done: boolean;
  steps: number;
  stateChanged: boolean;
  /** Last measured step duration; the next turn's best first estimate. */
  lastStepMs: number;
};

export async function runBoundedSyncTurn({
  budgetMs,
  expectedStepMs,
  step,
  onStep,
  now = Date.now,
}: {
  /** The turn's whole budget: the scheduler's watchdog for this chain. */
  budgetMs: number;
  /** How long a step is assumed to take before one has been measured. */
  expectedStepMs: number;
  step: () => Promise<ILocalWalletSyncStepResult>;
  /** Runs after every step to publish progress; its failure is logged but must never end the turn. */
  onStep?: () => Promise<void>;
  now?: () => number;
}): Promise<ILocalWalletSyncTurnResult> {
  const startedAt = now();
  let lastStepMs = expectedStepMs;
  let steps = 0;
  let stateChanged = false;
  let done = false;
  while (!done) {
    const elapsed = now() - startedAt;
    // A step expected to overrun the budget is not started; the first step always runs regardless.
    if (steps > 0 && elapsed + lastStepMs > budgetMs) {
      break;
    }
    const stepStartedAt = now();
    // eslint-disable-next-line no-await-in-loop
    const result = await step();
    lastStepMs = Math.max(1, now() - stepStartedAt);
    steps += 1;
    if (result.stateChanged) stateChanged = true;
    done = result.done;
    if (onStep) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await onStep();
      } catch (error) {
        console.error('[privacy-chain] onStep failed', error);
      }
    }
  }
  return { done, steps, stateChanged, lastStepMs };
}
