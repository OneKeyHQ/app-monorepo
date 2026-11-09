/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance');

import {
  OneKeyError,
  OneKeyLocalError,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { createUntrackedMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';

import { SimpleDbEntityPrivacyChainJournal } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainJournal';
import { setLocalWalletRemoteConfigs } from '../../localWallet/remoteConfig';
import VaultBtc from '../btc/Vault';

import Vault from './Vault';

import type { IEncodedTxZcash } from './types';
import type { IZcashTransparentPendingTx } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainJournal';

const accountId = "hd-1--m/44'/133'/0'";
const txid = '11'.repeat(32);
const rawTx = 'synthetic-signed-transaction';
const signedTx = {
  txid,
  rawTx,
  encodedTx: {
    zcashMode: 'transparent',
    zcashTransparentBuild: {
      txid,
      rawTx,
      feeZat: '10000',
      expiryHeight: 100,
      spentOutpoints: [{ txid: '22'.repeat(32), vout: 0 }],
    },
  } as IEncodedTxZcash,
};
const params = {
  accountId,
  networkId: 'zec--0',
  accountAddress: 't1-synthetic',
  signedTx,
};

async function createVault(broadcastAuthorized?: boolean) {
  const storage = createUntrackedMemoryStorage(null);
  const journalDb = new SimpleDbEntityPrivacyChainJournal();
  (journalDb as { appStorage: unknown }).appStorage = {
    getItem: storage.getItem,
    setItem: storage.setItem,
  };
  const tx: IZcashTransparentPendingTx = {
    txid,
    rawTx,
    ownerId: 'synthetic-owner',
    expiryHeight: 100,
    createdAt: 1,
    spentOutpoints: [{ txid: '22'.repeat(32), vout: 0 }],
    broadcastState: 'unknown',
    ...(broadcastAuthorized === undefined ? {} : { broadcastAuthorized }),
  };
  await journalDb.reserveTransparentOutpoints({
    accountId,
    ownerId: tx.ownerId,
    outpoints: tx.spentOutpoints,
    currentHeight: 1,
    expiryHeight: tx.expiryHeight,
  });
  await journalDb.saveTransparentPendingTx({ accountId, tx });
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    accountId,
    networkId: params.networkId,
    backgroundApi: {
      simpleDb: { privacyChainJournal: journalDb },
      serviceAccount: {
        getDBAccount: async () => ({
          id: accountId,
          address: params.accountAddress,
        }),
      },
    },
  });
  return { vault, journalDb, tx };
}

describe('Zcash transparent broadcast authorization', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    setLocalWalletRemoteConfigs({});
  });

  it.each([false, true])(
    'persists transparent authorization and acceptance (privacy disabled: %s)',
    async (privacyDisabled) => {
      setLocalWalletRemoteConfigs({ 'zec--0': { privacyDisabled } });
      const { vault, journalDb } = await createVault(false);
      jest
        .spyOn(VaultBtc.prototype, 'broadcastTransaction')
        .mockImplementation(async () => {
          const [pending] = await journalDb.listTransparentPendingTxs({
            accountId,
          });
          expect(pending.broadcastAuthorized).toBe(true);
          expect(pending.rawTx).toBe(rawTx);
          return signedTx;
        });

      await expect(vault.broadcastTransaction(params)).resolves.toEqual(
        signedTx,
      );
      const [pending] = await journalDb.listTransparentPendingTxs({
        accountId,
      });
      expect(pending).toMatchObject({
        broadcastAuthorized: true,
        broadcastState: 'accepted',
        createdAt: 1,
      });
      expect(
        await journalDb.listTransparentOutpointsInUse({ accountId }),
      ).toEqual(new Set([`${'22'.repeat(32)}:0`]));
    },
  );

  it.each([
    { answer: 'a business error code', httpStatusCode: 200 },
    { answer: 'HTTP 400', httpStatusCode: 400 },
  ])(
    'releases the journal entry and input holds when the backend rejects with $answer',
    async ({ httpStatusCode }) => {
      const { vault, journalDb } = await createVault(false);
      const error = Object.assign(new OneKeyLocalError('node rejected'), {
        code: 40_001,
        httpStatusCode,
      });
      const transport = jest
        .spyOn(VaultBtc.prototype, 'broadcastTransaction')
        .mockRejectedValueOnce(error)
        .mockResolvedValue(signedTx);

      await expect(vault.broadcastTransaction(params)).rejects.toBe(error);
      expect(transport).toHaveBeenCalledTimes(1);
      expect(await journalDb.listTransparentPendingTxs({ accountId })).toEqual(
        [],
      );
      expect(
        await journalDb.listTransparentOutpointsInUse({ accountId }),
      ).toEqual(new Set());
    },
  );

  it.each([
    {
      answer: 'a request timeout',
      error: Object.assign(new Error('timeout of 10000ms exceeded'), {
        code: 'ECONNABORTED',
      }),
    },
    {
      answer: 'a network error',
      error: new OneKeyError({
        message: 'Network Error',
        className: EOneKeyErrorClassNames.AxiosNetworkError,
      }),
    },
    {
      answer: 'a server error',
      error: new OneKeyServerApiError({
        message: 'Bad Gateway',
        code: 502,
        httpStatusCode: 502,
      }),
    },
  ])(
    // A retry spends the same coins, so a landed first attempt makes the node refuse it.
    'releases the inputs after $answer but says the outcome is unknown',
    async ({ error }) => {
      const { vault, journalDb } = await createVault(false);
      const transport = jest
        .spyOn(VaultBtc.prototype, 'broadcastTransaction')
        .mockRejectedValueOnce(error);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(vault.broadcastTransaction(params)).rejects.toMatchObject({
        code: 'BROADCAST_OUTCOME_UNKNOWN',
      });
      expect(transport).toHaveBeenCalledTimes(1);
      expect(await journalDb.listTransparentPendingTxs({ accountId })).toEqual(
        [],
      );
      expect(
        await journalDb.listTransparentOutpointsInUse({ accountId }),
      ).toEqual(new Set());
    },
  );

  it('rethrows the broadcast error when releasing the journal entry fails', async () => {
    const { vault, journalDb } = await createVault(false);
    const error = new OneKeyLocalError('node rejected');
    jest
      .spyOn(VaultBtc.prototype, 'broadcastTransaction')
      .mockRejectedValueOnce(error);
    const release = jest
      .spyOn(journalDb, 'settleTransparentPendingTx')
      .mockRejectedValueOnce(new OneKeyLocalError('storage unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(vault.broadcastTransaction(params)).rejects.toBe(error);
    expect(release).toHaveBeenCalledWith({ accountId, txid });
  });

  it('does not broadcast when authorization cannot be saved', async () => {
    const { vault, journalDb } = await createVault(false);
    const error = new OneKeyLocalError('storage unavailable');
    jest
      .spyOn(journalDb, 'authorizeTransparentPendingTx')
      .mockRejectedValueOnce(error);
    const transport = jest.spyOn(VaultBtc.prototype, 'broadcastTransaction');
    await expect(vault.broadcastTransaction(params)).rejects.toBe(error);
    expect(transport).not.toHaveBeenCalled();
  });

  it('keeps accepted broadcasts successful when the recoverable acceptance marker write fails', async () => {
    const { vault, journalDb } = await createVault(false);
    jest
      .spyOn(journalDb, 'markTransparentPendingTxAccepted')
      .mockRejectedValueOnce(new OneKeyLocalError('storage unavailable'));
    jest
      .spyOn(VaultBtc.prototype, 'broadcastTransaction')
      .mockResolvedValue(signedTx);
    await expect(vault.broadcastTransaction(params)).resolves.toMatchObject({
      txid,
    });
    expect(
      await journalDb.listTransparentPendingTxs({ accountId }),
    ).toHaveLength(1);
  });

  // A Zcash sync node is a custom RPC; ServiceSend's custom-RPC branch must not recurse into broadcastTransaction.
  it('sends transparent broadcasts to the default backend', async () => {
    const { vault } = await createVault(false);
    const transport = jest
      .spyOn(VaultBtc.prototype, 'broadcastTransaction')
      .mockResolvedValue(signedTx);

    await vault.broadcastTransaction(params);

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toMatchObject({ useDefaultRpc: true });
  });

  it('does not submit bytes that differ from the durable signed record', async () => {
    const { vault, journalDb, tx } = await createVault(false);
    await journalDb.saveTransparentPendingTx({
      accountId,
      tx: { ...tx, rawTx: 'different-signed-bytes' },
    });
    const transport = jest.spyOn(VaultBtc.prototype, 'broadcastTransaction');

    await expect(vault.broadcastTransaction(params)).rejects.toThrow(
      'journal mismatch',
    );
    expect(transport).not.toHaveBeenCalled();
    expect(
      (await journalDb.listTransparentPendingTxs({ accountId }))[0]
        .broadcastAuthorized,
    ).toBe(false);
  });
});
