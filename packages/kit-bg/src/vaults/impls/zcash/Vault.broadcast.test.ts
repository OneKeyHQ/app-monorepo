/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityPrivacyChainJournal } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainJournal';
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
  let saved: unknown = null;
  const journalDb = new SimpleDbEntityPrivacyChainJournal();
  (journalDb as { appStorage: unknown }).appStorage = {
    getItem: async () => saved,
    setItem: async (_key: string, value: unknown) => {
      saved = value;
    },
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
  });

  it('persists authorization before transport and retains it with acceptance', async () => {
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

    await expect(vault.broadcastTransaction(params)).resolves.toEqual({
      ...signedTx,
      broadcastOutcomeUnknown: false,
    });
    const [pending] = await journalDb.listTransparentPendingTxs({ accountId });
    expect(pending).toMatchObject({
      broadcastAuthorized: true,
      broadcastState: 'accepted',
      createdAt: 1,
    });
  });

  it.each(['transport timeout', 'node rejected'])(
    'propagates %s through the BTC error flow while retaining input holds',
    async (message) => {
      const { vault, journalDb } = await createVault(false);
      const error = Object.assign(new OneKeyLocalError(message), {
        code: 40_001,
        httpStatusCode: 400,
      });
      const transport = jest
        .spyOn(VaultBtc.prototype, 'broadcastTransaction')
        .mockRejectedValueOnce(error)
        .mockResolvedValue(signedTx);

      await expect(vault.broadcastTransaction(params)).rejects.toBe(error);
      const [pending] = await journalDb.listTransparentPendingTxs({
        accountId,
      });
      expect(pending).toMatchObject({
        broadcastAuthorized: true,
        broadcastState: 'unknown',
      });
      expect(transport).toHaveBeenCalledTimes(1);
      expect(
        await journalDb.listTransparentOutpointsInUse({ accountId }),
      ).toEqual(new Set([`${'22'.repeat(32)}:0`]));
    },
  );

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
      broadcastOutcomeUnknown: false,
    });
    expect(
      await journalDb.listTransparentPendingTxs({ accountId }),
    ).toHaveLength(1);
  });

  // ServiceSend routes broadcasts to the custom-RPC branch unless told
  // otherwise, and a Zcash sync node is a custom RPC; that branch must not
  // recurse into broadcastTransaction.
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
