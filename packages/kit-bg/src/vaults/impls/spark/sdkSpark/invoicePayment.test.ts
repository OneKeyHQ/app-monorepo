// cspell:ignore Msat
/*
yarn jest packages/kit-bg/src/vaults/impls/spark/sdkSpark/invoicePayment.test.ts

Checks between the OneKey lightning service's decode of an invoice, which the
confirm page shows, and what the Breez SDK prepares and settles.
*/

import { sha256 } from '@noble/hashes/sha256';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type {
  IEncodedTxLightningSpark,
  IInvoiceDecodedResponse,
} from '@onekeyhq/shared/types/lightning';

import {
  buildSparkInvoiceEncodedTx,
  checkPreparedFeeApproved,
  checkPreparedInvoicePayment,
  findSettledInvoicePaymentProblem,
  isSparkPayableInvoice,
  isZeroAmountDecodedInvoice,
} from './invoicePayment';

import type {
  Payment,
  PrepareSendPaymentResponse,
} from '@breeztech/breez-sdk-spark';

// Format only: the helpers compare strings, they do not decode them.
const INVOICE = 'lnbc120n1p5qyj8kpp5mock0invoice0for0unit0tests0only';
const PREIMAGE = '11'.repeat(32);
const PAYMENT_HASH = bufferUtils.bytesToHex(
  sha256(bufferUtils.hexToBytes(PREIMAGE)),
);

function decodedInvoice(
  overrides: Partial<IInvoiceDecodedResponse> = {},
): IInvoiceDecodedResponse {
  return {
    paymentRequest: INVOICE,
    millisatoshis: '12000',
    satoshis: 12,
    timeExpireDate: 1_793_800_000,
    // The lightning service sends the tags as a list and no tagsObject.
    tags: [
      { tagName: 'description', data: 'coffee' },
      { tagName: 'payment_hash', data: PAYMENT_HASH },
      { tagName: 'expire_time', data: 86_400 },
    ],
    ...overrides,
  };
}

const ENCODED_TX: IEncodedTxLightningSpark = {
  invoice: INVOICE,
  paymentHash: PAYMENT_HASH,
  amountMillisatoshis: '12000',
  amountSats: '12',
  description: 'coffee',
  expiresAt: 1_793_800_000,
  maxFeeSats: '2',
};

function prepared({
  bolt11 = INVOICE,
  paymentHash = PAYMENT_HASH,
  amountMsat = 12_000,
  amount = BigInt(12),
  lightningFeeSats = 2,
  ...rest
}: {
  bolt11?: string;
  paymentHash?: string;
  amountMsat?: number;
  amount?: bigint;
  lightningFeeSats?: number;
  feePolicy?: string;
  tokenIdentifier?: string;
} = {}) {
  return {
    paymentMethod: {
      type: 'bolt11Invoice',
      invoiceDetails: {
        invoice: { bolt11, source: {} },
        paymentHash,
        amountMsat,
      },
      lightningFeeSats,
    },
    amount,
    feePolicy: 'feesExcluded',
    ...rest,
  } as unknown as PrepareSendPaymentResponse;
}

function lightningPayment(
  overrides: { paymentHash?: string; preimage?: string } = {},
) {
  const { paymentHash = PAYMENT_HASH } = overrides;
  // An explicit undefined stands for a payment without a preimage.
  const preimage = 'preimage' in overrides ? overrides.preimage : PREIMAGE;
  return {
    id: '019a4f0e-7c52-7d61-9a1b-3c2d4e5f6a7b',
    paymentType: 'send',
    status: 'completed',
    amount: BigInt(12),
    fees: BigInt(2),
    method: 'lightning',
    details: {
      type: 'lightning',
      invoice: INVOICE,
      htlcDetails: { paymentHash, preimage, status: 'preimageShared' },
    },
  } as unknown as Payment;
}

describe('isSparkPayableInvoice', () => {
  it('accepts plain BOLT11 invoices in either case', () => {
    expect(isSparkPayableInvoice(INVOICE)).toBe(true);
    expect(isSparkPayableInvoice(INVOICE.toUpperCase())).toBe(true);
  });

  it.each([
    [
      'LNURL',
      'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns',
    ],
    ['a Lightning address', 'alice@example.com'],
    ['an invoice behind a URI scheme', `lightning:${INVOICE}`],
    ['a URL', `https://example.com/${INVOICE}`],
    ['an invoice with a domain glued on', `${INVOICE}@evil.example`],
  ])(
    'rejects %s, which the Breez SDK would resolve over the network',
    (_name, input) => {
      expect(isSparkPayableInvoice(input)).toBe(false);
    },
  );
});

describe('buildSparkInvoiceEncodedTx', () => {
  it('takes the invoice fields from the server decode', () => {
    expect(
      buildSparkInvoiceEncodedTx({ input: INVOICE, decoded: decodedInvoice() }),
    ).toEqual({
      invoice: INVOICE,
      paymentHash: PAYMENT_HASH,
      amountMillisatoshis: '12000',
      amountSats: '12',
      description: 'coffee',
      expiresAt: 1_793_800_000,
    });
  });

  it('accepts the entered invoice with other letter case and spaces', () => {
    expect(
      buildSparkInvoiceEncodedTx({
        input: ` ${INVOICE.toUpperCase()} `,
        decoded: decodedInvoice(),
      }).invoice,
    ).toBe(INVOICE);
  });

  it('refuses a decode that describes another invoice than the one entered', () => {
    expect(() =>
      buildSparkInvoiceEncodedTx({
        input: INVOICE,
        decoded: decodedInvoice({ paymentRequest: `${INVOICE}x` }),
      }),
    ).toThrow();
  });

  it('refuses a decoded request the SDK would resolve over the network', () => {
    expect(() =>
      buildSparkInvoiceEncodedTx({
        input: 'alice@example.com',
        decoded: decodedInvoice({ paymentRequest: 'alice@example.com' }),
      }),
    ).toThrow();
  });

  it('refuses invoices without an amount or a payment hash', () => {
    expect(() =>
      buildSparkInvoiceEncodedTx({
        input: INVOICE,
        decoded: decodedInvoice({ millisatoshis: null, satoshis: null }),
      }),
    ).toThrow('Invoices without an amount are not supported');
    expect(() =>
      buildSparkInvoiceEncodedTx({
        input: INVOICE,
        decoded: decodedInvoice({
          tags: [{ tagName: 'description', data: 'coffee' }],
        }),
      }),
    ).toThrow();
  });

  it('rounds an amount with a millisat part up to whole sats', () => {
    expect(
      buildSparkInvoiceEncodedTx({
        input: INVOICE,
        decoded: decodedInvoice({ millisatoshis: '12500' }),
      }),
    ).toMatchObject({
      amountMillisatoshis: '12500',
      amountSats: '13',
    });
  });

  it('treats invoices without millisats or sats as zero-amount', () => {
    expect(isZeroAmountDecodedInvoice(decodedInvoice())).toBe(false);
    expect(
      isZeroAmountDecodedInvoice(
        decodedInvoice({ millisatoshis: null, satoshis: null }),
      ),
    ).toBe(true);
  });
});

describe('checkPreparedInvoicePayment', () => {
  it('passes a preparation of the confirmed invoice', () => {
    expect(() =>
      checkPreparedInvoicePayment({
        prepared: prepared(),
        encodedTx: ENCODED_TX,
      }),
    ).not.toThrow();
  });

  it.each([
    ['another invoice', { bolt11: `${INVOICE}x` }],
    ['another payment hash', { paymentHash: '22'.repeat(32) }],
    ['another invoice amount', { amountMsat: 13_000 }],
    ['another sent amount', { amount: BigInt(13) }],
    ['fees taken from the amount', { feePolicy: 'feesIncluded' }],
    ['a token leg', { tokenIdentifier: 'btkn1token' }],
    ['a fee that is not a whole number of sats', { lightningFeeSats: 1.5 }],
  ])('stops a preparation with %s', (_name, overrides) => {
    expect(() =>
      checkPreparedInvoicePayment({
        prepared: prepared(overrides),
        encodedTx: ENCODED_TX,
      }),
    ).toThrow();
  });

  it('stops a preparation that is not a Lightning invoice payment', () => {
    const sparkTransfer = {
      ...prepared(),
      paymentMethod: { type: 'sparkAddress', address: 'spark1x', fee: '0' },
    } as unknown as PrepareSendPaymentResponse;

    expect(() =>
      checkPreparedInvoicePayment({
        prepared: sparkTransfer,
        encodedTx: ENCODED_TX,
      }),
    ).toThrow();
  });
});

describe('checkPreparedFeeApproved', () => {
  it('passes a fee up to the approved one', () => {
    expect(() =>
      checkPreparedFeeApproved({
        prepared: prepared({ lightningFeeSats: 2 }),
        encodedTx: ENCODED_TX,
      }),
    ).not.toThrow();
  });

  it('stops a higher fee, or a payment whose fee was never approved', () => {
    expect(() =>
      checkPreparedFeeApproved({
        prepared: prepared({ lightningFeeSats: 3 }),
        encodedTx: ENCODED_TX,
      }),
    ).toThrow('The Lightning fee changed');
    expect(() =>
      checkPreparedFeeApproved({
        prepared: prepared(),
        encodedTx: { ...ENCODED_TX, maxFeeSats: undefined },
      }),
    ).toThrow('The Lightning fee changed');
  });
});

describe('findSettledInvoicePaymentProblem', () => {
  it('accepts a payment that reveals the preimage of the payment hash', () => {
    expect(
      findSettledInvoicePaymentProblem({
        payment: lightningPayment(),
        encodedTx: ENCODED_TX,
      }),
    ).toBeUndefined();
  });

  it('reports a missing or wrong preimage, or another payment hash', () => {
    expect(
      findSettledInvoicePaymentProblem({
        payment: lightningPayment({ preimage: '22'.repeat(32) }),
        encodedTx: ENCODED_TX,
      }),
    ).toBe('preimage does not match the payment hash');
    expect(
      findSettledInvoicePaymentProblem({
        payment: lightningPayment({ preimage: undefined }),
        encodedTx: ENCODED_TX,
      }),
    ).toBe('preimage does not match the payment hash');
    expect(
      findSettledInvoicePaymentProblem({
        payment: lightningPayment({ paymentHash: '33'.repeat(32) }),
        encodedTx: ENCODED_TX,
      }),
    ).toBe('payment hash differs from the invoice');
  });

  it('reports a payment that did not go over Lightning', () => {
    const sparkPayment = {
      ...lightningPayment(),
      method: 'spark',
      details: { type: 'spark' },
    } as unknown as Payment;

    expect(
      findSettledInvoicePaymentProblem({
        payment: sparkPayment,
        encodedTx: ENCODED_TX,
      }),
    ).toBe('not a Lightning payment');
  });
});
