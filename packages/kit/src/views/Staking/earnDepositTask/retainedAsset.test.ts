import type { IEarnTokenInfo } from '@onekeyhq/shared/types/staking';

import { isRetainedDepositToken } from './retainedAsset';

const tokenInfo: IEarnTokenInfo = {
  accountId: 'account',
  networkId: 'evm--1',
  provider: 'spark',
  vault: 'vault',
  balanceParsed: '12',
  price: '1',
  token: {
    uniqueKey: 'token',
    address: '0xAbC',
    networkId: 'evm--1',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    isNative: false,
    logoURI: '',
    totalSupply: '0',
    riskLevel: 0,
    coingeckoId: '',
  },
};
const identity = {
  accountId: 'account',
  networkId: 'evm--1',
  inputTokenAddress: '0xabc',
};

describe('fixed retained deposit token', () => {
  it('matches the original account, network and EVM token without a selectable asset list', () => {
    expect(isRetainedDepositToken({ tokenInfo, identity })).toBe(true);
  });

  it.each([
    { ...tokenInfo, accountId: 'other-account' },
    { ...tokenInfo, networkId: 'evm--137' },
    {
      ...tokenInfo,
      token: { ...tokenInfo.token, networkId: 'evm--137' },
    },
    { ...tokenInfo, token: { ...tokenInfo.token, address: '0xdef' } },
    { ...tokenInfo, token: { ...tokenInfo.token, isNative: true } },
    undefined,
  ])('does not restore a missing or mismatched entry: %p', (entry) => {
    expect(isRetainedDepositToken({ tokenInfo: entry, identity })).toBe(false);
  });

  it('does not substitute an ERC20 token for a native-asset task', () => {
    const nativeIdentity = { ...identity, inputTokenAddress: '' };
    expect(
      isRetainedDepositToken({ tokenInfo, identity: nativeIdentity }),
    ).toBe(false);
    expect(
      isRetainedDepositToken({
        tokenInfo: {
          ...tokenInfo,
          token: { ...tokenInfo.token, address: '', isNative: true },
        },
        identity: nativeIdentity,
      }),
    ).toBe(true);
  });
});
