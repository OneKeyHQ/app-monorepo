import {
  isTaskAccountAddress,
  normalizeTaskAccountAddress,
} from './taskAccount';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

describe('task account address identity', () => {
  it('normalizes EVM address casing', () => {
    expect(normalizeTaskAccountAddress('evm--1', '0xAbC')).toBe('0xabc');
    expect(
      isTaskAccountAddress(
        { networkId: 'evm--1', accountAddress: '0xAbC' },
        '0xaBc',
      ),
    ).toBe(true);
  });

  it('preserves case-sensitive addresses on other networks', () => {
    expect(normalizeTaskAccountAddress('sol--101', 'AbC')).toBe('AbC');
    expect(
      isTaskAccountAddress(
        { networkId: 'sol--101', accountAddress: 'AbC' },
        'abc',
      ),
    ).toBe(false);
  });
});
