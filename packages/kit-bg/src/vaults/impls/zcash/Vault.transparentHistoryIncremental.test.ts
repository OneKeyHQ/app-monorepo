/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

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
import { SimpleDbEntityZcash } from '../../../dbs/simple/entity/SimpleDbEntityZcash';
import VaultBtc from '../btc/Vault';

import Vault from './Vault';
import { zcashTransparentHistorySnapshots } from './vaultHistory';

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
const historyParams = {
  networkId: 'zec--0',
  accountAddress: 't1-own',
  xpub: 'xpub',
};
const tip = 5000;

function txidOf(n: number) {
  return n.toString(16).padStart(64, '0');
}

function onChainRow(
  n: number,
  { timestamp = n, mined = true }: { timestamp?: number; mined?: boolean } = {},
): IOnChainHistoryTx {
  return {
    tx: txidOf(n),
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
    status: mined
      ? EOnChainHistoryTxStatus.Success
      : EOnChainHistoryTxStatus.Pending,
    timestamp,
    block: mined ? Math.min(timestamp, tip) : undefined,
    confirmations: mined ? tip - Math.min(timestamp, tip) + 1 : undefined,
    nonce: 0,
    functionCode: '',
    params: [],
  };
}

function minedRows(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => onChainRow(to - i));
}

// Indexer contract: newest first, `maxTimestampMs` pages backwards.
function createBackend(initial: IOnChainHistoryTx[]) {
  const backend = { rows: initial };
  const post = jest.fn(
    async (_url: string, body: { limit: number; maxTimestampMs?: number }) => {
      // Tests keep `rows` newest first.
      const sorted = backend.rows.filter(
        (row) =>
          body.maxTimestampMs === undefined ||
          (row.timestamp ?? 0) < body.maxTimestampMs,
      );
      const data = sorted.slice(0, body.limit);
      return {
        data: {
          data: {
            data,
            tokens: {},
            nfts: {},
            hasMore: sorted.length > body.limit,
            next: data.length ? String(data[data.length - 1].timestamp) : '',
          },
        },
      };
    },
  );
  return { backend, post };
}

function createVault(post: jest.Mock) {
  jest
    .spyOn(VaultBtc.prototype, 'buildOnChainHistoryTx')
    .mockImplementation(async ({ onChainHistoryTx: tx }) => ({
      id: `${historyParams.networkId}_t1-own_${tx.tx}`,
      decodedTx: {
        txid: tx.tx,
        owner: 't1-own',
        signer: tx.from,
        nonce: 0,
        actions: [],
        extraInfo: null,
        accountId,
        networkId: historyParams.networkId,
        status: getOnChainHistoryTxStatus(tx.status),
        createdAt: tx.timestamp,
        block: tx.block,
      },
    }));
  const zcash = inMemory(new SimpleDbEntityZcash());
  const localHistory = inMemory(new SimpleDbEntityLocalHistory());
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    accountId,
    networkId: historyParams.networkId,
    backgroundApi: {
      simpleDb: { zcash, localHistory },
      serviceToken: { getToken: async () => undefined },
      serviceAccount: {
        getDBAccountSafe: async () => ({ address: 't1-own', xpub: 'xpub' }),
      },
      serviceAccountProfile: { _getWalletTypeHeader: async () => ({}) },
      serviceHistory: {
        getOneKeyIdAuthHeaders: async () => ({}),
        getClient: async () => ({ post }),
      },
    },
    getAccount: async () => ({ address: 't1-own' }),
  });
  const fetchTransparent = (isManualRefresh?: boolean) =>
    vault.zcashFetchTransparentHistory({
      accountId,
      ...historyParams,
      isManualRefresh,
    });
  const readHistory = (isManualRefresh?: boolean) =>
    vault.fetchAccountHistoryFromLocal({
      accountId,
      ...historyParams,
      isManualRefresh,
    });
  return { vault, zcash, localHistory, fetchTransparent, readHistory };
}

function statuses(txs: IAccountHistoryTx[]) {
  return new Map(txs.map((tx) => [tx.decodedTx.txid, tx.decodedTx.status]));
}

function expectedStatuses(rows: IOnChainHistoryTx[]) {
  return new Map(
    rows.map((row) => [row.tx, getOnChainHistoryTxStatus(row.status)]),
  );
}

describe('Zcash transparent history polling', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    zcashTransparentHistorySnapshots.clear();
  });

  it('pages the whole history on first read, then asks for one page per poll', async () => {
    const { backend, post } = createBackend(minedRows(1, 1200));
    const { fetchTransparent } = createVault(post);

    const full = await fetchTransparent();
    expect(post).toHaveBeenCalledTimes(3);
    expect(full.snapshotComplete).toBe(true);
    expect(full.tipHeight).toBe(tip);

    post.mockClear();
    const poll = await fetchTransparent();
    expect(post).toHaveBeenCalledTimes(1);
    expect(poll.snapshotComplete).toBe(false);
    expect(statuses(poll.txs)).toEqual(expectedStatuses(backend.rows));
  });

  it('matches a full fetch after new, confirming and older rows across polls', async () => {
    const pending = onChainRow(1300, { mined: false });
    const { backend, post } = createBackend([pending, ...minedRows(1, 1200)]);
    const { fetchTransparent } = createVault(post);
    await fetchTransparent();

    const changes = [
      // New tx lands on page 1.
      () => {
        backend.rows = [onChainRow(1400), ...backend.rows];
      },
      // The pending tx confirms.
      () => {
        backend.rows = backend.rows.map((row) =>
          row.tx === pending.tx ? onChainRow(1300) : row,
        );
      },
      () => undefined,
    ];
    for (const change of changes) {
      change();
      post.mockClear();
      // eslint-disable-next-line no-await-in-loop
      const poll = await fetchTransparent();
      expect(post).toHaveBeenCalledTimes(1);
      expect(poll.snapshotComplete).toBe(false);
      expect(poll.txs).toHaveLength(backend.rows.length);
      expect(statuses(poll.txs)).toEqual(expectedStatuses(backend.rows));
    }
    // A row far beyond page 1 is still the backend's mined row.
    const last = await fetchTransparent();
    expect(statuses(last.txs).get(txidOf(3))).toBe(EDecodedTxStatus.Confirmed);

    post.mockClear();
    const full = await fetchTransparent(true);
    expect(post).toHaveBeenCalledTimes(3);
    expect(full.snapshotComplete).toBe(true);
    expect(statuses(full.txs)).toEqual(statuses(last.txs));
  });

  it('fetches everything on manual refresh and once the snapshot is ten minutes old', async () => {
    const { post } = createBackend(minedRows(1, 1200));
    const { fetchTransparent } = createVault(post);
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    await fetchTransparent();

    post.mockClear();
    await expect(fetchTransparent(true)).resolves.toMatchObject({
      snapshotComplete: true,
    });
    expect(post).toHaveBeenCalledTimes(3);

    now.mockReturnValue(1_000_000 + 10 * 60 * 1000 - 1);
    post.mockClear();
    await fetchTransparent();
    expect(post).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + 10 * 60 * 1000);
    post.mockClear();
    await expect(fetchTransparent()).resolves.toMatchObject({
      snapshotComplete: true,
    });
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('falls back to a full fetch when page 1 no longer reaches the snapshot', async () => {
    const { backend, post } = createBackend(minedRows(1, 1200));
    const { fetchTransparent } = createVault(post);
    await fetchTransparent();

    backend.rows = [...minedRows(1201, 1800), ...backend.rows];
    post.mockClear();
    const result = await fetchTransparent();
    expect(post).toHaveBeenCalledTimes(1 + 4);
    expect(result.snapshotComplete).toBe(true);
    expect(statuses(result.txs)).toEqual(expectedStatuses(backend.rows));
  });

  it('keeps a small history a single complete page on every poll', async () => {
    const { backend, post } = createBackend(minedRows(1, 10));
    const { fetchTransparent } = createVault(post);
    for (let i = 0; i < 3; i += 1) {
      post.mockClear();
      // eslint-disable-next-line no-await-in-loop
      const result = await fetchTransparent();
      expect(post).toHaveBeenCalledTimes(1);
      expect(result.snapshotComplete).toBe(true);
      expect(statuses(result.txs)).toEqual(expectedStatuses(backend.rows));
    }
  });

  it('removes rows and drops expired sends only on full passes', async () => {
    const { backend, post } = createBackend(minedRows(1, 1200));
    const { zcash, localHistory, readHistory } = createVault(post);
    await readHistory();

    const sendTxid = 'aa'.repeat(32);
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
      expiry: 100,
    };
    await localHistory.saveLocalHistoryTxs({
      ...historyParams,
      pendingTxs: [
        {
          id: `zec--0_t1-own_${sendTxid}`,
          isLocalCreated: true,
          privacyChainHistorySide: 'public',
          privacyChainHistoryPoolIds: [0],
          decodedTx: {
            txid: sendTxid,
            owner: 't1-own',
            signer: 't1-own',
            nonce: 0,
            actions: [],
            extraInfo: null,
            accountId,
            networkId: historyParams.networkId,
            status: EDecodedTxStatus.Pending,
            createdAt: 2000,
            encodedTx,
          },
        },
      ],
    });
    await zcash.saveTransparentPendingTx({
      accountId,
      tx: {
        txid: sendTxid,
        rawTx: 'synthetic-signed',
        ownerId: 'reservation',
        spentOutpoints: [{ txid: 'bb'.repeat(32), vout: 0 }],
        expiryHeight: 100,
        createdAt: 1,
        broadcastState: 'accepted',
        broadcastAuthorized: true,
      },
    });
    // The backend stops listing an old row; the send is past expiry by the backend tip.
    const removed = txidOf(5);
    backend.rows = backend.rows.filter((row) => row.tx !== removed);

    post.mockClear();
    const incremental = statuses((await readHistory()) ?? []);
    expect(post).toHaveBeenCalledTimes(1);
    expect(incremental.get(removed)).toBe(EDecodedTxStatus.Confirmed);
    expect(incremental.get(sendTxid)).toBe(EDecodedTxStatus.Pending);
    expect(await zcash.listTransparentPendingTxs({ accountId })).toHaveLength(
      1,
    );

    post.mockClear();
    const full = statuses((await readHistory(true)) ?? []);
    expect(post).toHaveBeenCalledTimes(3);
    expect(full.has(removed)).toBe(false);
    expect(full.get(sendTxid)).toBe(EDecodedTxStatus.Dropped);
    expect(await zcash.listTransparentPendingTxs({ accountId })).toEqual([]);
  });
});
