import {
  buildBorrowTag,
  buildLocalTxStatusSyncId,
  parseBorrowTag,
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
