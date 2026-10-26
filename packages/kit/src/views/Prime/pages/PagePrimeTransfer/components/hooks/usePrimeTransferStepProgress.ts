import { useEffect, useState } from 'react';

// Pace of visible catch-up steps. Background progress reports are throttled
// separately (100 ms); this only controls how the dialog follows them.
export const PRIME_TRANSFER_PROGRESS_STEP_MS = 50;

const MAX_UNFINISHED_PERCENTAGE = 99;

/**
 * Follows a phase's real progress one percentage point per visible update.
 * The value never runs ahead of `target`, stays below 100% until `completed`,
 * then jumps straight to 100%. A new `phaseKey` restarts from 0%.
 */
export function usePrimeTransferStepProgress({
  phaseKey,
  target,
  completed,
  stepMs = PRIME_TRANSFER_PROGRESS_STEP_MS,
}: {
  phaseKey: string | undefined;
  target: number | undefined;
  completed?: boolean;
  stepMs?: number;
}): number | undefined {
  const [step, setStep] = useState<{ phaseKey?: string; value: number }>({
    phaseKey,
    value: 0,
  });
  // Values stored for another phase never carry over.
  const value = step.phaseKey === phaseKey ? step.value : 0;
  const limit = Math.min(
    MAX_UNFINISHED_PERCENTAGE,
    Math.max(0, Math.floor(target ?? 0)),
  );
  const shouldStep =
    phaseKey !== undefined &&
    target !== undefined &&
    !completed &&
    value < limit;

  useEffect(() => {
    if (!shouldStep) return undefined;
    // Schedule from the committed value so every integer gets a render, and a
    // blocked thread resumes with one step instead of a burst of catch-up steps.
    const timer = setTimeout(() => {
      setStep({ phaseKey, value: value + 1 });
    }, stepMs);
    return () => clearTimeout(timer);
  }, [phaseKey, shouldStep, stepMs, value]);

  if (target === undefined) return undefined;
  return completed ? 100 : value;
}
