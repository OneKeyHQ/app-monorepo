// cspell:ignore Msat
/*
yarn jest packages/kit-bg/src/services/ServiceLightningSpark/ServiceLightningSpark.payment.test.ts

Paying a BOLT11 invoice with the Breez SDK: the confirm page gets the SDK's
fee quote, and the send prepares again, stops on a changed invoice or a fee
above the approved one, and pays over Lightning.
*/

// --- mocks MUST be defined before the import of ServiceLightningSpark ---

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  backgroundMethodForDev:
    () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
      d,
}));

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    LockApp: 'LockApp',
    UnlockApp: 'UnlockApp',
    AccountDataUpdate: 'AccountDataUpdate',
    HistoryTxStatusChanged: 'HistoryTxStatusChanged',
  },
  appEventBus: { on: jest.fn(), emit: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    lightning: {
      spark: { autoConnectFailed: jest.fn(), paymentNotVerified: jest.fn() },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isExtension: false },
}));

jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: Error,
  InvalidLightningPaymentRequest: Error,
}));

jest.mock('@onekeyhq/shared/types/setting', () => ({
  EReasonForNeedPassword: { Default: 'Default' },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/core/src/chains/spark/utils', () => ({
  getSparkNetworkFromImpl: jest.fn(),
}));

jest.mock('../../vaults/factory', () => ({
  vaultFactory: {},
}));

jest.mock('./sdk/breezSdk', () => ({
  loadBreezSdk: jest.fn(),
}));

/* eslint-disable import/first, import/order */
import { sha256 } from '@noble/hashes/sha256';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type { IEncodedTxLightningSpark } from '@onekeyhq/shared/types/lightning';

import ServiceLightningSpark from './ServiceLightningSpark';
/* eslint-enable import/first, import/order */

const sparkLog = defaultLogger.lightning.spark as unknown as Record<
  'paymentNotVerified',
  jest.Mock
>;

const ACCOUNT_ID = "hd-1--m/83696968'/1330334798'/0'/12'/0'";
const NETWORK_ID = 'lightningspark--0';
const INVOICE = 'lnbc120n1p5qyj8kpp5mock0invoice0for0unit0tests0only';
const PREIMAGE = '11'.repeat(32);
const PAYMENT_HASH = bufferUtils.bytesToHex(
  sha256(bufferUtils.hexToBytes(PREIMAGE)),
);
const PAYMENT_ID = '019a4f0e-7c52-7d61-9a1b-3c2d4e5f6a7b';

const ENCODED_TX: IEncodedTxLightningSpark = {
  invoice: INVOICE,
  paymentHash: PAYMENT_HASH,
  amountMillisatoshis: '12000',
  amountSats: '12',
  maxFeeSats: '2',
};

function preparedResponse({ lightningFeeSats = 2 } = {}) {
  return {
    paymentMethod: {
      type: 'bolt11Invoice',
      invoiceDetails: {
        invoice: { bolt11: INVOICE, source: {} },
        paymentHash: PAYMENT_HASH,
        amountMsat: 12_000,
      },
      lightningFeeSats,
    },
    amount: BigInt(12),
    feePolicy: 'feesExcluded',
  };
}

function payment({
  status = 'completed',
  preimage = PREIMAGE,
}: { status?: string; preimage?: string } = {}) {
  return {
    id: PAYMENT_ID,
    paymentType: 'send',
    status,
    amount: BigInt(12),
    fees: BigInt(2),
    method: 'lightning',
    details: {
      type: 'lightning',
      invoice: INVOICE,
      htlcDetails: { paymentHash: PAYMENT_HASH, preimage },
    },
  };
}

function makeService({ quotedFeeSats = 2, sentStatus = 'completed' } = {}) {
  const sdk = {
    prepareSendPayment: jest.fn(async () =>
      preparedResponse({ lightningFeeSats: quotedFeeSats }),
    ),
    sendPayment: jest.fn(async () => ({
      payment: payment({ status: sentStatus }),
    })),
  };
  const service = new ServiceLightningSpark({ backgroundApi: {} });
  const ensureConnected = jest
    .spyOn(
      service as unknown as {
        ensureConnected: (params: {
          accountId: string;
          networkId: string;
        }) => Promise<unknown>;
      },
      'ensureConnected',
    )
    .mockResolvedValue(sdk);
  return { service, sdk, ensureConnected };
}

const params = (encodedTx = ENCODED_TX) => ({
  accountId: ACCOUNT_ID,
  networkId: NETWORK_ID,
  encodedTx,
});

describe('ServiceLightningSpark invoice payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('quotes the Lightning fee from an SDK preparation of the invoice alone', async () => {
    const { service, sdk, ensureConnected } = makeService();

    await expect(service.quoteInvoicePayment(params())).resolves.toEqual({
      feeSats: '2',
    });
    expect(ensureConnected).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      networkId: NETWORK_ID,
    });
    expect(sdk.prepareSendPayment).toHaveBeenCalledWith({
      paymentRequest: { type: 'input', input: INVOICE },
    });
  });

  it('never hands the SDK a request it would resolve over the network', async () => {
    const { service, sdk } = makeService();

    await expect(
      service.quoteInvoicePayment(
        params({ ...ENCODED_TX, invoice: 'alice@example.com' }),
      ),
    ).rejects.toThrow();
    await expect(
      service.payInvoice(
        params({ ...ENCODED_TX, invoice: `lightning:${INVOICE}` }),
      ),
    ).rejects.toThrow();
    expect(sdk.prepareSendPayment).not.toHaveBeenCalled();
    expect(sdk.sendPayment).not.toHaveBeenCalled();
  });

  it('pays the prepared invoice over Lightning and returns the payment id', async () => {
    const { service, sdk } = makeService();

    await expect(service.payInvoice(params())).resolves.toEqual({
      paymentId: PAYMENT_ID,
    });
    expect(sdk.sendPayment).toHaveBeenCalledWith({
      prepareResponse: preparedResponse(),
      options: {
        type: 'bolt11Invoice',
        preferSpark: false,
        completionTimeoutSecs: 30,
      },
    });
    expect(sparkLog.paymentNotVerified).not.toHaveBeenCalled();
  });

  it('prepares an invoice without an amount with the amount the user entered', async () => {
    const { service, sdk } = makeService();
    const zeroAmount = {
      ...preparedResponse(),
      amount: BigInt(21),
    };
    zeroAmount.paymentMethod.invoiceDetails = {
      ...zeroAmount.paymentMethod.invoiceDetails,
      amountMsat: undefined as unknown as number,
    };
    sdk.prepareSendPayment.mockResolvedValueOnce(zeroAmount);

    await expect(
      service.quoteInvoicePayment(
        params({
          invoice: INVOICE,
          paymentHash: PAYMENT_HASH,
          amountSats: '21',
          maxFeeSats: '2',
        }),
      ),
    ).resolves.toEqual({ feeSats: '2' });
    expect(sdk.prepareSendPayment).toHaveBeenCalledWith({
      paymentRequest: { type: 'input', input: INVOICE },
      amount: BigInt(21),
    });
  });

  it('stops before sending when the new quote is above the approved fee', async () => {
    const { service, sdk } = makeService({ quotedFeeSats: 3 });

    await expect(service.payInvoice(params())).rejects.toThrow(
      'The Lightning fee changed',
    );
    expect(sdk.sendPayment).not.toHaveBeenCalled();
  });

  it('returns a payment still in flight, so history picks up the result', async () => {
    const { service } = makeService({ sentStatus: 'pending' });

    await expect(service.payInvoice(params())).resolves.toEqual({
      paymentId: PAYMENT_ID,
    });
  });

  it('fails the send when the SDK reports a failed payment', async () => {
    const { service } = makeService({ sentStatus: 'failed' });

    await expect(service.payInvoice(params())).rejects.toThrow(
      'Lightning payment failed',
    );
  });

  it('logs a completed payment whose preimage does not match the invoice', async () => {
    const { service, sdk } = makeService();
    sdk.sendPayment.mockResolvedValueOnce({
      payment: payment({ preimage: '22'.repeat(32) }),
    });

    await expect(service.payInvoice(params())).resolves.toEqual({
      paymentId: PAYMENT_ID,
    });
    expect(sparkLog.paymentNotVerified).toHaveBeenCalledWith({
      paymentId: PAYMENT_ID,
      reason: 'preimage does not match the payment hash',
    });
  });
});
