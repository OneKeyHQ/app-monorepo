import {
  ARC_ERC20_USDC_CONTRACT_ADDRESS,
  ARC_EURC_CONTRACT_ADDRESS,
  ARC_NETWORK_ID,
} from '../../types/swap/SwapProvider.constants';

import {
  getSwapConfiguredDefaultToToken,
  getSwapDefaultCounterpartToken,
  getSwapEntryDefaultToToken,
  isSwapEntryDisabledToken,
  shouldReserveSwapGas,
} from './swapEntryUtils';

import type { ISwapNetwork, ISwapToken } from '../../types/swap/types';

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

describe('API defaults preserve asset-entry selection rules', () => {
  const sol = {
    networkId: 'sol--101',
    contractAddress: '',
    symbol: 'SOL',
    decimals: 9,
    isNative: true,
  };
  const usdt = {
    networkId: sol.networkId,
    contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    decimals: 6,
    isNative: false,
  };
  const network = {
    networkId: sol.networkId,
    defaultSelectTokenDetail: { from: sol, to: usdt },
  };
  it('uses the configured stablecoin for native SOL', () => {
    expect(
      getSwapDefaultCounterpartToken({
        fromToken: sol,
        swapNetworks: [network as ISwapNetwork],
      }),
    ).toEqual(usdt);
  });
  it('keeps native SOL as the counterpart for an ordinary SPL token', () => {
    expect(
      getSwapDefaultCounterpartToken({
        fromToken: { ...usdt, contractAddress: 'another-token' },
        swapNetworks: [network as ISwapNetwork],
      }),
    ).toEqual(sol);
  });
  it('retains the local native fallback when the configured pair contains two ERC20 tokens', () => {
    const token = { ...usdt, networkId: 'evm--1', contractAddress: '0xother' };
    const erc20Network = {
      ...network,
      networkId: token.networkId,
      defaultSelectTokenDetail: {
        from: { ...token, contractAddress: '0xshei' },
        to: { ...token, contractAddress: '0xusdc' },
      },
    };
    expect(
      getSwapDefaultCounterpartToken({
        fromToken: token,
        swapNetworks: [erc20Network as ISwapNetwork],
      })?.symbol,
    ).toBe('ETH');
  });
});

describe('asset entry counterpart routing', () => {
  const btc: ISwapToken = {
    networkId: 'btc--0',
    contractAddress: '',
    symbol: 'BTC',
    decimals: 8,
    isNative: true,
  };

  it.each([undefined, false, true])(
    'keeps native BTC bridged to ETH with same-chain support %s',
    (isSupportSwap) => {
      expect(
        getSwapEntryDefaultToToken({
          fromToken: btc,
          isSupportSwap,
          isSupportCrossChain: true,
        }),
      ).toEqual(
        expect.objectContaining({ networkId: 'evm--1', symbol: 'ETH' }),
      );
    },
  );

  it('keeps the cross-chain-only route for an ordinary token', () => {
    expect(
      getSwapEntryDefaultToToken({
        fromToken: {
          ...btc,
          networkId: 'sol--101',
          symbol: 'SOL',
          decimals: 9,
        },
        isSupportSwap: false,
        isSupportCrossChain: true,
      }),
    ).toEqual(expect.objectContaining({ networkId: 'evm--1', symbol: 'ETH' }));
  });

  it('uses local stablecoin defaults for supported native tokens', () => {
    expect(
      getSwapEntryDefaultToToken({
        fromToken: { ...btc, networkId: 'evm--1', symbol: 'ETH', decimals: 18 },
        isSupportSwap: true,
      }),
    ).toEqual(expect.objectContaining({ networkId: 'evm--1', symbol: 'USDC' }));
  });

  it.each(['0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', '0xother'])(
    'uses BNB as the counterpart for a non-native BSC token %s',
    (contractAddress) => {
      expect(
        getSwapDefaultCounterpartToken({
          fromToken: {
            ...btc,
            networkId: 'evm--56',
            isNative: false,
            contractAddress,
          },
        }),
      ).toEqual(
        expect.objectContaining({
          networkId: 'evm--56',
          symbol: 'BNB',
          isNative: true,
        }),
      );
    },
  );

  it('keeps the Arc ERC-20 pair without selecting native USDC for other tokens', () => {
    expect(
      getSwapEntryDefaultToToken({
        fromToken: buildArcToken(),
        isSupportSwap: true,
      })?.symbol,
    ).toBe('EURC');
    expect(
      getSwapEntryDefaultToToken({
        fromToken: buildArcToken({ contractAddress: '0xother' }),
        isSupportSwap: true,
      }),
    ).toBeUndefined();
  });
});

describe('default source preserves ordinary Swap semantics', () => {
  it('keeps the Arc exception scoped to asset entries', () => {
    expect(
      getSwapDefaultCounterpartToken({ fromToken: buildArcToken() }),
    ).toBeUndefined();
    expect(
      getSwapEntryDefaultToToken({
        fromToken: buildArcToken(),
        isSupportSwap: true,
      })?.symbol,
    ).toBe('EURC');
  });

  it.each([false, true])(
    'uses the networks counterpart for native SOL with reversed pair=%s',
    (reversed) => {
      const sol: ISwapToken = {
        networkId: 'sol--101',
        contractAddress: '',
        symbol: 'SOL',
        decimals: 9,
        isNative: true,
      };
      const usdt: ISwapToken = {
        networkId: sol.networkId,
        contractAddress: 'USDT',
        symbol: 'USDT',
        decimals: 6,
        isNative: false,
      };
      const network: ISwapNetwork = {
        networkId: sol.networkId,
        name: 'Solana',
        symbol: 'SOL',
        defaultSelectTokenDetail: {
          from: reversed ? usdt : sol,
          to: reversed ? sol : usdt,
        },
      };
      expect(
        getSwapEntryDefaultToToken({
          fromToken: sol,
          swapNetworks: [network],
          isSupportSwap: true,
        }),
      ).toBe(usdt);
      expect(
        getSwapDefaultCounterpartToken({
          fromToken: usdt,
          swapNetworks: [network],
        }),
      ).toBe(sol);
    },
  );
});
