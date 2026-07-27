import { buildLocalTxStatusSyncId } from './utils';

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
