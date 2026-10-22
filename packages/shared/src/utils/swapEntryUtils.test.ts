import {
  ARC_ERC20_USDC_CONTRACT_ADDRESS,
  ARC_EURC_CONTRACT_ADDRESS,
  ARC_NETWORK_ID,
} from '../../types/swap/SwapProvider.constants';

import {
  getSwapConfiguredDefaultToToken,
  isSwapEntryDisabledToken,
  shouldReserveSwapGas,
} from './swapEntryUtils';

import type { ISwapToken } from '../../types/swap/types';

function buildArcToken(overrides: Partial<ISwapToken> = {}): ISwapToken {
  return {
    contractAddress: ARC_ERC20_USDC_CONTRACT_ADDRESS,
    decimals: 6,
    isNative: false,
    name: 'USD Coin',
    networkId: ARC_NETWORK_ID,
    symbol: 'USDC',
    ...overrides,
  };
}

describe('isSwapEntryDisabledToken', () => {
  it('disables the Arc native USDC representation', () => {
    expect(
      isSwapEntryDisabledToken({
        contractAddress: '',
        isNative: true,
        networkId: ARC_NETWORK_ID,
      }),
    ).toBe(true);
  });

  it('keeps the Arc ERC-20 USDC representation tradable', () => {
    expect(isSwapEntryDisabledToken(buildArcToken())).toBe(false);
  });

  it('does not affect native tokens on other networks', () => {
    expect(
      isSwapEntryDisabledToken({
        contractAddress: '',
        isNative: true,
        networkId: 'evm--1',
      }),
    ).toBe(false);
  });
});

describe('getSwapConfiguredDefaultToToken', () => {
  it('resolves Arc ERC-20 USDC to Arc EURC', () => {
    expect(getSwapConfiguredDefaultToToken(buildArcToken())).toEqual(
      expect.objectContaining({
        contractAddress: ARC_EURC_CONTRACT_ADDRESS,
        isNative: false,
        networkId: ARC_NETWORK_ID,
        symbol: 'EURC',
      }),
    );
  });

  it('does not apply the Arc default pair to another Arc token', () => {
    expect(
      getSwapConfiguredDefaultToToken(
        buildArcToken({
          contractAddress: '0x1111111111111111111111111111111111111111',
          symbol: 'OTHER',
        }),
      ),
    ).toBeUndefined();
  });

  it('returns no configured token for networks without a default pair', () => {
    expect(
      getSwapConfiguredDefaultToToken({
        contractAddress: '',
        decimals: 9,
        isNative: true,
        name: 'Solana',
        networkId: 'sol--101',
        symbol: 'SOL',
      }),
    ).toBeUndefined();
  });
});

describe('shouldReserveSwapGas', () => {
  it('reserves gas for Arc ERC-20 USDC without changing its token identity', () => {
    const token = buildArcToken();
    expect(shouldReserveSwapGas(token)).toBe(true);
    expect(token.isNative).toBe(false);
    expect(isSwapEntryDisabledToken(token)).toBe(false);
  });

  it.each([
    { networkId: 'evm--1' },
    { contractAddress: ARC_EURC_CONTRACT_ADDRESS },
    { contractAddress: '' },
    { contractAddress: '0x1111111111111111111111111111111111111111' },
  ])('does not expand the Arc exception to other tokens: %j', (overrides) => {
    expect(shouldReserveSwapGas(buildArcToken(overrides))).toBe(false);
  });

  it('preserves native-token reserves and handles an unset input token', () => {
    expect(
      shouldReserveSwapGas(
        buildArcToken({
          networkId: 'evm--1',
          contractAddress: '',
          isNative: true,
        }),
      ),
    ).toBe(true);
    expect(shouldReserveSwapGas(undefined)).toBe(false);
  });
});
