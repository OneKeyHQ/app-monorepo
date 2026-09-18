/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { SimpleDbEntityZcash } from '../../../dbs/simple/entity/SimpleDbEntityZcash';
import VaultBtc from '../btc/Vault';

import Vault, {
  ZCASH_DEFINITE_BROADCAST_REJECTIONS,
  isDefiniteZcashBroadcastRejection,
} from './Vault';

import type { IEncodedTxZcash } from './types';
import type { IZcashTransparentPendingTx } from '../../../dbs/simple/entity/SimpleDbEntityZcash';

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
  const zcash = new SimpleDbEntityZcash();
  (zcash as { appStorage: unknown }).appStorage = {
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
  await zcash.saveTransparentPendingTx({ accountId, tx });
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    accountId,
    networkId: params.networkId,
    backgroundApi: {
      simpleDb: { zcash },
      serviceAccount: {
        getDBAccount: async () => ({
          id: accountId,
          address: params.accountAddress,
        }),
      },
    },
  });
  const replay = (pending: IZcashTransparentPendingTx) =>
    (
      vault as unknown as {
        zcashReplayUnknownTransparentBroadcast: (args: {
          accountId: string;
          tx: IZcashTransparentPendingTx;
        }) => Promise<void>;
      }
    ).zcashReplayUnknownTransparentBroadcast({ accountId, tx: pending });
  return { vault, zcash, tx, replay };
}

describe('Zcash transparent broadcast authorization', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([false, undefined])(
    'does not recover a signed or legacy record without authorization (%s)',
    async (authorized) => {
      const { replay, tx, zcash } = await createVault(authorized);
      const transport = jest.spyOn(VaultBtc.prototype, 'broadcastTransaction');

      await replay(tx);

      expect(transport).not.toHaveBeenCalled();
      await expect(
        zcash.listTransparentPendingTxs({ accountId }),
      ).resolves.toEqual([tx]);
    },
  );

  it('persists authorization before transport and retains it with acceptance', async () => {
    const { vault, zcash } = await createVault(false);
    jest
      .spyOn(VaultBtc.prototype, 'broadcastTransaction')
      .mockImplementation(async () => {
        const [pending] = await zcash.listTransparentPendingTxs({ accountId });
        expect(pending.broadcastAuthorized).toBe(true);
        expect(pending.rawTx).toBe(rawTx);
        return signedTx;
      });

    await expect(vault.broadcastTransaction(params)).resolves.toEqual(signedTx);
    const [pending] = await zcash.listTransparentPendingTxs({ accountId });
    expect(pending).toMatchObject({
      broadcastAuthorized: true,
      broadcastState: 'accepted',
      createdAt: 1,
    });
  });

  it('recovers the identical authorized transaction after a transport timeout', async () => {
    const { vault, zcash, replay } = await createVault(false);
    const transport = jest
      .spyOn(VaultBtc.prototype, 'broadcastTransaction')
      .mockRejectedValueOnce(new Error('transport timeout'))
      .mockResolvedValue(signedTx);

    await expect(vault.broadcastTransaction(params)).rejects.toMatchObject({
      code: 'BROADCAST_OUTCOME_UNKNOWN',
    });
    const [pending] = await zcash.listTransparentPendingTxs({ accountId });
    expect(pending).toMatchObject({
      broadcastAuthorized: true,
      broadcastState: 'unknown',
    });
    await replay(pending);

    expect(transport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        signedTx: { txid, rawTx, encodedTx: null },
      }),
    );
    expect(
      (await zcash.listTransparentPendingTxs({ accountId }))[0].broadcastState,
    ).toBe('accepted');
  });

  it('does not submit bytes that differ from the durable signed record', async () => {
    const { vault, zcash, tx } = await createVault(false);
    await zcash.saveTransparentPendingTx({
      accountId,
      tx: { ...tx, rawTx: 'different-signed-bytes' },
    });
    const transport = jest.spyOn(VaultBtc.prototype, 'broadcastTransaction');

    await expect(vault.broadcastTransaction(params)).rejects.toThrow(
      'journal mismatch',
    );
    expect(transport).not.toHaveBeenCalled();
    expect(
      (await zcash.listTransparentPendingTxs({ accountId }))[0]
        .broadcastAuthorized,
    ).toBe(false);
  });
});

describe('Zcash definite broadcast rejection whitelist', () => {
  // The backend has not published its error-code table yet. While this list is
  // empty every failure stays `BROADCAST_OUTCOME_UNKNOWN`, which is what
  // "recovers the identical authorized transaction after a transport timeout"
  // above pins.
  //
  // WHEN YOU POPULATE THE LIST: delete this assertion and add a vault-level
  // test that a matching failure settles the pending transaction and throws
  // BROADCAST_REJECTED. Releasing outpoints is the part that can double-spend.
  it('ships empty until the backend publishes its codes', () => {
    expect(ZCASH_DEFINITE_BROADCAST_REJECTIONS).toHaveLength(0);
  });

  it('treats an unconstrained entry as matching nothing', () => {
    expect(
      isDefiniteZcashBroadcastRejection(
        { serverCode: 1, httpStatusCode: 400 },
        [{}],
      ),
    ).toBe(false);
  });

  it('requires every constrained field to match', () => {
    const rules = [{ serverCode: 1234, httpStatusCode: 400 }];
    expect(
      isDefiniteZcashBroadcastRejection(
        { serverCode: 1234, httpStatusCode: 400 },
        rules,
      ),
    ).toBe(true);
    expect(
      isDefiniteZcashBroadcastRejection(
        { serverCode: 1234, httpStatusCode: 409 },
        rules,
      ),
    ).toBe(false);
    expect(isDefiniteZcashBroadcastRejection({ serverCode: 1234 }, rules)).toBe(
      false,
    );
  });

  it('lets a rule constrain one field alone', () => {
    const rules = [{ serverCode: 1234 }];
    expect(
      isDefiniteZcashBroadcastRejection(
        { serverCode: 1234, httpStatusCode: 500 },
        rules,
      ),
    ).toBe(true);
    expect(
      isDefiniteZcashBroadcastRejection({ httpStatusCode: 400 }, rules),
    ).toBe(false);
  });

  it('never matches a failure that carried no codes at all', () => {
    expect(isDefiniteZcashBroadcastRejection({}, [{ serverCode: 1234 }])).toBe(
      false,
    );
  });
});
