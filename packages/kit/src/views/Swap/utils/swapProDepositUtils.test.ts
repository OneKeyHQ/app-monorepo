import { getSwapProLoadedInputBalance } from './swapProDepositUtils';

describe('getSwapProLoadedInputBalance', () => {
  it('returns the balance stamped with the current account', () => {
    expect(
      getSwapProLoadedInputBalance({
        inputToken: { balanceParsed: '0', accountAddress: '0xabc' },
        accountAddress: '0xabc',
      }),
    ).toBe('0');
  });

  it('treats a balance fetched for another account as unknown', () => {
    expect(
      getSwapProLoadedInputBalance({
        inputToken: { balanceParsed: '0', accountAddress: '0xold' },
        accountAddress: '0xabc',
      }),
    ).toBeUndefined();
  });

  it('treats an unstamped token or missing account as unknown', () => {
    expect(
      getSwapProLoadedInputBalance({
        inputToken: { balanceParsed: '0' },
        accountAddress: '0xabc',
      }),
    ).toBeUndefined();
    expect(
      getSwapProLoadedInputBalance({
        inputToken: { balanceParsed: '0', accountAddress: '0xabc' },
        accountAddress: undefined,
      }),
    ).toBeUndefined();
    expect(
      getSwapProLoadedInputBalance({
        inputToken: undefined,
        accountAddress: '0xabc',
      }),
    ).toBeUndefined();
  });
});
