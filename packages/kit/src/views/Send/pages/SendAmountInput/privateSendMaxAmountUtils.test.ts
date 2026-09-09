import {
  calcPrivateSendNativeTokenMaxAmount,
  getMaxSendStateAfterModeChange,
} from './privateSendMaxAmountUtils';

describe('getMaxSendStateAfterModeChange', () => {
  it('clears Private Max when switching to Public', () => {
    expect(
      getMaxSendStateAfterModeChange({
        isMaxSend: true,
        isCurrentModePrivate: true,
        isNextModePrivate: false,
      }),
    ).toBe(false);
  });

  it('preserves Public Max when switching to Private', () => {
    expect(
      getMaxSendStateAfterModeChange({
        isMaxSend: true,
        isCurrentModePrivate: false,
        isNextModePrivate: true,
      }),
    ).toBe(true);
  });

  it('preserves the current state when the mode does not change', () => {
    expect(
      getMaxSendStateAfterModeChange({
        isMaxSend: true,
        isCurrentModePrivate: true,
        isNextModePrivate: true,
      }),
    ).toBe(true);
  });
});

describe('calcPrivateSendNativeTokenMaxAmount', () => {
  it('deducts the configured gas reserve before quoting a max send', () => {
    expect(
      calcPrivateSendNativeTokenMaxAmount({
        balance: '1',
        reserveGas: '0.005',
        decimals: 18,
      }),
    ).toBe('0.995');
  });

  it('rounds down to the native token precision', () => {
    expect(
      calcPrivateSendNativeTokenMaxAmount({
        balance: '1.123456789',
        reserveGas: '0.000000001',
        decimals: 6,
      }),
    ).toBe('1.123456');
  });

  it('never produces a negative amount when the reserve exceeds the balance', () => {
    expect(
      calcPrivateSendNativeTokenMaxAmount({
        balance: '0.001',
        reserveGas: '0.005',
        decimals: 18,
      }),
    ).toBe('0');
  });

  it('keeps the full balance when the configured reserve is not positive', () => {
    expect(
      calcPrivateSendNativeTokenMaxAmount({
        balance: '2.5',
        reserveGas: 0,
        decimals: 18,
      }),
    ).toBe('2.5');
  });

  it('returns zero for an invalid balance', () => {
    expect(
      calcPrivateSendNativeTokenMaxAmount({
        balance: 'invalid',
        reserveGas: '0.005',
        decimals: 18,
      }),
    ).toBe('0');
  });
});
