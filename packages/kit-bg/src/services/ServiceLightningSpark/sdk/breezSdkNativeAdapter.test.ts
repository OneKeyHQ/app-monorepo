// cspell:ignore breeztech uniffi Msat
import {
  checkPreparedInvoicePayment,
  findSettledInvoicePaymentProblem,
  getPreparedFeeSats,
} from '../../../vaults/impls/spark/sdkSpark/invoicePayment';

import { createBreezSdkNativeAdapter } from './breezSdkNativeAdapter';

import type { IBreezSdkSparkNative } from './breezSdkNativeAdapter';
import type { ISparkSdkEvent } from './types';

// The shapes below follow the generated bindings of
// @breeztech/breez-sdk-spark-react-native 0.26.1: a variant is an object with
// `tag` and `inner`, a plain enum is a number, and a u64 is a bigint.
type IMockVariant = { tag: string; inner?: unknown };
const variant = (tag: string) =>
  class implements IMockVariant {
    readonly tag = tag;

    constructor(readonly inner?: unknown) {}
  };

const INVOICE = 'lnbc1testinvoice';
// sha256 of 32 zero bytes
const PREIMAGE = '00'.repeat(32);
const PAYMENT_HASH =
  '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925';

const nativeInvoiceDetails = {
  amountMsat: 21_000n,
  expiry: 3600n,
  invoice: { bolt11: INVOICE, source: {} },
  paymentHash: PAYMENT_HASH,
  timestamp: 1_700_000_000n,
};

const nativePrepared = {
  paymentMethod: {
    tag: 'Bolt11Invoice',
    inner: {
      invoiceDetails: nativeInvoiceDetails,
      sparkTransferFeeSats: undefined,
      lightningFeeSats: 3n,
    },
  },
  amount: 21n,
  tokenIdentifier: undefined,
  conversionEstimate: undefined,
  feePolicy: 0,
};

const nativePayment = {
  id: 'payment-1',
  paymentType: 0,
  status: 0,
  amount: 21n,
  fees: 3n,
  timestamp: 1_700_000_100n,
  method: 0,
  details: {
    tag: 'Lightning',
    inner: {
      description: 'coffee',
      invoice: INVOICE,
      destinationPubkey: '02abc',
      htlcDetails: {
        paymentHash: PAYMENT_HASH,
        preimage: PREIMAGE,
        expiryTime: 1n,
        status: 1,
      },
    },
  },
  conversionDetails: undefined,
};

function setup() {
  const nativeSdk = {
    getInfo: jest.fn(async () => ({
      identityPubkey: '03identity',
      balanceSats: 179n,
      tokenBalances: new Map(),
    })),
    getUserSettings: jest.fn(async () => ({
      sparkPrivateModeEnabled: true,
      stableBalanceActiveLabel: undefined,
      sparkMasterIdentityPublicKey: undefined,
    })),
    updateUserSettings: jest.fn(async () => undefined),
    syncWallet: jest.fn(async () => ({})),
    receivePayment: jest.fn(async () => ({
      paymentRequest: INVOICE,
      fee: 0n,
      crossChainInfo: undefined,
    })),
    parse: jest.fn(
      async (): Promise<IMockVariant> => ({
        tag: 'Bolt11Invoice',
        inner: [nativeInvoiceDetails],
      }),
    ),
    listPayments: jest.fn(async () => ({ payments: [nativePayment] })),
    prepareSendPayment: jest.fn(async () => nativePrepared),
    sendPayment: jest.fn(async () => ({ payment: nativePayment })),
    addEventListener: jest.fn(async () => 'listener-1'),
    disconnect: jest.fn(async () => undefined),
    uniffiDestroy: jest.fn(),
  };
  const rn = {
    Network: { Mainnet: 0, Regtest: 1, Signet: 2 },
    PaymentType: { Send: 0, Receive: 1 },
    PaymentStatus: { Completed: 0, Pending: 1, Failed: 2 },
    PaymentMethod: {
      Lightning: 0,
      Spark: 1,
      Token: 2,
      Deposit: 3,
      Withdraw: 4,
      Unknown: 5,
    },
    FeePolicy: { FeesExcluded: 0, FeesIncluded: 1 },
    PaymentDetails_Tags: {
      Spark: 'Spark',
      Token: 'Token',
      Lightning: 'Lightning',
      Withdraw: 'Withdraw',
      Deposit: 'Deposit',
    },
    SdkEvent_Tags: {
      PaymentSucceeded: 'PaymentSucceeded',
      PaymentPending: 'PaymentPending',
      PaymentFailed: 'PaymentFailed',
      PaymentMetadataUpdated: 'PaymentMetadataUpdated',
    },
    InputType_Tags: { Bolt11Invoice: 'Bolt11Invoice' },
    SendPaymentMethod_Tags: { Bolt11Invoice: 'Bolt11Invoice' },
    Seed: { Mnemonic: variant('Mnemonic') },
    ReceivePaymentMethod: {
      Bolt11Invoice: variant('Bolt11Invoice'),
      SparkAddress: variant('SparkAddress'),
    },
    PaymentRequest: { Input: variant('Input') },
    SendPaymentOptions: { Bolt11Invoice: variant('Bolt11Invoice') },
    defaultConfig: jest.fn((network: number) => ({
      network,
      apiKey: undefined,
      syncIntervalSecs: 60,
      privateEnabledDefault: true,
      lnurlDomain: 'breez.tips',
      useDefaultExternalInputParsers: true,
      realTimeSyncServerUrl: 'https://sync.example',
    })),
    connect: jest.fn(async () => nativeSdk),
  };
  const resolveStorageDir = jest.fn(async (name: string) => `/docs/${name}`);
  const breez = createBreezSdkNativeAdapter({
    rn: rn as unknown as IBreezSdkSparkNative,
    resolveStorageDir,
  });
  const connect = () =>
    breez.connect({
      config: { ...breez.defaultConfig('mainnet'), apiKey: 'key' },
      seed: { type: 'mnemonic', mnemonic: 'test words' },
      storageDir: 'onekey-breez-mainnet-hd-1',
    });
  return { breez, connect, nativeSdk, resolveStorageDir, rn };
}

describe('createBreezSdkNativeAdapter', () => {
  it('connects with the native config, a mnemonic seed and an app directory', async () => {
    const { breez, connect, rn, resolveStorageDir } = setup();

    await connect();

    expect(rn.defaultConfig).toHaveBeenCalledWith(rn.Network.Mainnet);
    expect(resolveStorageDir).toHaveBeenCalledWith('onekey-breez-mainnet-hd-1');
    expect(rn.connect).toHaveBeenCalledWith({
      config: expect.objectContaining({
        network: rn.Network.Mainnet,
        apiKey: 'key',
        syncIntervalSecs: 60,
      }),
      seed: {
        tag: 'Mnemonic',
        inner: { mnemonic: 'test words', passphrase: undefined },
      },
      storageDir: '/docs/onekey-breez-mainnet-hd-1',
    });
    breez.defaultConfig('regtest');
    expect(rn.defaultConfig).toHaveBeenLastCalledWith(rn.Network.Regtest);
  });

  it('refuses a config it did not create and a seed that is not a mnemonic', async () => {
    const { breez, rn } = setup();
    const request = {
      config: breez.defaultConfig('mainnet'),
      seed: { type: 'mnemonic', mnemonic: 'test words' } as const,
      storageDir: 'dir',
    };

    await expect(
      breez.connect({
        ...request,
        config: {
          privateEnabledDefault: false,
          useDefaultExternalInputParsers: false,
        },
      }),
    ).rejects.toThrow('not a native config');
    await expect(
      breez.connect({ ...request, seed: { type: 'entropy' } }),
    ).rejects.toThrow('mnemonic only');
    expect(rn.connect).not.toHaveBeenCalled();
  });

  it('returns the balance as a number and rejects one that does not fit', async () => {
    const { connect, nativeSdk } = setup();
    const sdk = await connect();

    await expect(sdk.getInfo({ ensureSynced: false })).resolves.toEqual({
      identityPubkey: '03identity',
      balanceSats: 179,
    });
    expect(nativeSdk.getInfo).toHaveBeenCalledWith({ ensureSynced: false });

    nativeSdk.getInfo.mockResolvedValueOnce({
      identityPubkey: '03identity',
      balanceSats: 2n ** 60n,
      tokenBalances: new Map(),
    });
    await expect(sdk.getInfo({})).rejects.toThrow('unsafe balance');
  });

  it('reads and updates the private mode setting', async () => {
    const { connect, nativeSdk } = setup();
    const sdk = await connect();

    await expect(sdk.getUserSettings()).resolves.toEqual({
      sparkPrivateModeEnabled: true,
    });
    await sdk.updateUserSettings({ sparkPrivateModeEnabled: false });
    expect(nativeSdk.updateUserSettings).toHaveBeenCalledWith({
      sparkPrivateModeEnabled: false,
      stableBalanceActiveLabel: undefined,
      sparkMasterIdentityPublicKey: undefined,
    });
  });

  it('creates a BOLT11 invoice with and without an amount', async () => {
    const { connect, nativeSdk } = setup();
    const sdk = await connect();

    await expect(
      sdk.receivePayment({
        paymentMethod: {
          type: 'bolt11Invoice',
          description: 'coffee',
          amountSats: 100,
        },
      }),
    ).resolves.toEqual({ paymentRequest: INVOICE });
    expect(nativeSdk.receivePayment).toHaveBeenLastCalledWith({
      paymentMethod: {
        tag: 'Bolt11Invoice',
        inner: expect.objectContaining({
          description: 'coffee',
          amountSats: 100n,
        }),
      },
    });

    await sdk.receivePayment({
      paymentMethod: { type: 'bolt11Invoice', description: '' },
    });
    expect(nativeSdk.receivePayment).toHaveBeenLastCalledWith({
      paymentMethod: {
        tag: 'Bolt11Invoice',
        inner: expect.objectContaining({ amountSats: undefined }),
      },
    });
  });

  it('parses a BOLT11 invoice into numbers and names any other input', async () => {
    const { connect, nativeSdk } = setup();
    const sdk = await connect();

    await expect(sdk.parse(INVOICE)).resolves.toEqual({
      type: 'bolt11Invoice',
      paymentHash: PAYMENT_HASH,
      timestamp: 1_700_000_000,
      expiry: 3600,
    });

    nativeSdk.parse.mockResolvedValueOnce({
      tag: 'LightningAddress',
      inner: [{}],
    });
    await expect(sdk.parse('a@b.c')).resolves.toEqual({
      type: 'lightningAddress',
    });
  });

  it('lists payments in the web shapes', async () => {
    const { connect, nativeSdk, rn } = setup();
    const sdk = await connect();

    const { payments } = await sdk.listPayments({
      typeFilter: ['receive'],
      limit: 20,
    });

    expect(nativeSdk.listPayments).toHaveBeenCalledWith(
      expect.objectContaining({
        typeFilter: [rn.PaymentType.Receive],
        limit: 20,
        offset: undefined,
      }),
    );
    expect(payments).toEqual([
      {
        id: 'payment-1',
        paymentType: 'send',
        status: 'completed',
        amount: 21n,
        fees: 3n,
        timestamp: 1_700_000_100,
        method: 'lightning',
        details: {
          type: 'lightning',
          invoice: INVOICE,
          description: 'coffee',
          destinationPubkey: '02abc',
          htlcDetails: { paymentHash: PAYMENT_HASH, preimage: PREIMAGE },
        },
      },
    ]);
  });

  it.each([
    [{ tag: 'Spark', inner: { htlcDetails: undefined } }, { type: 'spark' }],
    [
      {
        tag: 'Spark',
        inner: {
          htlcDetails: { paymentHash: PAYMENT_HASH, preimage: undefined },
        },
      },
      { type: 'spark', htlcDetails: { paymentHash: PAYMENT_HASH } },
    ],
    [{ tag: 'Token', inner: {} }, { type: 'token' }],
    [{ tag: 'Withdraw', inner: { txId: 'tx' } }, { type: 'withdraw' }],
    [{ tag: 'Deposit', inner: { txId: 'tx', vout: 0 } }, { type: 'deposit' }],
  ])('maps payment details %j', async (details, expected) => {
    const { connect, nativeSdk } = setup();
    const sdk = await connect();
    nativeSdk.listPayments.mockResolvedValueOnce({
      payments: [
        {
          ...nativePayment,
          paymentType: 1,
          status: 1,
          method: 1,
          details: details as (typeof nativePayment)['details'],
        },
      ],
    });

    const { payments } = await sdk.listPayments({});

    expect(payments[0]).toMatchObject({
      paymentType: 'receive',
      status: 'pending',
      method: 'spark',
      details: expected,
    });
  });

  it('prepares a payment the invoice checks accept and sends the native preparation', async () => {
    const { connect, nativeSdk } = setup();
    const sdk = await connect();
    const encodedTx = {
      invoice: INVOICE,
      paymentHash: PAYMENT_HASH,
      amountSats: '21',
      amountMillisatoshis: '21000',
      maxFeeSats: '3',
    };

    const prepared = await sdk.prepareSendPayment({
      paymentRequest: { type: 'input', input: INVOICE },
    });

    expect(nativeSdk.prepareSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentRequest: { tag: 'Input', inner: { input: INVOICE } },
        amount: undefined,
      }),
    );
    expect(() =>
      checkPreparedInvoicePayment({ prepared, encodedTx }),
    ).not.toThrow();
    expect(getPreparedFeeSats(prepared)).toBe(3);

    const { payment } = await sdk.sendPayment({
      prepareResponse: prepared,
      options: {
        type: 'bolt11Invoice',
        preferSpark: false,
        completionTimeoutSecs: 30,
      },
    });

    const sent = nativeSdk.sendPayment.mock.calls[0] as unknown as [
      { prepareResponse: unknown; options: unknown },
    ];
    expect(sent[0].prepareResponse).toBe(nativePrepared);
    expect(sent[0].options).toEqual({
      tag: 'Bolt11Invoice',
      inner: { preferSpark: false, completionTimeoutSecs: 30 },
    });
    expect(payment.status).toBe('completed');
    expect(
      findSettledInvoicePaymentProblem({ payment, encodedTx }),
    ).toBeUndefined();
  });

  it('passes the entered amount of an invoice without one', async () => {
    const { connect, nativeSdk } = setup();
    const sdk = await connect();
    nativeSdk.prepareSendPayment.mockResolvedValueOnce({
      ...nativePrepared,
      paymentMethod: {
        tag: 'Bolt11Invoice',
        inner: {
          ...nativePrepared.paymentMethod.inner,
          invoiceDetails: { ...nativeInvoiceDetails, amountMsat: undefined },
        },
      },
    } as unknown as typeof nativePrepared);

    const prepared = await sdk.prepareSendPayment({
      paymentRequest: { type: 'input', input: INVOICE },
      amount: 21n,
    });

    expect(nativeSdk.prepareSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 21n }),
    );
    expect(prepared.paymentMethod).toMatchObject({
      type: 'bolt11Invoice',
      invoiceDetails: { amountMsat: undefined },
    });
  });

  it('refuses to send a preparation it did not make or another kind of payment', async () => {
    const { connect, nativeSdk } = setup();
    const sdk = await connect();
    const prepared = await sdk.prepareSendPayment({
      paymentRequest: { type: 'input', input: INVOICE },
    });

    await expect(
      sdk.sendPayment({ prepareResponse: { ...prepared } }),
    ).rejects.toThrow('Unknown Lightning payment preparation');
    await expect(
      sdk.sendPayment({
        prepareResponse: prepared,
        options: { type: 'sparkAddress' },
      }),
    ).rejects.toThrow('BOLT11 payments only');
    expect(nativeSdk.sendPayment).not.toHaveBeenCalled();
  });

  it('names a preparation that is not a BOLT11 payment', async () => {
    const { connect, nativeSdk } = setup();
    const sdk = await connect();
    nativeSdk.prepareSendPayment.mockResolvedValueOnce({
      ...nativePrepared,
      paymentMethod: { tag: 'SparkAddress', inner: {} },
      feePolicy: 1,
    } as unknown as typeof nativePrepared);

    const prepared = await sdk.prepareSendPayment({
      paymentRequest: { type: 'input', input: 'spark1address' },
    });

    expect(prepared.paymentMethod).toEqual({ type: 'sparkAddress' });
    expect(prepared.feePolicy).toBe('feesIncluded');
  });

  it('hands events to the listener in the web shapes', async () => {
    const { connect, nativeSdk } = setup();
    const sdk = await connect();
    const events: ISparkSdkEvent[] = [];

    await expect(
      sdk.addEventListener({ onEvent: (event) => events.push(event) }),
    ).resolves.toBe('listener-1');
    const [[listener]] = nativeSdk.addEventListener.mock.calls as unknown as [
      [{ onEvent: (event: unknown) => Promise<void> }],
    ];
    await listener.onEvent({ tag: 'Synced' });
    await listener.onEvent({
      tag: 'PaymentSucceeded',
      inner: { payment: nativePayment },
    });

    expect(events).toEqual([
      { type: 'synced' },
      {
        type: 'paymentSucceeded',
        payment: expect.objectContaining({
          id: 'payment-1',
          status: 'completed',
        }),
      },
    ]);
  });

  it('frees the native object when it disconnects, even after an error', async () => {
    const { connect, nativeSdk } = setup();
    const sdk = await connect();

    await sdk.disconnect();
    expect(nativeSdk.uniffiDestroy).toHaveBeenCalledTimes(1);

    nativeSdk.disconnect.mockRejectedValueOnce(new Error('offline'));
    await expect(sdk.disconnect()).rejects.toThrow('offline');
    expect(nativeSdk.uniffiDestroy).toHaveBeenCalledTimes(2);
  });
});
