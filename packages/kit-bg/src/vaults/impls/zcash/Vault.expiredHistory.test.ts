/* eslint-disable import/first */
// cspell:ignore lightd
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
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
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityLocalHistory } from '../../../dbs/simple/entity/SimpleDbEntityLocalHistory';
import { SimpleDbEntityPrivacyChainJournal } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainJournal';
import { SimpleDbEntityZcash } from '../../../dbs/simple/entity/SimpleDbEntityZcash';
import VaultBtc from '../btc/Vault';

import Vault from './Vault';

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

// Mined backend rows newer than the send, enough to fill the 50-row cache.
const fillers = Array.from({ length: 60 }, (_, index) =>
  row(index.toString(16).padStart(64, '0'), EDecodedTxStatus.Confirmed, {
    createdAt: 1000 + index,
  }),
);

describe('expired transparent send reconciliation', () => {
  const originalFetch = globalThis.fetch;
  let networkFetch: jest.Mock;

  async function fixture() {
    const journalDb = inMemory(new SimpleDbEntityPrivacyChainJournal());
    const localHistory = inMemory(new SimpleDbEntityLocalHistory());
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
          zcash: inMemory(new SimpleDbEntityZcash()),
          privacyChainJournal: journalDb,
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
    return { vault, journalDb, localHistory, backend, read, inUse };
  }

  beforeEach(() => {
    networkFetch = jest.fn(async () => {
      throw new OneKeyLocalError('no network in this test');
    });
    globalThis.fetch = networkFetch as unknown as typeof fetch;
  });
  // Expiry is decided from backend data only; the user's lightwalletd is never asked.
  function expectNoNodeQuery() {
    expect(networkFetch).not.toHaveBeenCalled();
    expect(fetchZcashChainTipDirect).not.toHaveBeenCalled();
    expect(fetchZcashLightdInfoDirect).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    jest.mocked(fetchZcashChainTipDirect).mockClear();
    jest.mocked(fetchZcashLightdInfoDirect).mockClear();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it.each([
    ['the backend tip is within the margin', expiryHeight + 10, true],
    ['no backend tip is available', undefined, true],
    ['the backend snapshot is incomplete', expiryHeight + 50, false],
  ])(
    'keeps the send pending and its inputs locked when %s',
    async (_case, tipHeight, snapshotComplete) => {
      const { journalDb, localHistory, backend, read, inUse } = await fixture();
      Object.assign(backend, { tipHeight, snapshotComplete });
      const rows = await read();
      expect(rows.map((tx) => tx.decodedTx.status)).toEqual([
        EDecodedTxStatus.Pending,
      ]);
      expect(
        await journalDb.listTransparentPendingTxs({ accountId }),
      ).toHaveLength(1);
      expect(await inUse()).toEqual(
        new Set([`${spentOutpoint.txid}:${spentOutpoint.vout}`]),
      );
      expect(
        await localHistory.getAccountLocalHistoryPendingTxs(historyParams),
      ).toHaveLength(1);
    },
  );

  it.each([
    ['does not list it', [] as IAccountHistoryTx[]],
    ['still lists it as pending', [row(txid, EDecodedTxStatus.Pending)]],
  ])(
    'drops an expired send when the backend %s and releases its inputs',
    async (_case, txs) => {
      const { journalDb, localHistory, backend, read, inUse } = await fixture();
      Object.assign(backend, { txs, tipHeight: expiryHeight + 11 });
      const rows = await read();
      expect(rows.map((tx) => tx.decodedTx)).toEqual([
        expect.objectContaining({
          status: EDecodedTxStatus.Dropped,
          broadcastOutcomeUnknown: false,
          createdAt: 1,
        }),
      ]);
      expect(await journalDb.listTransparentPendingTxs({ accountId })).toEqual(
        [],
      );
      expect(await inUse()).toEqual(new Set());
      expect(
        await localHistory.getAccountLocalHistoryPendingTxs(historyParams),
      ).toEqual([]);
      expect(
        (await localHistory.getAccountLocalHistoryConfirmedTxs(historyParams))
          .filter((tx) => tx.decodedTx.txid === txid)
          .map((tx) => tx.decodedTx.status),
      ).toEqual([EDecodedTxStatus.Dropped]);
    },
  );

  it('never resubmits an unknown-outcome send on history reads', async () => {
    const { journalDb, backend, read, inUse } = await fixture();
    const [journal] = await journalDb.listTransparentPendingTxs({ accountId });
    await journalDb.saveTransparentPendingTx({
      accountId,
      tx: { ...journal, broadcastState: 'unknown' },
    });
    const transport = jest.spyOn(VaultBtc.prototype, 'broadcastTransaction');
    backend.tipHeight = expiryHeight + 10;
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const rows = await read();
      expect(rows.map((tx) => tx.decodedTx)).toEqual([
        expect.objectContaining({
          status: EDecodedTxStatus.Pending,
          broadcastOutcomeUnknown: true,
        }),
      ]);
    }
    expect(transport).not.toHaveBeenCalled();
    expect(await journalDb.listTransparentPendingTxs({ accountId })).toEqual([
      expect.objectContaining({ broadcastState: 'unknown' }),
    ]);
    expect(await inUse()).toEqual(
      new Set([`${spentOutpoint.txid}:${spentOutpoint.vout}`]),
    );
  });

  it('never drops a send the backend reports mined', async () => {
    const { localHistory, backend, read } = await fixture();
    Object.assign(backend, {
      txs: [row(txid, EDecodedTxStatus.Confirmed)],
      tipHeight: expiryHeight + 500,
    });
    const rows = await read();
    expect(rows.map((tx) => tx.decodedTx.status)).toEqual([
      EDecodedTxStatus.Confirmed,
    ]);
    expect(
      (await localHistory.getAccountLocalHistoryConfirmedTxs(historyParams))
        .filter((tx) => tx.decodedTx.txid === txid)
        .map((tx) => tx.decodedTx.status),
    ).toEqual([EDecodedTxStatus.Confirmed]);
  });

  it('never drops a send the backend reports in a block while still pending', async () => {
    const { journalDb, backend, read, inUse } = await fixture();
    Object.assign(backend, {
      txs: [row(txid, EDecodedTxStatus.Pending, { block: expiryHeight - 1 })],
      tipHeight: expiryHeight + 500,
    });
    const rows = await read();
    expect(rows.map((tx) => tx.decodedTx.status)).not.toContain(
      EDecodedTxStatus.Dropped,
    );
    expect(
      await journalDb.listTransparentPendingTxs({ accountId }),
    ).toHaveLength(1);
    expect(await inUse()).toEqual(
      new Set([`${spentOutpoint.txid}:${spentOutpoint.vout}`]),
    );
  });

  it('drops an expired send only once an indexed block passes expiry + 10', async () => {
    const { vault, journalDb, read } = await fixture();
    const indexed: IOnChainHistoryTx[] = [];
    const mined = (tx: string, block: number, confirmations: number) =>
      ({
        tx,
        networkId: historyParams.networkId,
        key: `${historyParams.networkId}_`,
        type: EOnChainHistoryTxType.Receive,
        sends: [],
        receives: [],
        from: 't1-other',
        to: 't1-own',
        value: '0.001',
        gasFee: '',
        status: EOnChainHistoryTxStatus.Success,
        block,
        confirmations,
      }) as unknown as IOnChainHistoryTx;
    // Query the backend through the real history fetch.
    Reflect.deleteProperty(vault, 'zcashFetchTransparentHistory');
    Object.assign(vault.backgroundApi, {
      serviceAccount: {
        getDBAccountSafe: async () => ({ address: 't1-own', xpub: 'xpub' }),
      },
      serviceAccountProfile: { _getWalletTypeHeader: async () => ({}) },
      serviceHistory: {
        getOneKeyIdAuthHeaders: async () => ({}),
        getClient: async () => ({
          post: async () => ({
            data: {
              data: { data: indexed, tokens: {}, nfts: {}, hasMore: false },
            },
          }),
        }),
      },
    });
    jest
      .spyOn(VaultBtc.prototype, 'buildOnChainHistoryTx')
      .mockImplementation(async ({ onChainHistoryTx: tx }) =>
        row(tx.tx, getOnChainHistoryTxStatus(tx.status), { block: tx.block }),
      );

    // Confirmations claim a far tip, but no indexed block is past the margin.
    indexed.push(mined('01', expiryHeight + 10, 50_000));
    expect((await read()).map((tx) => tx.decodedTx.status)).toEqual([
      EDecodedTxStatus.Pending,
    ]);
    expect(
      await journalDb.listTransparentPendingTxs({ accountId }),
    ).toHaveLength(1);

    indexed.unshift(mined('02', expiryHeight + 11, 1));
    expect((await read()).map((tx) => tx.decodedTx.status)).toEqual([
      EDecodedTxStatus.Dropped,
    ]);
    expect(await journalDb.listTransparentPendingTxs({ accountId })).toEqual(
      [],
    );
  });

  it('keeps a dropped send dropped on later polls past the 50-row cache', async () => {
    const { localHistory, backend, read } = await fixture();
    backend.tipHeight = expiryHeight + 11;
    await read();
    for (const txs of [
      [row(txid, EDecodedTxStatus.Pending), ...fillers],
      fillers,
      fillers,
    ]) {
      backend.txs = txs;
      // eslint-disable-next-line no-await-in-loop
      const rows = await read();
      expect(rows.map((tx) => tx.decodedTx.status)).toEqual([
        EDecodedTxStatus.Dropped,
      ]);
    }
    expect(
      await localHistory.getAccountLocalHistoryPendingTxs(historyParams),
    ).toEqual([]);
  });

  it('persists the dropped row before releasing the journal', async () => {
    const { journalDb, localHistory, backend, read } = await fixture();
    backend.tipHeight = expiryHeight + 11;
    jest
      .spyOn(localHistory, 'batchUpdateLocalHistoryTxs')
      .mockRejectedValueOnce(new Error('storage unavailable'));
    await read();
    expect(
      await journalDb.listTransparentPendingTxs({ accountId }),
    ).toHaveLength(1);
    await read();
    expect(await journalDb.listTransparentPendingTxs({ accountId })).toEqual(
      [],
    );
  });

  it('lists a pending send once when the backend reports its txid in another case', async () => {
    const { vault, backend } = await fixture();
    Object.assign(backend, {
      txs: [row(txid.toUpperCase(), EDecodedTxStatus.Pending)],
      tipHeight: expiryHeight,
    });
    const rows = await vault.fetchAccountHistoryFromLocal({
      accountId,
      ...historyParams,
    });
    expect(
      rows?.filter((tx) => tx.decodedTx.txid.toLowerCase() === txid),
    ).toHaveLength(1);
  });

  describe('own addresses in the history cache', () => {
    const legacyChange = `t1${'H'.repeat(33)}`;
    const spendsLegacyChange = {
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: {
            from: legacyChange,
            to: 't1-other',
            sends: [{ from: legacyChange, to: '', isOwn: true }],
            receives: [{ from: '', to: 't1-other', isOwn: false }],
          },
        },
      ],
    } as unknown as Partial<IAccountHistoryTx['decodedTx']>;
    const expectGated = (rows: IAccountHistoryTx[]) => {
      expect(rows.length).toBeGreaterThan(0);
      expect(JSON.stringify(rows)).not.toContain(legacyChange);
      for (const tx of rows) {
        expect(tx.decodedTx.actions[0].assetTransfer?.sends[0]).toMatchObject({
          from: '',
          isOwn: true,
          shieldedFrom: { isOwn: true },
        });
      }
    };

    it('stores backend rows with undisplayed own addresses hidden', async () => {
      const { vault, backend, localHistory, read } = await fixture();
      Object.assign(vault.backgroundApi, {
        servicePrivacyChain: {
          getLocalWalletAccountAddresses: async () => ({
            publicAddress: 't1-own',
          }),
        },
      });
      backend.txs = [
        row('cc'.repeat(32), EDecodedTxStatus.Confirmed, spendsLegacyChange),
      ];
      await read();
      expectGated(
        (
          await localHistory.getAccountLocalHistoryConfirmedTxs(historyParams)
        ).filter((tx) => tx.decodedTx.txid === 'cc'.repeat(32)),
      );
    });

    it('stores a dropped row with undisplayed own addresses hidden', async () => {
      const { vault, localHistory } = await fixture();
      await vault.zcashDropExpiredTransparentSends({
        accountId,
        historyParams,
        cachedHistory: [
          {
            ...localSend(),
            decodedTx: { ...localSend().decodedTx, ...spendsLegacyChange },
          },
        ],
        backendTipHeight: expiryHeight + 11,
        backendStatuses: new Map(),
        backendMinedTxids: new Set(),
        addressGate: { addresses: { publicAddress: 't1-own' } },
      });
      const dropped = (
        await localHistory.getAccountLocalHistoryConfirmedTxs(historyParams)
      ).filter((tx) => tx.decodedTx.status === EDecodedTxStatus.Dropped);
      expectGated(dropped);
    });
  });

  it('keeps the accepted send but releases an unsigned reservation when pending transactions are cleared', async () => {
    const { journalDb, inUse } = await fixture();
    await journalDb.reserveTransparentOutpoints({
      accountId,
      ownerId: 'unsigned',
      outpoints: [{ txid: 'cc'.repeat(32), vout: 1 }],
      currentHeight: 1,
      expiryHeight: 1000,
    });
    expect((await inUse()).size).toBe(2);
    await journalDb.clearTransparentPendingSends({ accountId });
    expect(
      await journalDb.listTransparentPendingTxs({ accountId }),
    ).toHaveLength(1);
    expect(await inUse()).toEqual(
      new Set([`${spentOutpoint.txid}:${spentOutpoint.vout}`]),
    );
    // Once the accepted send can no longer be mined, it is released too.
    await journalDb.clearTransparentPendingSends({
      accountId,
      expiredBeforeHeight: expiryHeight + 1,
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
          zcash: { getAccountMeta: async () => null },
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
