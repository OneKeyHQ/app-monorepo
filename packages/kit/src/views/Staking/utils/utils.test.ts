import { EthereumWETH } from '@onekeyhq/shared/src/consts/addresses';
import type { IEarnTokenItem } from '@onekeyhq/shared/types/staking';

import {
  buildBorrowTag,
  buildLocalTxStatusSyncId,
  createEarnActionScopeGuard,
  normalizeEarnActionAmountScope,
  parseBorrowTag,
  resolveEarnStakeRequestSymbol,
  resolveEarnStakeType,
  resolveSelectedStakeAsset,
  resolveStakeSubmissionConfirmation,
  resolveWrappedStakeAsset,
  validateWrapStake,
} from './utils';

describe('wrap stake validation', () => {
  it('accepts only a successful current validation', async () => {
    const check = jest.fn().mockResolvedValue({ code: 0, message: '' });
    await expect(
      validateWrapStake({ check, isCurrent: () => true }),
    ).resolves.toEqual({ status: 'ready' });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('rejects a protocol error or an alert', async () => {
    await expect(
      validateWrapStake({
        check: async () => ({ code: 1, message: 'Paused' }),
        isCurrent: () => true,
      }),
    ).resolves.toMatchObject({ status: 'invalid', message: 'Paused' });
    await expect(
      validateWrapStake({
        check: async () => ({
          code: 0,
          message: '',
          data: { alerts: [{ type: 'critical', text: { text: 'Locked' } }] },
        }),
        isCurrent: () => true,
      }),
    ).resolves.toMatchObject({
      status: 'invalid',
      alerts: [{ text: { text: 'Locked' } }],
    });
  });

  it.each([undefined, null, '', ' ', 'invalid'])(
    'rejects a malformed validation code %s',
    async (code) => {
      await expect(
        validateWrapStake({
          check: async () => ({ code, message: '' }),
          isCurrent: () => true,
        }),
      ).resolves.toMatchObject({ status: 'invalid' });
    },
  );

  it('ignores a successful response after its action changes', async () => {
    let finish: (value: { code: number; message: string }) => void = () =>
      undefined;
    let current = true;
    const result = validateWrapStake({
      check: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      isCurrent: () => current,
    });
    current = false;
    finish({ code: 0, message: '' });
    await expect(result).resolves.toEqual({ status: 'stale' });
  });

  it('does not turn a failed request into a valid result', async () => {
    const error = new Error('network unavailable');
    await expect(
      validateWrapStake({
        check: async () => {
          throw error;
        },
        isCurrent: () => true,
      }),
    ).rejects.toBe(error);
  });
});

describe('stake submission confirmation', () => {
  const cached = { effectiveApy: '3' };

  it('does not use a deposit preview during the wrap step', async () => {
    const fetchConfirmation = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(
      resolveStakeSubmissionConfirmation({
        deferredSetupQuote: true,
        isWrapStake: true,
        requiresCurrentQuote: false,
        shouldApprove: false,
        confirmation: cached,
        isCurrentConfirmation: false,
        fetchConfirmation,
      }),
    ).resolves.toBeUndefined();
    expect(fetchConfirmation).not.toHaveBeenCalled();
  });

  it('fetches the deposit preview after approval and propagates failure', async () => {
    const error = new Error('preview unavailable');
    const fetchConfirmation = jest.fn().mockRejectedValue(error);
    await expect(
      resolveStakeSubmissionConfirmation({
        deferredSetupQuote: true,
        isWrapStake: false,
        requiresCurrentQuote: false,
        shouldApprove: true,
        confirmation: cached,
        isCurrentConfirmation: true,
        fetchConfirmation,
      }),
    ).rejects.toBe(error);
    expect(fetchConfirmation).toHaveBeenCalledTimes(1);
  });

  it('refreshes a stale Pendle quote but preserves unrelated protocol behavior', async () => {
    const fresh = { effectiveApy: '4' };
    const fetchConfirmation = jest.fn().mockResolvedValue(fresh);
    const options = {
      deferredSetupQuote: false,
      isWrapStake: false,
      shouldApprove: false,
      confirmation: cached,
      isCurrentConfirmation: false,
      fetchConfirmation,
    };
    await expect(
      resolveStakeSubmissionConfirmation({
        ...options,
        requiresCurrentQuote: true,
      }),
    ).resolves.toBe(fresh);
    await expect(
      resolveStakeSubmissionConfirmation({
        ...options,
        requiresCurrentQuote: false,
      }),
    ).resolves.toBe(cached);
    expect(fetchConfirmation).toHaveBeenCalledTimes(1);
  });
});

describe('earn action scope guard', () => {
  it('keeps equivalent valid amounts in the same scope without collapsing invalid input', () => {
    expect(normalizeEarnActionAmountScope('1.0')).toBe(
      normalizeEarnActionAmountScope('1'),
    );
    expect(normalizeEarnActionAmountScope('')).not.toBe(
      normalizeEarnActionAmountScope('0'),
    );
    expect(normalizeEarnActionAmountScope('invalid')).not.toBe(
      normalizeEarnActionAmountScope('0'),
    );
  });
  it('continues an approval only while its original scope remains current', async () => {
    const scope = createEarnActionScopeGuard();
    scope.update('account-a|asset-a|amount-1');
    const sameAction = scope.capture();
    await Promise.resolve();
    expect(sameAction()).toBe(true);

    scope.update('account-a|asset-a|amount-2');
    scope.update('account-a|asset-a|amount-1');
    expect(sameAction()).toBe(false);
    expect(scope.capture()()).toBe(true);
  });

  it('invalidates in-flight approval after the owning form is removed', () => {
    const scope = createEarnActionScopeGuard();
    scope.update('account-a|asset-a|amount-1');
    const action = scope.capture();
    scope.invalidate();
    expect(action()).toBe(false);
  });
});

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

  it.each(['etherfi', 'native'])(
    'selects canonical Ethereum WETH for %s, even after a duplicate symbol',
    (providerName) => {
      const fake = assets[1];
      const genuine = {
        ...fake,
        info: { ...fake.info, address: EthereumWETH },
      };
      expect(
        resolveWrappedStakeAsset({
          assets: [fake, genuine],
          networkId: 'evm--1',
          providerName,
        }),
      ).toBe(genuine);
    },
  );

  it.each([
    [
      'etherfi',
      'wrong address',
      { address: '0x0000000000000000000000000000000000000001' },
      'evm--1',
    ],
    [
      'native',
      'wrong address',
      { address: '0x0000000000000000000000000000000000000001' },
      'evm--1',
    ],
    ['etherfi', 'wrong decimals', { decimals: 6 }, 'evm--1'],
    ['native', 'wrong decimals', { decimals: 6 }, 'evm--1'],
    ['etherfi', 'native token', { isNative: true }, 'evm--1'],
    ['native', 'native token', { isNative: true }, 'evm--1'],
    ['etherfi', 'wrong token network', { networkId: 'evm--137' }, 'evm--1'],
    ['native', 'wrong token network', { networkId: 'evm--137' }, 'evm--1'],
    ['etherfi', 'wrong chain', {}, 'evm--137'],
    ['native', 'wrong chain', {}, 'evm--137'],
  ])(
    'rejects %s %s when selecting WETH',
    (providerName, _label, overrides, networkId) => {
      const invalid = {
        ...assets[1],
        info: { ...assets[1].info, address: EthereumWETH, ...overrides },
      };
      expect(
        resolveWrappedStakeAsset({
          assets: [invalid],
          networkId,
          providerName,
        }),
      ).toBeUndefined();
    },
  );

  it.each(['native', 'etherfi'])(
    'accepts %s WETH without optional network and native metadata',
    (providerName) => {
      const wrapped = {
        ...assets[1],
        info: { ...assets[1].info, address: EthereumWETH, isNative: undefined },
      };
      expect(
        resolveWrappedStakeAsset({
          assets: [wrapped],
          networkId: 'evm--1',
          providerName,
        }),
      ).toBe(wrapped);
    },
  );

  it('does not enable wrap asset selection for an unsupported provider', () => {
    const wrapped = {
      ...assets[1],
      info: { ...assets[1].info, address: EthereumWETH },
    };
    expect(
      resolveWrappedStakeAsset({
        assets: [wrapped],
        networkId: 'evm--1',
        providerName: 'morpho',
      }),
    ).toBeUndefined();
  });

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
