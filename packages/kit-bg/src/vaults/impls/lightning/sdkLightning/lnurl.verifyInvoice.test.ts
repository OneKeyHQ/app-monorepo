import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

import type {
  IInvoiceDecodedResponse,
  ILNURLPaymentInfo,
} from '@onekeyhq/shared/types/lightning';

import { verifyInvoice } from './lnurl';

// The checks the LNURL pay modal runs on the invoice a pay callback returns;
// on self-custody Lightning a failed check stops the payment.
const METADATA = '[["text/plain","coffee"]]';
const METADATA_HASH = bytesToHex(sha256(METADATA));
const AMOUNT_MILLISATOSHIS = 100_000;

function decodedInvoice({
  millisatoshis = String(AMOUNT_MILLISATOSHIS),
  descriptionHash = METADATA_HASH,
} = {}) {
  return {
    millisatoshis,
    tags: [{ tagName: 'purpose_commit_hash', data: descriptionHash }],
  } as unknown as IInvoiceDecodedResponse;
}

const paymentInfo = { pr: 'lnbc1invoice' } as ILNURLPaymentInfo;

describe('verifyInvoice', () => {
  it('accepts an invoice for the requested amount and metadata', () => {
    expect(
      verifyInvoice({
        decodedInvoice: decodedInvoice(),
        paymentInfo,
        metadata: METADATA,
        amount: AMOUNT_MILLISATOSHIS,
      }),
    ).toBe(true);
  });

  it('rejects an invoice for another amount', () => {
    expect(
      verifyInvoice({
        decodedInvoice: decodedInvoice({ millisatoshis: '200000' }),
        paymentInfo,
        metadata: METADATA,
        amount: AMOUNT_MILLISATOSHIS,
      }),
    ).toBe(false);
  });

  it('rejects an invoice whose description hash is not the metadata hash', () => {
    expect(
      verifyInvoice({
        decodedInvoice: decodedInvoice({ descriptionHash: 'ab'.repeat(32) }),
        paymentInfo,
        metadata: METADATA,
        amount: AMOUNT_MILLISATOSHIS,
      }),
    ).toBe(false);
  });

  it('rejects a success action it does not know', () => {
    expect(
      verifyInvoice({
        decodedInvoice: decodedInvoice(),
        paymentInfo: {
          ...paymentInfo,
          successAction: { tag: 'script' },
        } as unknown as ILNURLPaymentInfo,
        metadata: METADATA,
        amount: AMOUNT_MILLISATOSHIS,
      }),
    ).toBe(false);
  });
});
