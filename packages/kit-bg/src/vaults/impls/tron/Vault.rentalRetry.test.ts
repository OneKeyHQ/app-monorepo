/*
yarn jest packages/kit-bg/src/vaults/impls/tron/Vault.rentalRetry.test.ts

OK-67168: a transfer that rents energy is rebuilt before it is signed, so it
gets a new txID on every submit. A TRON tx has no nonce: when the first
broadcast lands without the app learning it, a retry that signs the rebuilt
tx pays the recipient a second time, and the rental is ordered again too.
*/
import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { ITronResourceRentalInfo } from '@onekeyhq/shared/types/fee';

import VaultTron from './Vault';

// Importing the vault pulls in the localDb singleton, whose constructor opens
// IndexedDB at module load and crashes under jest's node environment.
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

const accountId = "hd-1--m/44'/195'/0'/0/0";
const networkId = 'tron--0x2b6653dc';

const unsignedTxOf = (txID: string | undefined, uuid = 'u1') =>
  ({
    uuid,
    encodedTx: txID ? ({ txID } as IEncodedTxTron) : null,
  }) as unknown as IUnsignedTxPro;

const signedTxOf = (txid: string) =>
  ({
    txid,
    rawTx: `raw-${txid}`,
    encodedTx: { txID: txid },
  }) as unknown as ISignedTxPro;

describe('VaultTron.isUnsignedTxConflictingWithSignedTx', () => {
  const check = (txID: string | undefined, signedTxid: string) =>
    (
      Object.create(VaultTron.prototype) as VaultTron
    ).isUnsignedTxConflictingWithSignedTx({
      unsignedTx: unsignedTxOf(txID),
      signedTx: signedTxOf(signedTxid),
    });

  it('holds for the tx that was signed: the chain takes one txID once', async () => {
    await expect(check('aa11', 'aa11')).resolves.toBe(true);
    await expect(check('AA11', 'aa11')).resolves.toBe(true);
  });

  it('does not hold for a tx rebuilt since: both would execute', async () => {
    // the same transfer built again, on a later ref block and expiration
    await expect(check('bb22', 'aa11')).resolves.toBe(false);
  });

  it('does not hold when the tx held has no id to compare', async () => {
    await expect(check(undefined, 'aa11')).resolves.toBe(false);
    await expect(check('', '')).resolves.toBe(false);
  });
});

describe('VaultTron.preActionsBeforeSending', () => {
  // the vault logs the signed rental tx outside production builds
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const rentalInfo = (
    overrides: Partial<ITronResourceRentalInfo> = {},
  ): ITronResourceRentalInfo =>
    ({
      isResourceRentalNeeded: true,
      isResourceRentalEnabled: true,
      createOrderParams: { pledgeAddress: 'TSender', pledgeNum: 65_000 },
      ...overrides,
    }) as unknown as ITronResourceRentalInfo;

  function buildVault({ hasEarlierAttempt }: { hasEarlierAttempt: boolean }) {
    const sendProxyRequestWithTrxRes = jest.fn(
      async ({ body }: { body: { url: string } }) =>
        body.url === '/api/v1/order/create'
          ? { orderId: 'order-1', transaction: { txID: 'rental-pay' } }
          : { tx_ids: ['rental-pay'] },
    );
    const hasEarlierBroadcastAttempt = jest.fn(async () => hasEarlierAttempt);
    const signTransaction = jest.fn(async () => ({
      txid: 'rental-pay',
      rawTx: '{"txID":"rental-pay"}',
      encodedTx: null,
    }));
    const vault = Object.create(VaultTron.prototype) as VaultTron;
    Object.assign(vault, {
      accountId,
      networkId,
      getNetwork: async () => ({ isTestnet: false }),
      signTransaction,
      backgroundApi: {
        serviceSend: { hasEarlierBroadcastAttempt },
        serviceAccountProfile: { sendProxyRequestWithTrxRes },
        servicePassword: {
          promptPasswordVerifyByAccount: jest.fn(async () => ({
            password: 'password',
            deviceParams: undefined,
          })),
        },
        serviceHardwareUI: {
          withHardwareProcessing: jest.fn((callback: () => Promise<unknown>) =>
            callback(),
          ),
        },
      },
    });
    const orderedUrls = () =>
      sendProxyRequestWithTrxRes.mock.calls.map(([{ body }]) => body.url);
    return { vault, hasEarlierBroadcastAttempt, signTransaction, orderedUrls };
  }

  it('orders and pays the rental on the first attempt', async () => {
    const { vault, signTransaction, orderedUrls } = buildVault({
      hasEarlierAttempt: false,
    });

    await expect(
      vault.preActionsBeforeSending({
        unsignedTxs: [unsignedTxOf('aa11')],
        tronResourceRentalInfo: rentalInfo(),
      }),
    ).resolves.toEqual({ preSendTx: { txid: 'rental-pay' } });

    expect(orderedUrls()).toEqual([
      '/api/v1/order/create',
      '/api/tronRent/uploadHash',
    ]);
    expect(signTransaction).toHaveBeenCalledTimes(1);
  });

  it('orders no second rental when the retry settles an earlier attempt', async () => {
    const { vault, hasEarlierBroadcastAttempt, signTransaction, orderedUrls } =
      buildVault({ hasEarlierAttempt: true });
    const unsignedTxs = [unsignedTxOf('aa11')];

    await expect(
      vault.preActionsBeforeSending({
        unsignedTxs,
        tronResourceRentalInfo: rentalInfo(),
      }),
    ).resolves.toBeUndefined();

    expect(hasEarlierBroadcastAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, networkId, unsignedTxs }),
    );
    // nothing is ordered, and the rental payment is never put up for signing
    expect(orderedUrls()).toEqual([]);
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it('tells the record lookup what kind of send follows', async () => {
    const { vault, hasEarlierBroadcastAttempt } = buildVault({
      hasEarlierAttempt: false,
    });
    const beforeBroadcastAction = { type: 'primeInfiniPayment' };
    const wcPayPreBroadcastRecord = { paymentId: 'pay-1' };

    await vault.preActionsBeforeSending({
      unsignedTxs: [unsignedTxOf('aa11')],
      tronResourceRentalInfo: rentalInfo(),
      signOnly: true,
      beforeBroadcastAction,
      wcPayPreBroadcastRecord,
    } as unknown as Parameters<VaultTron['preActionsBeforeSending']>[0]);

    expect(hasEarlierBroadcastAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        signOnly: true,
        beforeBroadcastAction,
        wcPayPreBroadcastRecord,
      }),
    );
  });

  it.each([
    ['is not needed', { isResourceRentalNeeded: false }],
    ['is switched off', { isResourceRentalEnabled: false }],
  ])(
    'leaves the records alone when the rental %s',
    async (_name, overrides) => {
      const { vault, hasEarlierBroadcastAttempt, orderedUrls } = buildVault({
        hasEarlierAttempt: true,
      });

      await expect(
        vault.preActionsBeforeSending({
          unsignedTxs: [unsignedTxOf('aa11')],
          tronResourceRentalInfo: rentalInfo(overrides),
        }),
      ).resolves.toBeUndefined();

      expect(hasEarlierBroadcastAttempt).not.toHaveBeenCalled();
      expect(orderedUrls()).toEqual([]);
    },
  );
});
