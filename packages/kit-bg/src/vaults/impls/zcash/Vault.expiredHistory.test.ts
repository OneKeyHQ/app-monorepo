/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
jest.mock(
  '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect',
  () => ({
    fetchZcashChainTipDirect: jest.fn(async () => 101),
    fetchZcashTransactionMissingDirect: jest.fn(async () => true),
  }),
);
import { fetchZcashTransactionMissingDirect } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityLocalHistory } from '../../../dbs/simple/entity/SimpleDbEntityLocalHistory';
import { SimpleDbEntityZcash } from '../../../dbs/simple/entity/SimpleDbEntityZcash';

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

describe('expired transparent send reconciliation', () => {
  const accountId = 'account';
  const txid = 'aa'.repeat(32);
  const historyParams = { networkId: 'zec--0', accountAddress: 't1-own' };
  async function fixture(withJournal = true, onlySignedExpiry = false) {
    const zcash = inMemory(new SimpleDbEntityZcash());
    const localHistory = inMemory(new SimpleDbEntityLocalHistory());
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
      zcashTransparentBuild: {
        txid,
        rawTx: 'synthetic-signed',
        feeZat: '10000',
        expiryHeight: 100,
        spentOutpoints: [],
      },
    };
    if (onlySignedExpiry) {
      encodedTx.expiry = 100;
      delete encodedTx.zcashTransparentBuild;
    }
    const row: IAccountHistoryTx = {
      id: 'expired-send',
      privacyChainHistorySide: 'public',
      privacyChainHistoryPoolIds: [0],
      decodedTx: {
        txid,
        owner: 't1-own',
        signer: 't1-own',
        nonce: 0,
        actions: [],
        extraInfo: null,
        accountId,
        networkId: historyParams.networkId,
        status: EDecodedTxStatus.Pending,
        broadcastOutcomeUnknown: true,
        createdAt: 1,
        encodedTx,
      },
    };
    await localHistory.saveLocalHistoryTxs({
      ...historyParams,
      pendingTxs: [row],
    });
    if (withJournal)
      await zcash.saveTransparentPendingTx({
        accountId,
        tx: {
          txid,
          rawTx: 'synthetic-signed',
          ownerId: 'reservation',
          spentOutpoints: [],
          expiryHeight: 100,
          createdAt: 1,
          broadcastState: 'unknown',
          broadcastAuthorized: true,
        },
      });
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: historyParams.networkId,
      accountId,
      backgroundApi: {
        simpleDb: { zcash, localHistory },
        serviceAccount: { getDBAccount: async () => ({ address: 't1-own' }) },
      },
      zcashResolveLightwalletdUrl: async () => 'https://example.invalid',
    });
    const reconcile = () =>
      (
        vault as unknown as {
          zcashPruneTransparentSendHistory: (
            id: string,
            rows: IAccountHistoryTx[],
          ) => Promise<void>;
        }
      ).zcashPruneTransparentSendHistory(accountId, [row]);
    return { zcash, localHistory, reconcile };
  }
  beforeEach(() => {
    jest.mocked(fetchZcashTransactionMissingDirect).mockResolvedValue(true);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('moves an expired absent send to terminal history and releases its journal', async () => {
    const { zcash, localHistory, reconcile } = await fixture();
    await reconcile();
    expect(
      await localHistory.getAccountLocalHistoryPendingTxs(historyParams),
    ).toEqual([]);
    expect(
      (await localHistory.getAccountLocalHistoryConfirmedTxs(historyParams))[0]
        .decodedTx,
    ).toMatchObject({
      status: EDecodedTxStatus.Dropped,
      broadcastOutcomeUnknown: false,
      createdAt: 1,
    });
    expect(await zcash.listTransparentPendingTxs({ accountId })).toEqual([]);
  });
  it('repairs legacy pending history whose expired journal was already removed', async () => {
    const { localHistory, reconcile } = await fixture(false);
    await reconcile();
    expect(
      (await localHistory.getAccountLocalHistoryConfirmedTxs(historyParams))[0]
        .decodedTx.status,
    ).toBe(EDecodedTxStatus.Dropped);
  });
  it('uses the signed expiry preserved in history after the journal is lost', async () => {
    const { localHistory, reconcile } = await fixture(false, true);
    await reconcile();
    expect(
      (await localHistory.getAccountLocalHistoryConfirmedTxs(historyParams))[0]
        .decodedTx.status,
    ).toBe(EDecodedTxStatus.Dropped);
  });
  it('retains the journal and pending row when node absence is not proven', async () => {
    const { zcash, localHistory, reconcile } = await fixture();
    jest.mocked(fetchZcashTransactionMissingDirect).mockResolvedValue(false);
    await reconcile();
    expect(await zcash.listTransparentPendingTxs({ accountId })).toHaveLength(
      1,
    );
    expect(
      await localHistory.getAccountLocalHistoryPendingTxs(historyParams),
    ).toHaveLength(1);
  });
  it('retries history persistence before releasing a signed journal', async () => {
    const { zcash, localHistory, reconcile } = await fixture();
    jest
      .spyOn(localHistory, 'batchUpdateLocalHistoryTxs')
      .mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(reconcile()).rejects.toThrow('storage unavailable');
    expect(await zcash.listTransparentPendingTxs({ accountId })).toHaveLength(
      1,
    );
    await reconcile();
    expect(await zcash.listTransparentPendingTxs({ accountId })).toEqual([]);
  });
});
