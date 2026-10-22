import type { IEarnTokenItem } from '@onekeyhq/shared/types/staking';

import {
  buildBorrowTag,
  buildLocalTxStatusSyncId,
  parseBorrowTag,
  resolveEarnStakeRequestSymbol,
  resolveEarnStakeType,
  resolveSelectedStakeAsset,
} from './utils';

describe('buildLocalTxStatusSyncId', () => {
  it('keeps existing provider tags backward compatible', () => {
    expect(
      buildLocalTxStatusSyncId({
        providerName: 'Native',
        tokenSymbol: 'USDT',
        protocolVault: '0xNativeVault',
      }),
    ).toBe('native-usdt');
  });

  it('scopes Bitway tags by vault to isolate duplicate symbols', () => {
    expect(
      buildLocalTxStatusSyncId({
        providerName: 'Bitway',
        tokenSymbol: 'USDT',
        protocolVault: '0xAbCd',
      }),
    ).toBe('bitway-usdt-0xabcd');
  });
});

describe('borrow claim tags', () => {
  it('preserves the legacy claim tag shape when no scope is provided', () => {
    const tag = buildBorrowTag({
      provider: 'Aave',
      action: 'claim',
      claimIds: ['reward-2', 'reward-1'],
    });

    expect(tag).toBe('borrow:aave:claim:reward-1,reward-2');
    expect(parseBorrowTag(tag)).toEqual({
      provider: 'aave',
      action: 'claim',
      claimIds: ['reward-1', 'reward-2'],
    });
  });

  it('round-trips a versioned claim scope and normalizes EVM markets', () => {
    const tag = buildBorrowTag({
      provider: 'Aave',
      action: 'claim',
      claimIds: ['reward-1'],
      claimScope: {
        networkId: 'evm--1',
        marketAddress: '0xAbCd',
      },
    });

    expect(tag).toBe('borrow:aave:claim:reward-1:v1:evm--1:0xabcd');
    expect(parseBorrowTag(tag)).toEqual({
      provider: 'aave',
      action: 'claim',
      claimIds: ['reward-1'],
      claimScope: {
        networkId: 'evm--1',
        marketAddress: '0xabcd',
      },
    });
  });
});

describe('borrow set-collateral tags', () => {
  it('preserves the provider-level tag when no reserve scope is provided', () => {
    expect(buildBorrowTag({ provider: 'Aave', action: 'setCollateral' })).toBe(
      'borrow:aave:setCollateral',
    );
  });

  it('round-trips a versioned reserve scope and normalizes EVM addresses', () => {
    const tag = buildBorrowTag({
      provider: 'Aave',
      action: 'setCollateral',
      setCollateralScope: {
        networkId: 'evm--1',
        marketAddress: '0xAbCd',
        reserveAddress: '0xDeF0',
      },
    });

    expect(tag).toBe('borrow:aave:setCollateral:v1:evm--1:0xabcd:0xdef0');
    expect(parseBorrowTag(tag)).toEqual({
      provider: 'aave',
      action: 'setCollateral',
      setCollateralScope: {
        networkId: 'evm--1',
        marketAddress: '0xabcd',
        reserveAddress: '0xdef0',
      },
    });
  });

  it('round-trips an empty native reserve address', () => {
    const tag = buildBorrowTag({
      provider: 'Aave',
      action: 'setCollateral',
      setCollateralScope: {
        networkId: 'evm--1',
        marketAddress: '0xAbCd',
        reserveAddress: '',
      },
    });

    expect(tag).toBe('borrow:aave:setCollateral:v1:evm--1:0xabcd:');
    expect(parseBorrowTag(tag)).toEqual({
      provider: 'aave',
      action: 'setCollateral',
      setCollateralScope: {
        networkId: 'evm--1',
        marketAddress: '0xabcd',
        reserveAddress: '',
      },
    });
  });
});

describe('Earn deposit asset paths', () => {
  it.each([
    ['Etherfi', 'eETH', 'ETH', true, 'wrap', 'ETH'],
    ['Etherfi', 'ETH', 'WETH', false, 'normal', 'WETH'],
    ['Etherfi', 'ETH', 'eETH', false, undefined, 'eETH'],
    ['Etherfi', 'USDC', 'USDT', false, undefined, 'USDT'],
    ['Native', 'WETH', 'ETH', true, 'wrap', 'WETH'],
    ['Native', 'WETH', 'WETH', false, 'normal', 'WETH'],
    ['Native', 'USDT', 'USDT', false, undefined, 'USDT'],
    ['Pendle', 'PT-USDE', 'ETH', true, undefined, 'PT-USDE'],
  ])(
    '%s %s entry selecting %s resolves its deposit path and request identity',
    (
      providerName,
      protocolSymbol,
      tokenSymbol,
      tokenIsNative,
      expectedType,
      expectedSymbol,
    ) => {
      expect(
        resolveEarnStakeType({
          providerName,
          vaultSymbol: protocolSymbol,
          tokenSymbol,
          tokenIsNative,
        }),
      ).toBe(expectedType);
      expect(
        resolveEarnStakeRequestSymbol({
          providerName,
          protocolSymbol,
          tokenSymbol,
          tokenIsNative,
          wrappedTokenSymbol: 'WETH',
        }),
      ).toBe(expectedSymbol);
    },
  );

  const assets: IEarnTokenItem[] = ['ETH', 'WETH', 'eETH'].map(
    (symbol, index) => ({
      info: {
        address: index
          ? `0x000000000000000000000000000000000000000${index}`
          : '',
        symbol,
        name: symbol,
        decimals: 18,
        isNative: index === 0,
      },
      balance: '0',
      balanceParsed: '0',
      fiatValue: '0',
      price: '1',
      price24h: '0',
    }),
  );

  it.each([assets[1], assets[2]])(
    'preserves a $info.symbol entry instead of defaulting to native ETH',
    (entry) => {
      expect(
        resolveSelectedStakeAsset({ assets, initialToken: entry.info }),
      ).toBe(entry);
    },
  );

  it('retains the selected WETH asset when balances refresh', () => {
    const refreshedWeth = { ...assets[1], balanceParsed: '2' };
    expect(
      resolveSelectedStakeAsset({
        assets: [assets[0], refreshedWeth, assets[2]],
        selectedToken: assets[1].info,
        initialToken: assets[2].info,
      }),
    ).toBe(refreshedWeth);
  });

  it('does not keep an asset from another vault or a stale list while loading', () => {
    expect(
      resolveSelectedStakeAsset({
        assets: [assets[0]],
        selectedToken: assets[1].info,
        initialToken: assets[2].info,
      }),
    ).toBe(assets[0]);
    expect(
      resolveSelectedStakeAsset({
        assets: [],
        selectedToken: assets[1].info,
        initialToken: assets[2].info,
      }),
    ).toBeUndefined();
  });
});
