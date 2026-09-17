import {
  ARC_ERC20_USDC_CONTRACT_ADDRESS,
  ARC_NETWORK_ID,
} from '../../types/swap/SwapProvider.constants';

import {
  getSwapConfiguredCrossNetworkDefaultToToken,
  isSwapEntryDisabledToken,
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

describe('getSwapConfiguredCrossNetworkDefaultToToken', () => {
  it('resolves Arc ERC-20 USDC to Ethereum ETH', () => {
    expect(
      getSwapConfiguredCrossNetworkDefaultToToken(buildArcToken()),
    ).toEqual(
      expect.objectContaining({
        contractAddress: '',
        isNative: true,
        networkId: 'evm--1',
        symbol: 'ETH',
      }),
    );
  });

  it('does not apply the Arc default pair to another Arc token', () => {
    expect(
      getSwapConfiguredCrossNetworkDefaultToToken(
        buildArcToken({
          contractAddress: '0x1111111111111111111111111111111111111111',
          symbol: 'OTHER',
        }),
      ),
    ).toBeUndefined();
  });

  it('leaves same-network defaults to the capability resolver', () => {
    expect(
      getSwapConfiguredCrossNetworkDefaultToToken({
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
