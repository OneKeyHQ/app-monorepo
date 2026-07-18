/* cspell:ignore EMODE */
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type { IEarnText } from '@onekeyhq/shared/types/staking';

import type { IEModeNeedActionItem } from '../BorrowEModeSwitch/emodeUtils';

export type IEModeStepKind = 'repay' | 'removeCollateral' | 'switch';

export interface IEModeStep {
  kind: IEModeStepKind;
  key: string; // stable identity: `${kind}:${reserveAddress}` or 'switch'
  reserveAddress?: string;
  symbol?: string;
  logoURI?: string;
  amount?: IEarnText;
  amountFiat?: IEarnText;
  amountValue?: string;
  hfSafety?: boolean;
}

export interface IEModeStepState {
  seen: IEModeStep[];
  completed: Set<string>;
}

export function bindStepSettlementCallbacks<T>({
  step,
  onSuccess,
  onFail,
}: {
  step: IEModeStep;
  onSuccess: (step: IEModeStep, data: T) => void | Promise<void>;
  onFail: (step: IEModeStep) => void;
}): {
  onSuccess: (data: T) => void | Promise<void>;
  onFail: () => void;
} {
  return {
    onSuccess: (data) => onSuccess(step, data),
    onFail: () => onFail(step),
  };
}

// The terminal step: switching e-mode itself. Not a blocker asset.
export const EMODE_SWITCH_STEP: IEModeStep = { kind: 'switch', key: 'switch' };

export function blockerSteps(items: IEModeNeedActionItem[]): IEModeStep[] {
  return items.map((it) => ({ ...it, key: `${it.kind}:${it.reserveAddress}` }));
}

// Stable union by key. Keeps prior order so completed steps keep their slot
// (and their ✓) after the live check stops returning them; brand-new blockers
// append at the end. Existing uncompleted steps refresh from the latest check
// so amountValue / tags cannot go stale after a partial routed action or dust.
export function mergeSeen(
  prev: IEModeStep[],
  next: IEModeStep[],
  completed: Set<string> = new Set(),
): IEModeStep[] {
  const prevKeys = new Set(prev.map((s) => s.key));
  const nextByKey = new Map(next.map((s) => [s.key, s]));
  return [
    ...prev.map((s) =>
      completed.has(s.key) ? s : (nextByKey.get(s.key) ?? s),
    ),
    ...next.filter((s) => !prevKeys.has(s.key)),
  ];
}

export function reconcileStepState(
  state: IEModeStepState,
  current: IEModeStep[],
  {
    canSwitch,
    hasStructuredBlockerBuckets,
  }: {
    canSwitch?: boolean;
    hasStructuredBlockerBuckets: boolean;
  },
): IEModeStepState {
  const currentKeys = new Set(current.map((s) => s.key));
  const completed = new Set(state.completed);

  // A step that still appears in the latest check is still a blocker. This
  // reopens native-ETH dust or any full-close attempt that did not clear.
  currentKeys.forEach((key) => completed.delete(key));

  // Only infer cleared steps from missing blocker rows when the response
  // actually carried structured buckets, or when canSwitch proves all blockers
  // are gone. If the server sent only reasons[], absence of buckets is not
  // enough evidence to mark old steps complete.
  if (canSwitch || hasStructuredBlockerBuckets) {
    state.seen.forEach((step) => {
      if (step.kind !== 'switch' && !currentKeys.has(step.key)) {
        completed.add(step.key);
      }
    });
  }

  return {
    seen: mergeSeen(state.seen, current, completed),
    completed,
  };
}

// Full render list = accumulated blockers + the terminal switch.
export function withSwitchStep(seen: IEModeStep[]): IEModeStep[] {
  return [...seen, EMODE_SWITCH_STEP];
}

// The checklist's active index: first step whose key isn't completed. The switch
// step is never in `completed` (success there closes the screen), so once every
// blocker is completed this lands on the switch step.
export function activeStepIndex(
  steps: IEModeStep[],
  completed: Set<string>,
): number {
  const idx = steps.findIndex((s) => !completed.has(s.key));
  return idx === -1 ? steps.length - 1 : idx;
}

// How a broadcast step's on-chain status maps to the flow's next move. The
// load-bearing rule: `undefined` (poll exhausted / not yet final) is NEVER a
// failure — it means "submitted, still confirming", so the recheck stays the
// source of truth and a dismissed or slow confirmation can't fake a failed step.
export type IEModeSettleOutcome =
  | 'failed'
  | 'switched'
  | 'advanced'
  | 'confirming';

export function resolveSettleOutcome(
  status: EOnChainHistoryTxStatus | undefined,
  stepKind: IEModeStepKind | undefined,
): IEModeSettleOutcome {
  if (status === EOnChainHistoryTxStatus.Failed) {
    return 'failed';
  }
  if (status === EOnChainHistoryTxStatus.Success) {
    return stepKind === 'switch' ? 'switched' : 'advanced';
  }
  return 'confirming';
}
