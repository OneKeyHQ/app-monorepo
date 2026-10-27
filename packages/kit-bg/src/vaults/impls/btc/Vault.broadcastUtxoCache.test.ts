import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import VaultBtc from './Vault';

import type {
  IBroadcastTransactionByCustomRpcParams,
  IBroadcastTransactionParams,
} from '../../types';

const mockCustomRpcBroadcast: jest.Mock<
  Promise<string>,
  [rawTx: string]
> = jest.fn();

jest.mock('./sdkBtc/ClientBtc', () => ({
  // The vault instantiates a client per custom RPC broadcast; only the
  // broadcast call matters here.
  ClientBtc: class {
    broadcastTransaction = (rawTx: string) => mockCustomRpcBroadcast(rawTx);
  },
}));

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

const customRpcParams = {
  customRpcInfo: { rpc: 'https://btc-rpc.example.test', enabled: true },
  signedTx: params.signedTx,
} as unknown as IBroadcastTransactionByCustomRpcParams;

describe('VaultBtc.broadcastTransactionFromCustomRpc UTXO cache invalidation', () => {
  beforeEach(() => {
    mockCustomRpcBroadcast.mockReset();
  });

  it('drops the memoized UTXO pool after a custom RPC broadcast', async () => {
    mockCustomRpcBroadcast.mockResolvedValueOnce('txid-custom-rpc');
    const vault = createVault(jest.fn());

    const result =
      await vault.broadcastTransactionFromCustomRpc(customRpcParams);

    expect(result.txid).toBe('txid-custom-rpc');
    expect(mockCustomRpcBroadcast).toHaveBeenCalledWith('00');
    expect(vault._collectUTXOsInfoByApiWithCache.clear).toHaveBeenCalledTimes(
      1,
    );
    expect(vault._collectClaimedUtxosWithCache.clear).toHaveBeenCalledTimes(1);
  });

  it('drops the memoized UTXO pool even when the custom RPC broadcast fails', async () => {
    mockCustomRpcBroadcast.mockRejectedValueOnce(
      new OneKeyLocalError('custom-rpc-rejected'),
    );
    const vault = createVault(jest.fn());

    await expect(
      vault.broadcastTransactionFromCustomRpc(customRpcParams),
    ).rejects.toThrow('custom-rpc-rejected');
    expect(vault._collectUTXOsInfoByApiWithCache.clear).toHaveBeenCalledTimes(
      1,
    );
    expect(vault._collectClaimedUtxosWithCache.clear).toHaveBeenCalledTimes(1);
  });
});
