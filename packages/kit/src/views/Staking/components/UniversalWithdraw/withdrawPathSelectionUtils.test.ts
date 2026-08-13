import {
  getEffectiveSelectedWithdrawPathIndex,
  getSelectedWithdrawType,
} from './withdrawPathSelectionUtils';

describe('withdraw path selection', () => {
  it('keeps a manually selected second path when confirm boxes omit withdrawType', () => {
    expect(
      getEffectiveSelectedWithdrawPathIndex({
        boxes: [{}, {}],
        manualSelection: { index: 1 },
        selectedIndex: 1,
      }),
    ).toBe(1);
  });

  it('keeps a manually selected path by type when the response order changes', () => {
    expect(
      getEffectiveSelectedWithdrawPathIndex({
        boxes: [{ withdrawType: 'queued' }, { withdrawType: 'instant' }],
        manualSelection: { index: 1, withdrawType: 'queued' },
        selectedIndex: 1,
      }),
    ).toBe(0);
  });

  it('falls back to the selected index when a later response omits withdrawType', () => {
    expect(
      getEffectiveSelectedWithdrawPathIndex({
        boxes: [{}, {}],
        manualSelection: { index: 1, withdrawType: 'queued' },
        selectedIndex: 1,
      }),
    ).toBe(1);
  });

  it('uses the first enabled path until the user makes a selection', () => {
    expect(
      getEffectiveSelectedWithdrawPathIndex({
        boxes: [{ disabled: true }, {}],
        selectedIndex: 0,
      }),
    ).toBe(1);
  });

  it('sends Spark and Bitway the initial instant type before confirmation boxes load', () => {
    const initialWithdrawType = getSelectedWithdrawType({
      isCancelWithdrawal: false,
      requiresEarnWithdrawPath: true,
      selectedIndex: 0,
    });
    const resolvedWithdrawType = getSelectedWithdrawType({
      isCancelWithdrawal: false,
      requiresEarnWithdrawPath: true,
      selectedIndex: 0,
      selectedWithdrawPath: {},
    });

    expect(initialWithdrawType).toBe('instant');
    expect(resolvedWithdrawType).toBe(initialWithdrawType);
  });

  it('derives queued for the second required withdraw path when the server omits its type', () => {
    expect(
      getSelectedWithdrawType({
        isCancelWithdrawal: false,
        requiresEarnWithdrawPath: true,
        selectedIndex: 1,
        selectedWithdrawPath: {},
      }),
    ).toBe('queued');
  });
});
