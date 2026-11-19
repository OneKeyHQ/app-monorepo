/*
yarn jest packages/kit-bg/src/vaults/impls/tron/Vault.rentalRetry.test.ts

OK-67168: a transfer that rents energy is rebuilt before it is signed, so it
gets a new txID on every submit. A TRON tx has no nonce: when the first
broadcast lands without the app learning it, a retry that signs the rebuilt
tx pays the recipient a second time, and the rental is ordered again too.
*/
import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ITronResourceRentalInfo } from '@onekeyhq/shared/types/fee';

import { EEarlierBroadcastAttempt } from '../../types';

import VaultTron from './Vault';

// Importing the vault pulls in the localDb singleton, whose constructor opens
// IndexedDB at module load and crashes under jest's node environment.
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

const accountId = "hd-1--m/44'/195'/0'/0/0";
const networkId = 'tron--0x2b6653dc';

// What the tx does. A rebuild keeps it and only gets a new txID; an edit on
// the confirm page (an approve with another allowance) changes it.
const contractOf = (data: string) => [
  {
    type: 'TriggerSmartContract',
    parameter: {
      value: { owner_address: 'TSender', contract_address: 'TToken', data },
    },
  },
];

const unsignedTxOf = (
  txID: string | undefined,
  { uuid = 'u1', data = 'approve-max' }: { uuid?: string; data?: string } = {},
) =>
  ({
    uuid,
    encodedTx: txID
      ? ({
          txID,
          raw_data: { contract: contractOf(data) },
        } as unknown as IEncodedTxTron)
      : null,
  }) as unknown as IUnsignedTxPro;

// As the TRON signers build it: the payload is the signed tx as JSON.
const signedTxOf = (txid: string, data = 'approve-max') =>
  ({
    txid,
    rawTx: JSON.stringify({
      txID: txid,
      raw_data: { contract: contractOf(data) },
      signature: ['sig'],
    }),
    encodedTx: { txID: txid },
  }) as unknown as ISignedTxPro;

describe('VaultTron.isUnsignedTxConflictingWithSignedTx', () => {
  const check = (unsignedTx: IUnsignedTxPro, signedTx: ISignedTxPro) =>
    (
      Object.create(VaultTron.prototype) as VaultTron
    ).isUnsignedTxConflictingWithSignedTx({ unsignedTx, signedTx });

  it('holds for the tx that was signed: the chain takes one txID once', async () => {
    await expect(check(unsignedTxOf('aa11'), signedTxOf('aa11'))).resolves.toBe(
      true,
    );
    await expect(check(unsignedTxOf('AA11'), signedTxOf('aa11'))).resolves.toBe(
      true,
    );
  });

  it('does not hold for a tx rebuilt since: both would execute', async () => {
    // the same contract built again, on a later ref block and expiration
    await expect(check(unsignedTxOf('bb22'), signedTxOf('aa11'))).resolves.toBe(
      false,
    );
  });

  it('compares what the contract says, not how it is laid out', async () => {
    const reordered = unsignedTxOf('bb22');
    (reordered.encodedTx as IEncodedTxTron).raw_data.contract = [
      {
        parameter: {
          value: {
            data: 'approve-max',
            contract_address: 'TToken',
            owner_address: 'TSender',
          },
        },
        type: 'TriggerSmartContract',
      },
    ] as unknown as IEncodedTxTron['raw_data']['contract'];

    await expect(check(reordered, signedTxOf('aa11'))).resolves.toBe(false);
  });

  it('stops a tx edited since: the stored payload no longer does what is shown', async () => {
    // the allowance was lowered on the confirm page after the first attempt
    await expect(
      check(
        unsignedTxOf('bb22', { data: 'approve-100' }),
        signedTxOf('aa11', 'approve-max'),
      ),
    ).rejects.toThrow('differs from what is shown now');
  });

  it('stops when either tx cannot be read', async () => {
    await expect(
      check(unsignedTxOf(undefined), signedTxOf('aa11')),
    ).rejects.toThrow('differs from what is shown now');
    await expect(
      check(unsignedTxOf('bb22'), {
        txid: 'aa11',
        rawTx: 'not json',
      } as unknown as ISignedTxPro),
    ).rejects.toThrow('differs from what is shown now');
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

  type IAttemptQuery = { unsignedTx: IUnsignedTxPro; askChain: boolean };

  // `attempts`: what the send does with each uuid; a uuid left out has no
  // earlier attempt. `rentedUuids`: orders already placed for a tx.
  function buildVault({
    attempts = {},
    rentedUuids = [],
  }: {
    attempts?: Record<string, EEarlierBroadcastAttempt>;
    rentedUuids?: string[];
  } = {}) {
    const sendProxyRequestWithTrxRes = jest.fn(
      async ({ body }: { body: { url: string } }) =>
        body.url === '/api/v1/order/create'
          ? { orderId: 'order-1', transaction: { txID: 'rental-pay' } }
          : { tx_ids: ['rental-pay'] },
    );
    const getEarlierBroadcastAttempt = jest.fn(
      async ({ unsignedTx }: IAttemptQuery) =>
        attempts[unsignedTx.uuid ?? ''] ?? EEarlierBroadcastAttempt.None,
    );
    const rentalOrders = new Set(rentedUuids);
    const chainResource = {
      hasTronRentalOrder: jest.fn(async ({ uuid }: { uuid: string }) =>
        rentalOrders.has(uuid),
      ),
      addTronRentalOrders: jest.fn(async ({ uuids }: { uuids: string[] }) => {
        uuids.forEach((uuid) => rentalOrders.add(uuid));
      }),
    };
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
        serviceSend: { getEarlierBroadcastAttempt },
        simpleDb: { chainResource },
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
    const askedChainFor = () =>
      getEarlierBroadcastAttempt.mock.calls
        .filter(([{ askChain }]) => askChain)
        .map(([{ unsignedTx }]) => unsignedTx.uuid);
    return {
      vault,
      getEarlierBroadcastAttempt,
      chainResource,
      rentalOrders,
      signTransaction,
      orderedUrls,
      askedChainFor,
    };
  }

  const rentalFlow = ['/api/v1/order/create', '/api/tronRent/uploadHash'];

  it('orders and pays the rental on the first attempt, and notes it for the tx', async () => {
    const { vault, signTransaction, orderedUrls, rentalOrders } = buildVault();

    await expect(
      vault.preActionsBeforeSending({
        unsignedTxs: [unsignedTxOf('aa11')],
        tronResourceRentalInfo: rentalInfo(),
      }),
    ).resolves.toEqual({ preSendTx: { txid: 'rental-pay' } });

    expect(orderedUrls()).toEqual(rentalFlow);
    expect(signTransaction).toHaveBeenCalledTimes(1);
    expect([...rentalOrders]).toEqual(['u1']);
  });

  it('orders no second rental for a tx sent again that an earlier attempt rented for', async () => {
    const { vault, signTransaction, orderedUrls, askedChainFor } = buildVault({
      attempts: { u1: EEarlierBroadcastAttempt.NoVerdict },
      rentedUuids: ['u1'],
    });

    await expect(
      vault.preActionsBeforeSending({
        unsignedTxs: [unsignedTxOf('aa11')],
        tronResourceRentalInfo: rentalInfo(),
      }),
    ).resolves.toBeUndefined();

    // nothing is ordered, and the rental payment is never put up for signing
    expect(orderedUrls()).toEqual([]);
    expect(signTransaction).not.toHaveBeenCalled();
    // the record on the device answers it: the send's lookup is the only one
    expect(askedChainFor()).toEqual([]);
  });

  it('orders the rental for a tx sent again whose earlier attempt went without one', async () => {
    // the rental was switched on between the two attempts
    const { vault, orderedUrls, askedChainFor, rentalOrders } = buildVault({
      attempts: { u1: EEarlierBroadcastAttempt.NoVerdict },
    });

    await expect(
      vault.preActionsBeforeSending({
        unsignedTxs: [unsignedTxOf('aa11')],
        tronResourceRentalInfo: rentalInfo(),
      }),
    ).resolves.toEqual({ preSendTx: { txid: 'rental-pay' } });

    expect(orderedUrls()).toEqual(rentalFlow);
    // paid only once the chain did not show the earlier payload
    expect(askedChainFor()).toEqual(['u1']);
    expect([...rentalOrders]).toEqual(['u1']);
  });

  it.each([
    ['never rented for', [] as string[]],
    ['rented for', ['u1']],
  ])(
    'orders nothing for a tx a node already took, %s',
    async (_name, rentedUuids) => {
      const { vault, orderedUrls } = buildVault({
        attempts: { u1: EEarlierBroadcastAttempt.OnNetwork },
        rentedUuids,
      });

      await expect(
        vault.preActionsBeforeSending({
          unsignedTxs: [unsignedTxOf('aa11')],
          tronResourceRentalInfo: rentalInfo(),
        }),
      ).resolves.toBeUndefined();

      expect(orderedUrls()).toEqual([]);
    },
  );

  it('orders again for a tx signed as new, whatever was rented before', async () => {
    // the first rental was paid, then the signature of the tx was cancelled
    const { vault, orderedUrls } = buildVault({ rentedUuids: ['u1'] });

    await expect(
      vault.preActionsBeforeSending({
        unsignedTxs: [unsignedTxOf('aa11')],
        tronResourceRentalInfo: rentalInfo(),
      }),
    ).resolves.toEqual({ preSendTx: { txid: 'rental-pay' } });

    expect(orderedUrls()).toEqual(rentalFlow);
  });

  it('orders the rental when a batch still has a tx to sign as new', async () => {
    // the first tx went out; the second one never got signed
    const { vault, orderedUrls, rentalOrders } = buildVault({
      attempts: { u1: EEarlierBroadcastAttempt.OnNetwork },
      rentedUuids: ['u1', 'u2'],
    });

    await expect(
      vault.preActionsBeforeSending({
        unsignedTxs: [
          unsignedTxOf('aa11', { uuid: 'u1' }),
          unsignedTxOf('bb22', { uuid: 'u2' }),
        ],
        tronResourceRentalInfo: rentalInfo(),
      }),
    ).resolves.toEqual({ preSendTx: { txid: 'rental-pay' } });

    expect(orderedUrls()).toEqual(rentalFlow);
    expect([...rentalOrders]).toEqual(['u1', 'u2']);
  });

  it('orders nothing when every tx of a batch is settled by an earlier attempt', async () => {
    const { vault, orderedUrls } = buildVault({
      attempts: {
        u1: EEarlierBroadcastAttempt.OnNetwork,
        u2: EEarlierBroadcastAttempt.NoVerdict,
      },
      rentedUuids: ['u1', 'u2'],
    });

    await expect(
      vault.preActionsBeforeSending({
        unsignedTxs: [
          unsignedTxOf('aa11', { uuid: 'u1' }),
          unsignedTxOf('bb22', { uuid: 'u2' }),
        ],
        tronResourceRentalInfo: rentalInfo(),
      }),
    ).resolves.toBeUndefined();

    expect(orderedUrls()).toEqual([]);
  });

  it('still sends when the paid order cannot be noted', async () => {
    const { vault, chainResource } = buildVault();
    chainResource.addTronRentalOrders.mockRejectedValueOnce(
      new OneKeyLocalError('storage full'),
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      vault.preActionsBeforeSending({
        unsignedTxs: [unsignedTxOf('aa11')],
        tronResourceRentalInfo: rentalInfo(),
      }),
    ).resolves.toEqual({ preSendTx: { txid: 'rental-pay' } });
  });

  it('tells the record lookup what kind of send follows', async () => {
    const { vault, getEarlierBroadcastAttempt } = buildVault();
    const beforeBroadcastAction = { type: 'primeInfiniPayment' };
    const wcPayPreBroadcastRecord = { paymentId: 'pay-1' };
    const unsignedTx = unsignedTxOf('aa11');

    await vault.preActionsBeforeSending({
      unsignedTxs: [unsignedTx],
      tronResourceRentalInfo: rentalInfo(),
      signOnly: true,
      beforeBroadcastAction,
      wcPayPreBroadcastRecord,
    } as unknown as Parameters<VaultTron['preActionsBeforeSending']>[0]);

    expect(getEarlierBroadcastAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        networkId,
        unsignedTx,
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
      const { vault, getEarlierBroadcastAttempt, chainResource, orderedUrls } =
        buildVault({
          attempts: { u1: EEarlierBroadcastAttempt.NoVerdict },
          rentedUuids: ['u1'],
        });

      await expect(
        vault.preActionsBeforeSending({
          unsignedTxs: [unsignedTxOf('aa11')],
          tronResourceRentalInfo: rentalInfo(overrides),
        }),
      ).resolves.toBeUndefined();

      expect(getEarlierBroadcastAttempt).not.toHaveBeenCalled();
      expect(chainResource.hasTronRentalOrder).not.toHaveBeenCalled();
      expect(orderedUrls()).toEqual([]);
    },
  );
});
