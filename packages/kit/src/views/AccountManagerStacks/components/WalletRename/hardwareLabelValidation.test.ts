import {
  getHardwareLabelValidationError,
  normalizeHardwareLabelValue,
} from './hardwareLabelValidation';

const validatePro2Label = (value: string) =>
  getHardwareLabelValidationError({
    value,
    maxLength: 14,
    asciiOnly: true,
    trimOuterWhitespace: true,
  });

describe('getHardwareLabelValidationError', () => {
  test.each([
    'OneKeyPro2',
    'OneKey Pro 2',
    'OneKey-Pro2',
    'OneKey_Pro2',
    'ONEKEY',
    '123456',
  ])('accepts a supported Pro2 label: %s', (value) => {
    expect(validatePro2Label(value)).toBeUndefined();
  });

  test.each(['ran😂', '一二三四五六七八九十123', 'OneKey　Pro2'])(
    'rejects an unsupported Pro2 label: %s',
    (value) => {
      expect(validatePro2Label(value)).toBe('invalid');
    },
  );

  it('reports an overlong supported label', () => {
    expect(validatePro2Label('A'.repeat(15))).toBe('tooLong');
  });

  it('ignores removable outer spaces for the Pro2 byte limit', () => {
    const value = '  12345678901234  ';
    expect(validatePro2Label(value)).toBeUndefined();
    expect(normalizeHardwareLabelValue(value, true)).toBe('12345678901234');
  });

  it('keeps printable punctuation available for Trezor labels', () => {
    expect(
      getHardwareLabelValidationError({
        value: 'My-Trezor_1',
        maxLength: 32,
        asciiOnly: true,
      }),
    ).toBeUndefined();
  });

  it('does not trim labels unless the device opts into normalization', () => {
    expect(
      getHardwareLabelValidationError({
        value: ' 12345678901234 ',
        maxLength: 14,
        asciiOnly: true,
      }),
    ).toBe('tooLong');
  });
});
