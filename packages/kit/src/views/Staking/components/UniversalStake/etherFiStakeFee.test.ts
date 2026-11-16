import { requiresEtherFiUsdtReset } from './etherFiStakeFee';

const params = {
  isEtherFi: true,
  isUsdt: true,
  loadingAllowance: false,
  allowance: '0.1',
  amount: '1',
};

describe('EtherFi USDT approval fee step', () => {
  it('recognizes a nonzero insufficient allowance as a reset step', () => {
    expect(requiresEtherFiUsdtReset(params)).toBe(true);
  });

  it('does not infer a reset from missing, zero or sufficient allowance', () => {
    expect(
      requiresEtherFiUsdtReset({ ...params, loadingAllowance: true }),
    ).toBe(false);
    expect(requiresEtherFiUsdtReset({ ...params, allowance: '0' })).toBe(false);
    expect(requiresEtherFiUsdtReset({ ...params, allowance: '1' })).toBe(false);
    expect(requiresEtherFiUsdtReset({ ...params, allowance: 'bad' })).toBe(
      false,
    );
  });

  it('does not change other assets or providers', () => {
    expect(requiresEtherFiUsdtReset({ ...params, isUsdt: false })).toBe(false);
    expect(requiresEtherFiUsdtReset({ ...params, isEtherFi: false })).toBe(
      false,
    );
  });
});
