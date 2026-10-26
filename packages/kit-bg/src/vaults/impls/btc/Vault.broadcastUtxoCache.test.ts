import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import VaultBtc from './Vault';

import type { IBroadcastTransactionParams } from '../../types';

type IClearableCache = { clear: jest.Mock };

function createVault(broadcast: jest.Mock) {
  // Skip the constructor: only the broadcast path and the two UTXO caches
  // matter here, everything else on the instance stays untouched.
  const vault = Object.create(VaultBtc.prototype) as VaultBtc & {
    _collectUTXOsInfoByApiWithCache: IClearableCache;
    _collectClaimedUtxosWithCache: IClearableCache;
  };
  Object.assign(vault, {
    _collectUTXOsInfoByApiWithCache: { clear: jest.fn() },
    _collectClaimedUtxosWithCache: { clear: jest.fn() },
    backgroundApi: { serviceSend: { broadcastTransaction: broadcast } },
  });
  return vault;
}

const params = {
  accountId: 'hd-1--m/44h/0h/0h',
  networkId: 'btc--0',
  signedTx: { txid: '', rawTx: '00', encodedTx: null },
} as unknown as IBroadcastTransactionParams;

describe('VaultBtc.broadcastTransaction UTXO cache invalidation', () => {
  it('drops the memoized UTXO pool after a transaction is broadcast', async () => {
    const vault = createVault(jest.fn(async () => 'txid-1'));

    const result = await vault.broadcastTransaction(params);

    expect(result.txid).toBe('txid-1');
    expect(vault._collectUTXOsInfoByApiWithCache.clear).toHaveBeenCalledTimes(
      1,
    );
    expect(vault._collectClaimedUtxosWithCache.clear).toHaveBeenCalledTimes(1);
  });

  it('drops the memoized UTXO pool even when the broadcast fails', async () => {
    const vault = createVault(
      jest.fn(async () => {
        throw new OneKeyLocalError('txn-mempool-conflict');
      }),
    );

    await expect(vault.broadcastTransaction(params)).rejects.toThrow(
      'txn-mempool-conflict',
    );
    expect(vault._collectUTXOsInfoByApiWithCache.clear).toHaveBeenCalledTimes(
      1,
    );
    expect(vault._collectClaimedUtxosWithCache.clear).toHaveBeenCalledTimes(1);
  });
});
