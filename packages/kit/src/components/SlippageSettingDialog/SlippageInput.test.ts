import {
  formatSlippageInputDisplayValue,
  shouldSyncSlippageInputDisplayValue,
} from './SlippageInput';

describe('formatSlippageInputDisplayValue', () => {
  it('keeps empty custom slippage input blank while editing', () => {
    expect(formatSlippageInputDisplayValue(undefined)).toBe('');
  });

  it('formats numeric slippage with swap precision', () => {
    expect(formatSlippageInputDisplayValue(0.555)).toBe('0.55');
  });
});

describe('shouldSyncSlippageInputDisplayValue', () => {
  it('keeps the trailing-dot edit while the parent echoes the same value', () => {
    expect(
      shouldSyncSlippageInputDisplayValue({
        inputValue: '1.',
        displaySlippage: '1',
        isEditingTrailingDot: true,
        previousDisplayValue: '0.5',
        hasSyncedDisplayValue: true,
      }),
    ).toBe(false);
  });

  it('syncs a real external preset selection during trailing-dot editing', () => {
    expect(
      shouldSyncSlippageInputDisplayValue({
        inputValue: '1.',
        displaySlippage: '3',
        isEditingTrailingDot: true,
        previousDisplayValue: '1',
        hasSyncedDisplayValue: true,
      }),
    ).toBe(true);
  });

  it('keeps non-normalized input while the parent echoes the same value', () => {
    expect(
      shouldSyncSlippageInputDisplayValue({
        inputValue: '0.50',
        displaySlippage: '0.5',
        isEditingTrailingDot: false,
        previousDisplayValue: '0.3',
        hasSyncedDisplayValue: true,
        localInputDisplayValue: '0.5',
      }),
    ).toBe(false);
  });

  it('syncs external preset changes after a non-normalized input echo', () => {
    expect(
      shouldSyncSlippageInputDisplayValue({
        inputValue: '0.50',
        displaySlippage: '3',
        isEditingTrailingDot: false,
        previousDisplayValue: '0.5',
        hasSyncedDisplayValue: true,
        localInputDisplayValue: '0.5',
      }),
    ).toBe(true);
  });
});
