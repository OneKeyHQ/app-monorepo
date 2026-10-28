/* eslint-disable import/first */
// cspell:ignore lightd
jest.mock('../../../dbs/local/localDbInstance');
jest.mock(
  '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect',
  () => ({
    ...jest.requireActual<
      typeof import('@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect')
    >('@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect'),
    fetchZcashChainTipDirect: jest.fn(async () => 1_000_000),
    fetchZcashLightdInfoDirect: jest.fn(async () => null),
  }),
);
import {
  fetchZcashChainTipDirect,
  fetchZcashLightdInfoDirect,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { getOnChainHistoryTxStatus } from '@onekeyhq/shared/src/utils/historyUtils';
import {
  EOnChainHistoryTxStatus,
  EOnChainHistoryTxType,
} from '@onekeyhq/shared/types/history';
import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
} from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityLocalHistory } from '../../../dbs/simple/entity/SimpleDbEntityLocalHistory';
import { SimpleDbEntityPrivacyChainCache } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainCache';
import { SimpleDbEntityPrivacyChainJournal } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainJournal';
import { SimpleDbEntityPrivacyChainState } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';
import VaultBtc from '../btc/Vault';

import Vault from './Vault';
import { getLocalWalletCapability } from './vaultLifecycle';
import { forgetZcashChainHeights } from './vaultTransparent';

import type { IEncodedTxZcash } from './types';

function inMemory<T extends { appStorage: unknown }>(entity: T): T {
  let saved: unknown;
  entity.appStorage = {
    getItem: async () => saved,
    setItem: async (_key: string, value: unknown) => {
      saved = value;
    },
  };
  return entity;
}

const accountId = 'account';
const txid = 'aa'.repeat(32);
const spentOutpoint = { txid: 'bb'.repeat(32), vout: 0 };
const expiryHeight = 100;
const historyParams = { networkId: 'zec--0', accountAddress: 't1-own' };

function row(
  id: string,
  status: EDecodedTxStatus,
  extra: Partial<IAccountHistoryTx['decodedTx']> = {},
): IAccountHistoryTx {
  return {
    id: `zec--0_t1-own_${id}`,
    privacyChainHistorySide: 'public',
    privacyChainHistoryPoolIds: [0],
    decodedTx: {
      txid: id,
      owner: 't1-own',
      signer: 't1-own',
      nonce: 0,
      actions: [],
      extraInfo: null,
      accountId,
      networkId: historyParams.networkId,
      status,
      createdAt: 1,
      ...extra,
    },
  };
}

function localSend(): IAccountHistoryTx {
  const encodedTx: IEncodedTxZcash = {
    inputs: [],
    outputs: [],
    inputsForCoinSelect: [],
    outputsForCoinSelect: [],
    fee: '0',
    txSize: 100,
    zcashMode: 'transparent',
    zcashTo: 't1-test',
    zcashAmountValue: '1',
    expiry: expiryHeight,
  };
  return {
    ...row(txid, EDecodedTxStatus.Pending, { encodedTx }),
    isLocalCreated: true,
  };
}

describe('expired transparent send reconciliation', () => {
  const originalFetch = globalThis.fetch;
  let networkFetch: jest.Mock;

  async function fixture() {
    const journalDb = inMemory(new SimpleDbEntityPrivacyChainJournal());
    const localHistory = inMemory(new SimpleDbEntityLocalHistory());
    const chainCache = inMemory(new SimpleDbEntityPrivacyChainCache());
    await localHistory.saveLocalHistoryTxs({
      ...historyParams,
      pendingTxs: [localSend()],
    });
    await journalDb.saveTransparentPendingTx({
      accountId,
      tx: {
        txid,
        rawTx: 'synthetic-signed',
        ownerId: 'reservation',
        spentOutpoints: [spentOutpoint],
        expiryHeight,
        createdAt: 1,
        broadcastState: 'accepted',
        broadcastAuthorized: true,
      },
    });
    const backend: {
      txs: IAccountHistoryTx[];
      snapshotComplete: boolean;
      tipHeight?: number;
    } = { txs: [], snapshotComplete: true };
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: historyParams.networkId,
      accountId,
      backgroundApi: {
        simpleDb: {
          privacyChainState: inMemory(new SimpleDbEntityPrivacyChainState()),
          privacyChainJournal: journalDb,
          privacyChainCache: chainCache,
          localHistory,
        },
        serviceToken: { getToken: async () => undefined },
        serviceAccount: { getDBAccount: async () => ({ address: 't1-own' }) },
      },
      getAccount: async () => ({ address: 't1-own' }),
      zcashFetchTransparentHistory: async () => ({
        ...backend,
        txs: backend.txs.map((tx) => ({
          ...tx,
          decodedTx: { ...tx.decodedTx },
        })),
      }),
    });
    const read = async () => {
      const rows = await vault.fetchAccountHistoryFromLocal({
        accountId,
        ...historyParams,
      });
      expectNoNodeQuery();
      return rows?.filter((tx) => tx.decodedTx.txid === txid) ?? [];
    };
    const inUse = async () =>
      journalDb.listTransparentOutpointsInUse({ accountId });
    return { vault, journalDb, localHistory, chainCache, backend, read, inUse };
  }

  beforeEach(() => {
    networkFetch = jest.fn(async () => {
      throw new OneKeyLocalError('no network in this test');
    });
    globalThis.fetch = networkFetch as unknown as typeof fetch;
  });
  function expectNoNodeQuery() {
    expect(networkFetch).not.toHaveBeenCalled();
    expect(fetchZcashChainTipDirect).not.toHaveBeenCalled();
    expect(fetchZcashLightdInfoDirect).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    jest.mocked(fetchZcashChainTipDirect).mockClear();
    jest.mocked(fetchZcashLightdInfoDirect).mockClear();
    forgetZcashChainHeights();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const lockedInputs = new Set([`${spentOutpoint.txid}:${spentOutpoint.vout}`]);

  it.each([
    ['the backend tip is within the margin', expiryHeight + 10, true],
    ['no backend tip is available', undefined, true],
    ['the backend snapshot is incomplete', expiryHeight + 11, false],
  ] as const)(
    'keeps the inputs locked when %s',
    async (_label, tipHeight, snapshotComplete) => {
      const { vault, backend, inUse } = await fixture();
      Object.assign(backend, { tipHeight, snapshotComplete });
      await vault.fetchAccountHistoryFromLocal({ accountId, ...historyParams });
      expectNoNodeQuery();
      expect(await inUse()).toEqual(lockedInputs);
    },
  );

  it('keeps the send pending while the backend tip is within the margin', async () => {
    const { vault, backend } = await fixture();
    backend.tipHeight = expiryHeight + 10;
    await vault.fetchAccountHistoryFromLocal({ accountId, ...historyParams });
    await expect(
      vault.getDroppedPendingTxs({ pendingTxs: [localSend()] }),
    ).resolves.toEqual([]);
  });

  it('releases the inputs and drops the send once the backend tip passes expiry + 10', async () => {
    const { vault, backend, inUse } = await fixture();
    backend.tipHeight = expiryHeight + 11;
    await vault.fetchAccountHistoryFromLocal({ accountId, ...historyParams });
    expectNoNodeQuery();
    expect(await inUse()).toEqual(new Set());
    await expect(
      vault.getDroppedPendingTxs({ pendingTxs: [localSend()] }),
    ).resolves.toEqual([localSend()]);
  });

  it.each([
    ['confirmed', row(txid, EDecodedTxStatus.Confirmed, { block: 90 })],
    [
      'in a block while still pending',
      row(txid, EDecodedTxStatus.Pending, { block: 90 }),
    ],
    ['failed', row(txid, EDecodedTxStatus.Failed)],
  ])(
    'releases the inputs once the backend reports the send %s',
    async (_label, backendRow) => {
      const { vault, backend, inUse } = await fixture();
      backend.txs = [backendRow];
      backend.tipHeight = expiryHeight;
      await vault.fetchAccountHistoryFromLocal({ accountId, ...historyParams });
      expect(await inUse()).toEqual(new Set());
    },
  );

  it('keeps the inputs locked while the backend lists the send as unmined pending', async () => {
    const { vault, backend, inUse } = await fixture();
    backend.txs = [row(txid, EDecodedTxStatus.Pending)];
    backend.tipHeight = expiryHeight;
    await vault.fetchAccountHistoryFromLocal({ accountId, ...historyParams });
    expect(await inUse()).toEqual(lockedInputs);
  });

  describe('when the account has no newer transaction', () => {
    function withBackendUtxos(
      vault: Vault,
      { confirmations }: { confirmations: number },
    ) {
      const scriptPubKey = `76a914${'95'.repeat(20)}88ac`;
      Object.assign(vault, {
        getAccount: async () => ({
          id: accountId,
          address: 't1-own',
          pathIndex: 0,
          path: "m/44'/133'/0'",
          xpub: 'xpub',
        }),
        // The dropped send never landed, so the backend still lists its input.
        baseFetchAccountDetails: async () => ({
          data: {
            data: {
              allUtxoList: [
                {
                  ...spentOutpoint,
                  value: '100000',
                  height: 50,
                  confirmations,
                  address: 't1-own',
                  path: "m/44'/133'/0'/0/0",
                },
              ],
            },
          },
        }),
        zcashGetApi: async () => ({
          parseTransparentTransactions: async () => [
            {
              txid: spentOutpoint.txid,
              isCoinbase: false,
              outputs: [{ valueZat: '100000', scriptPubKey }],
            },
          ],
        }),
      });
      Object.assign(vault.backgroundApi, {
        serviceSend: {
          getRawTransactions: async () => ({
            [spentOutpoint.txid]: { rawTx: 'raw' },
          }),
        },
      });
    }

    it('keeps the input frozen while the UTXO tip is within the margin', async () => {
      const { vault, inUse } = await fixture();
      // Tip = height + confirmations - 1 = expiry + 10.
      withBackendUtxos(vault, { confirmations: 61 });
      const fresh = await vault.zcashFetchFreshTransparentUtxos();
      expect(fresh.utxos).toEqual([]);
      expect(await inUse()).toEqual(lockedInputs);
      await expect(
        vault.getDroppedPendingTxs({ pendingTxs: [localSend()] }),
      ).resolves.toEqual([]);
    });

    it('releases the input from the UTXO tip and drops the row at the same height', async () => {
      const { vault, backend, inUse } = await fixture();
      withBackendUtxos(vault, { confirmations: 62 });
      const fresh = await vault.zcashFetchFreshTransparentUtxos();
      expect(fresh.utxos.map(({ txid: id, vout }) => `${id}:${vout}`)).toEqual([
        ...lockedInputs,
      ]);
      expect(await inUse()).toEqual(new Set());
      backend.tipHeight = undefined;
      await vault.fetchAccountHistoryFromLocal({ accountId, ...historyParams });
      await expect(
        vault.getDroppedPendingTxs({ pendingTxs: [localSend()] }),
      ).resolves.toEqual([localSend()]);
    });

    it("releases the input from the scanner's chain tip", async () => {
      const { vault, chainCache, backend, inUse } = await fixture();
      Object.assign(vault, {
        getLocalWalletChainTip: async () => expiryHeight + 11,
      });
      // Only the live height can release it: saving the tip fails.
      jest
        .spyOn(chainCache, 'setChainTip')
        .mockRejectedValue(new OneKeyLocalError('storage unavailable'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await getLocalWalletCapability(vault).getChainTip();
      await expect(
        chainCache.getChainTip({ networkId: historyParams.networkId }),
      ).resolves.toBeUndefined();
      backend.tipHeight = undefined;
      await vault.fetchAccountHistoryFromLocal({ accountId, ...historyParams });
      expectNoNodeQuery();
      expect(await inUse()).toEqual(new Set());
      await expect(
        vault.getDroppedPendingTxs({ pendingTxs: [localSend()] }),
      ).resolves.toEqual([localSend()]);
    });

    it('falls back to the saved chain tip when no live height is known', async () => {
      const { vault, chainCache, backend, inUse } = await fixture();
      await chainCache.setChainTip({
        networkId: historyParams.networkId,
        height: expiryHeight + 11,
      });
      backend.tipHeight = undefined;
      await vault.fetchAccountHistoryFromLocal({ accountId, ...historyParams });
      expect(await inUse()).toEqual(new Set());
      await expect(
        vault.getDroppedPendingTxs({ pendingTxs: [localSend()] }),
      ).resolves.toEqual([localSend()]);
    });

    it('takes the higher of the live and saved heights', async () => {
      const { vault, chainCache, backend, inUse } = await fixture();
      await chainCache.setChainTip({
        networkId: historyParams.networkId,
        height: expiryHeight + 11,
      });
      backend.tipHeight = expiryHeight;
      await vault.fetchAccountHistoryFromLocal({ accountId, ...historyParams });
      expect(await inUse()).toEqual(new Set());
    });
  });

  it('only drops transparent sends', async () => {
    const { vault, backend } = await fixture();
    backend.tipHeight = expiryHeight + 11;
    await vault.fetchAccountHistoryFromLocal({ accountId, ...historyParams });
    const shielded = row(txid, EDecodedTxStatus.Pending, {
      encodedTx: { zcashMode: 'shielded' } as unknown as IEncodedTxZcash,
    });
    await expect(
      vault.getDroppedPendingTxs({ pendingTxs: [shielded] }),
    ).resolves.toEqual([]);
  });

  it('leaves an unmined send to the local pending row', async () => {
    const { backend, read } = await fixture();
    backend.txs = [row(txid, EDecodedTxStatus.Pending)];
    expect(await read()).toEqual([]);
    backend.txs = [row(txid, EDecodedTxStatus.Pending, { block: 120 })];
    expect(await read()).toHaveLength(1);
  });

  it('shows a locally dropped send over the backend unmined placeholder', async () => {
    const { backend, localHistory, read } = await fixture();
    await localHistory.saveLocalHistoryTxs({
      ...historyParams,
      confirmedTxs: [row(txid, EDecodedTxStatus.Dropped)],
    });
    backend.txs = [row(txid, EDecodedTxStatus.Pending)];
    expect(await read()).toEqual([]);
    backend.txs = [row(txid, EDecodedTxStatus.Confirmed, { block: 120 })];
    expect((await read()).map((tx) => tx.decodedTx.status)).toEqual([
      EDecodedTxStatus.Confirmed,
    ]);
  });

  it('releases the accepted send and an unsigned reservation when pending transactions are cleared', async () => {
    const { journalDb, inUse } = await fixture();
    await journalDb.reserveTransparentOutpoints({
      accountId,
      ownerId: 'unsigned',
      outpoints: [{ txid: 'cc'.repeat(32), vout: 1 }],
      currentHeight: 1,
      expiryHeight: 1000,
    });
    expect((await inUse()).size).toBe(2);
    await journalDb.clearTransparentPendingSends({
      accountId,
      scope: 'pending',
    });
    expect(await journalDb.listTransparentPendingTxs({ accountId })).toEqual(
      [],
    );
    expect(await inUse()).toEqual(new Set());
  });
});

describe('backend tip from the transparent history snapshot', () => {
  function onChainRow(
    tx: string,
    status: EOnChainHistoryTxStatus,
    block?: number,
    confirmations?: number,
  ): IOnChainHistoryTx {
    return {
      tx,
      networkId: historyParams.networkId,
      key: `${historyParams.networkId}_`,
      riskLevel: 0,
      type: EOnChainHistoryTxType.Receive,
      sends: [],
      receives: [],
      from: 't1-other',
      to: 't1-own',
      value: '0.001',
      gasFee: '',
      gasFeeFiatValue: '',
      label: '',
      status,
      timestamp: 2,
      block,
      confirmations,
      nonce: 0,
      functionCode: '',
      params: [],
    };
  }

  async function fetchTip(rows: IOnChainHistoryTx[]) {
    jest
      .spyOn(VaultBtc.prototype, 'buildOnChainHistoryTx')
      .mockImplementation(async ({ onChainHistoryTx: tx }) =>
        row(tx.tx, getOnChainHistoryTxStatus(tx.status)),
      );
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId,
      networkId: historyParams.networkId,
      backgroundApi: {
        simpleDb: {
          privacyChainState: {
            getZcashAccountMeta: async () => null,
            getAccountEpoch: async () => undefined,
          },
          localHistory: {
            getAccountLocalHistoryConfirmedTxs: async () => [],
            getAccountLocalHistoryPendingTxs: async () => [],
          },
        },
        serviceAccount: {
          getDBAccountSafe: async () => ({ address: 't1-own', xpub: 'xpub' }),
        },
        serviceAccountProfile: { _getWalletTypeHeader: async () => ({}) },
        serviceHistory: {
          getOneKeyIdAuthHeaders: async () => ({}),
          getClient: async () => ({
            post: async () => ({
              data: {
                data: { data: rows, tokens: {}, nfts: {}, hasMore: false },
              },
            }),
          }),
        },
      },
    });
    return (
      await vault.zcashFetchTransparentHistory({
        accountId,
        ...historyParams,
        xpub: 'xpub',
      })
    ).tipHeight;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the tip from indexed block heights only', async () => {
    await expect(
      fetchTip([
        onChainRow('01', EOnChainHistoryTxStatus.Success, 90, 12),
        onChainRow('02', EOnChainHistoryTxStatus.Success, 95, 3),
        onChainRow('03', EOnChainHistoryTxStatus.Pending, 0, 0),
      ]),
    ).resolves.toBe(95);
  });

  it('never raises the tip from confirmations', async () => {
    await expect(
      fetchTip([onChainRow('01', EOnChainHistoryTxStatus.Success, 90, 50_000)]),
    ).resolves.toBe(90);
  });

  it('reports no tip when no row carries a height', async () => {
    await expect(
      fetchTip([onChainRow('03', EOnChainHistoryTxStatus.Pending)]),
    ).resolves.toBeUndefined();
  });
});
