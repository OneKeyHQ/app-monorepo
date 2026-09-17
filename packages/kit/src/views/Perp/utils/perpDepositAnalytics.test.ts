import { getPerpDepositErrorCode } from './perpDepositAnalytics';

describe('getPerpDepositErrorCode', () => {
  it('normalizes string and numeric codes', () => {
    expect(getPerpDepositErrorCode({ code: ' 4001 ' })).toBe('4001');
    expect(getPerpDepositErrorCode({ code: 4100 })).toBe('4100');
  });

  it('falls back to the error name without exposing its message', () => {
    const error = new TypeError('sensitive provider response');
    expect(getPerpDepositErrorCode(error)).toBe('TypeError');
  });

  it('uses unknown for unsupported values', () => {
    expect(getPerpDepositErrorCode('raw error message')).toBe('unknown');
  });
});
