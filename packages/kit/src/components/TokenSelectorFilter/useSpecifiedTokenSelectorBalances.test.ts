import { buildSpecifiedTokenSelectorTargetsKey } from './useSpecifiedTokenSelectorBalances';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));

describe('buildSpecifiedTokenSelectorTargetsKey', () => {
  it('is order-independent and normalizes EVM contract casing', () => {
    const first = buildSpecifiedTokenSelectorTargetsKey([
      {
        key: 'sol-usdc',
        networkId: 'sol--101',
        contractAddress: 'UsdcMint',
      },
      {
        key: 'eth-usdc',
        networkId: 'evm--1',
        contractAddress: '0xAbCd',
      },
    ]);
    const second = buildSpecifiedTokenSelectorTargetsKey([
      {
        key: 'eth-usdc',
        networkId: 'evm--1',
        contractAddress: '0xabcd',
      },
      {
        key: 'sol-usdc',
        networkId: 'sol--101',
        contractAddress: 'UsdcMint',
      },
    ]);

    expect(first).toBe(second);
  });

  it('keeps case-sensitive non-EVM token identities distinct', () => {
    const first = buildSpecifiedTokenSelectorTargetsKey([
      {
        key: 'sol-usdc',
        networkId: 'sol--101',
        contractAddress: 'UsdcMint',
      },
    ]);
    const second = buildSpecifiedTokenSelectorTargetsKey([
      {
        key: 'sol-usdc',
        networkId: 'sol--101',
        contractAddress: 'usdcmint',
      },
    ]);

    expect(first).not.toBe(second);
  });
});
