import {
  getProtocolPositionActionPercentInputMaxLength,
  normalizeProtocolPositionActionPercentInput,
  resolveProtocolPositionActionPercentInput,
  resolveProtocolPositionActionPercentKeyPress,
  resolveProtocolPositionActionPercentValue,
  shouldClearProtocolPositionActionInitialPercentValue,
  validateProtocolPositionActionPercentInput,
} from './protocolPositionActionPercentUtils';

describe('validateProtocolPositionActionPercentInput', () => {
  it('allows empty text and integer percents within 0..100', () => {
    ['', '0', '1', '25', '99', '100'].forEach((value) => {
      expect(validateProtocolPositionActionPercentInput(value)).toBe(true);
    });
  });

  it('rejects overflow, decimals, signs, and leading zeros', () => {
    ['00', '01', '001', '1001', '101', '100.1', '-1', '+1'].forEach((value) => {
      expect(validateProtocolPositionActionPercentInput(value)).toBe(false);
    });
  });
});

describe('normalizeProtocolPositionActionPercentInput', () => {
  it('normalizes leading zeros and non-digit pasted text', () => {
    expect(normalizeProtocolPositionActionPercentInput('05')).toBe('5');
    expect(normalizeProtocolPositionActionPercentInput('000')).toBe('0');
    expect(normalizeProtocolPositionActionPercentInput('1a2')).toBe('12');
  });

  it('does not clamp values above 100', () => {
    expect(normalizeProtocolPositionActionPercentInput('123')).toBe('123');
    expect(normalizeProtocolPositionActionPercentInput('1001')).toBe('1001');
  });
});

describe('resolveProtocolPositionActionPercentInput', () => {
  it('accepts normalized values in range', () => {
    expect(
      resolveProtocolPositionActionPercentInput({
        currentValue: '0',
        nextValue: '05',
      }),
    ).toBe('5');
    expect(
      resolveProtocolPositionActionPercentInput({
        currentValue: '10',
        nextValue: '100',
      }),
    ).toBe('100');
  });

  it('keeps the current value when the next value exceeds 100', () => {
    expect(
      resolveProtocolPositionActionPercentInput({
        currentValue: '12',
        nextValue: '123',
      }),
    ).toBe('12');
    expect(
      resolveProtocolPositionActionPercentInput({
        currentValue: '100',
        nextValue: '1001',
      }),
    ).toBe('100');
  });
});

describe('getProtocolPositionActionPercentInputMaxLength', () => {
  it('allows three digits only when 100 can still be typed', () => {
    expect(getProtocolPositionActionPercentInputMaxLength('')).toBe(3);
    expect(getProtocolPositionActionPercentInputMaxLength('1')).toBe(3);
    expect(getProtocolPositionActionPercentInputMaxLength('10')).toBe(3);
    expect(getProtocolPositionActionPercentInputMaxLength('100')).toBe(3);
    expect(getProtocolPositionActionPercentInputMaxLength('0')).toBe(2);
    expect(getProtocolPositionActionPercentInputMaxLength('12')).toBe(2);
    expect(getProtocolPositionActionPercentInputMaxLength('99')).toBe(2);
  });
});

describe('resolveProtocolPositionActionPercentKeyPress', () => {
  it('replaces zero with the pressed digit instead of appending to zero', () => {
    expect(
      resolveProtocolPositionActionPercentKeyPress({
        currentValue: '0',
        key: '5',
      }),
    ).toBe('5');
    expect(
      resolveProtocolPositionActionPercentKeyPress({
        currentValue: '0',
        key: 'Backspace',
      }),
    ).toBe('');
  });

  it('only lets 10 become 100, not 101 through 109', () => {
    expect(
      resolveProtocolPositionActionPercentKeyPress({
        currentValue: '10',
        key: '0',
      }),
    ).toBe('100');
    expect(
      resolveProtocolPositionActionPercentKeyPress({
        currentValue: '10',
        key: '1',
      }),
    ).toBe('10');
  });
});

describe('resolveProtocolPositionActionPercentValue', () => {
  it('returns numeric percent for valid text and zero for invalid text', () => {
    expect(resolveProtocolPositionActionPercentValue('55')).toBe(55);
    expect(resolveProtocolPositionActionPercentValue('100')).toBe(100);
    expect(resolveProtocolPositionActionPercentValue('')).toBe(0);
    expect(resolveProtocolPositionActionPercentValue('101')).toBe(0);
  });
});

describe('shouldClearProtocolPositionActionInitialPercentValue', () => {
  it('clears only the untouched initial max value', () => {
    expect(
      shouldClearProtocolPositionActionInitialPercentValue({
        value: '100',
        hasUserIntent: false,
      }),
    ).toBe(true);
    expect(
      shouldClearProtocolPositionActionInitialPercentValue({
        value: '100',
        hasUserIntent: true,
      }),
    ).toBe(false);
  });

  it('does not clear non-max default or edited values', () => {
    ['0', '50', ''].forEach((value) => {
      expect(
        shouldClearProtocolPositionActionInitialPercentValue({
          value,
          hasUserIntent: false,
        }),
      ).toBe(false);
    });
  });
});
