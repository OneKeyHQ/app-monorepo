import {
  ETokenRiskLevel,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { isSwapTokenRisky } from './swapTokenRiskUtils';

const token = (overrides: Partial<ISwapToken> = {}) =>
  ({
    networkId: 'evm--1',
    contractAddress: '0x123',
    decimals: 18,
    name: 'Token',
    symbol: 'TKN',
    price: '1',
    ...overrides,
  }) as ISwapToken;

describe('isSwapTokenRisky', () => {
  it('keeps popular tokens out of the reminder flow', () => {
    expect(isSwapTokenRisky(token({ isPopular: true, price: undefined }))).toBe(
      false,
    );
  });

  it.each([
    { price: undefined },
    { price: '0' },
    { riskLevel: ETokenRiskLevel.SPAM },
    { riskLevel: ETokenRiskLevel.MALICIOUS },
  ])('flags an untrusted token %p', (overrides) => {
    expect(isSwapTokenRisky(token(overrides))).toBe(true);
  });

  it('does not flag a priced token without a risk level', () => {
    expect(isSwapTokenRisky(token())).toBe(false);
  });
});
