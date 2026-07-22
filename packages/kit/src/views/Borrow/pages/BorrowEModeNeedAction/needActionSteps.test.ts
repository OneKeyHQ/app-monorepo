/* cspell:ignore EMODE */
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';

import {
  EMODE_SWITCH_STEP,
  activeStepIndex,
  bindStepSettlementCallbacks,
  blockerSteps,
  mergeSeen,
  reconcileStepState,
  resolveSettleOutcome,
  shouldRepayAllForEModeStep,
  withSwitchStep,
} from './needActionSteps';

import type { IEModeNeedActionItem } from '../BorrowEModeSwitch/emodeUtils';

const item = (
  kind: 'repay' | 'removeCollateral',
  addr: string,
  amountValue = '1',
): IEModeNeedActionItem => ({
  kind,
  reserveAddress: addr,
  symbol: addr,
  amountValue,
});

describe('blockerSteps', () => {
  it('keys each step by kind:reserveAddress', () => {
    const steps = blockerSteps([
      item('repay', '0xa'),
      item('removeCollateral', '0xb'),
    ]);
    expect(steps.map((s) => s.key)).toEqual([
      'repay:0xa',
      'removeCollateral:0xb',
    ]);
  });
});

describe('shouldRepayAllForEModeStep', () => {
  it('repays all only for a full-close repay blocker', () => {
    const [fullClose] = blockerSteps([item('repay', '0xa')]);
    const [healthFactorRepay] = blockerSteps([
      { ...item('repay', '0xb'), hfSafety: true },
    ]);
    const [removeCollateral] = blockerSteps([item('removeCollateral', '0xc')]);

    expect(shouldRepayAllForEModeStep(fullClose)).toBe(true);
    expect(shouldRepayAllForEModeStep(healthFactorRepay)).toBe(false);
    expect(shouldRepayAllForEModeStep(removeCollateral)).toBe(false);
  });
});

describe('mergeSeen', () => {
  it('appends only unseen keys, preserving order', () => {
    const prev = blockerSteps([item('repay', '0xa')]);
    const next = blockerSteps([
      item('repay', '0xa'),
      item('removeCollateral', '0xb'),
    ]);
    expect(mergeSeen(prev, next).map((s) => s.key)).toEqual([
      'repay:0xa',
      'removeCollateral:0xb',
    ]);
  });

  it('never drops a previously seen (now-cleared) step', () => {
    const prev = blockerSteps([
      item('repay', '0xa'),
      item('removeCollateral', '0xb'),
    ]);
    const next = blockerSteps([item('removeCollateral', '0xb')]); // 0xa cleared
    expect(mergeSeen(prev, next).map((s) => s.key)).toEqual([
      'repay:0xa',
      'removeCollateral:0xb',
    ]);
  });

  it('refreshes existing uncompleted step payloads from the latest check', () => {
    const prev = blockerSteps([item('repay', '0xa', '1')]);
    const next = blockerSteps([item('repay', '0xa', '0.5')]);
    expect(mergeSeen(prev, next)[0].amountValue).toBe('0.5');
  });

  it('keeps completed step snapshots stable', () => {
    const prev = blockerSteps([item('repay', '0xa', '1')]);
    const next = blockerSteps([item('repay', '0xa', '0.5')]);
    expect(mergeSeen(prev, next, new Set(['repay:0xa']))[0].amountValue).toBe(
      '1',
    );
  });
});

describe('reconcileStepState', () => {
  it('marks a seen step complete when a structured recheck drops it', () => {
    const seen = blockerSteps([
      item('repay', '0xa'),
      item('removeCollateral', '0xb'),
    ]);
    const current = blockerSteps([item('removeCollateral', '0xb')]);
    const state = reconcileStepState({ seen, completed: new Set() }, current, {
      canSwitch: false,
      hasStructuredBlockerBuckets: true,
    });
    expect(state.completed.has('repay:0xa')).toBe(true);
    expect(activeStepIndex(withSwitchStep(state.seen), state.completed)).toBe(
      1,
    );
  });

  it('does not treat absent blocker buckets as cleared when canSwitch is false', () => {
    const seen = blockerSteps([item('repay', '0xa')]);
    const state = reconcileStepState({ seen, completed: new Set() }, [], {
      canSwitch: false,
      hasStructuredBlockerBuckets: false,
    });
    expect(state.completed.has('repay:0xa')).toBe(false);
  });

  it('reopens a previously completed step if the latest check still returns it', () => {
    const seen = blockerSteps([item('repay', '0xa', '1')]);
    const current = blockerSteps([item('repay', '0xa', '0.01')]);
    const state = reconcileStepState(
      { seen, completed: new Set(['repay:0xa']) },
      current,
      { canSwitch: false, hasStructuredBlockerBuckets: true },
    );
    expect(state.completed.has('repay:0xa')).toBe(false);
    expect(state.seen[0].amountValue).toBe('0.01');
  });
});

describe('withSwitchStep', () => {
  it('appends the terminal switch step', () => {
    const steps = withSwitchStep(blockerSteps([item('repay', '0xa')]));
    expect(steps[steps.length - 1]).toBe(EMODE_SWITCH_STEP);
  });
});

describe('activeStepIndex', () => {
  const steps = withSwitchStep(
    blockerSteps([item('repay', '0xa'), item('removeCollateral', '0xb')]),
  ); // keys: repay:0xa, removeCollateral:0xb, switch

  it('points at the first uncompleted step', () => {
    expect(activeStepIndex(steps, new Set())).toBe(0);
    expect(activeStepIndex(steps, new Set(['repay:0xa']))).toBe(1);
  });

  it('points at the switch step once all blockers are done', () => {
    expect(
      activeStepIndex(steps, new Set(['repay:0xa', 'removeCollateral:0xb'])),
    ).toBe(2);
  });
});

describe('resolveSettleOutcome', () => {
  it('treats undefined status as "confirming", never a failure', () => {
    // The load-bearing guard: a dismissed / poll-exhausted (still-pending)
    // confirmation must not fake a failed step, for any kind.
    expect(resolveSettleOutcome(undefined, 'repay')).toBe('confirming');
    expect(resolveSettleOutcome(undefined, 'removeCollateral')).toBe(
      'confirming',
    );
    expect(resolveSettleOutcome(undefined, 'switch')).toBe('confirming');
    expect(resolveSettleOutcome(undefined, undefined)).toBe('confirming');
  });

  it('maps a failed tx to "failed"', () => {
    expect(resolveSettleOutcome(EOnChainHistoryTxStatus.Failed, 'repay')).toBe(
      'failed',
    );
    expect(resolveSettleOutcome(EOnChainHistoryTxStatus.Failed, 'switch')).toBe(
      'failed',
    );
  });

  it('advances a confirmed blocker and closes on the confirmed switch', () => {
    expect(resolveSettleOutcome(EOnChainHistoryTxStatus.Success, 'repay')).toBe(
      'advanced',
    );
    expect(
      resolveSettleOutcome(EOnChainHistoryTxStatus.Success, 'removeCollateral'),
    ).toBe('advanced');
    expect(
      resolveSettleOutcome(EOnChainHistoryTxStatus.Success, 'switch'),
    ).toBe('switched');
  });
});

describe('bindStepSettlementCallbacks', () => {
  it('keeps success and failure ownership on the launched step', async () => {
    const launched = blockerSteps([item('repay', '0xa')])[0];
    const advanced = blockerSteps([item('removeCollateral', '0xb')])[0];
    const succeeded: string[] = [];
    const failed: string[] = [];
    let active = launched;
    const callbacks = bindStepSettlementCallbacks({
      step: launched,
      onSuccess: async (step, value: string) => {
        await Promise.resolve();
        succeeded.push(`${step.key}:${value}`);
      },
      onFail: (step) => failed.push(step.key),
    });

    active = advanced;
    await callbacks.onSuccess('confirmed');
    callbacks.onFail();

    expect(active.key).toBe('removeCollateral:0xb');
    expect(succeeded).toEqual(['repay:0xa:confirmed']);
    expect(failed).toEqual(['repay:0xa']);
  });
});
