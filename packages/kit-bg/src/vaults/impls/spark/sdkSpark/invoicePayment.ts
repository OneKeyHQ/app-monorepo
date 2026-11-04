// cspell:ignore Msat
import { sha256 } from '@noble/hashes/sha256';
import BigNumber from 'bignumber.js';

import {
  InvalidLightningPaymentRequest,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type {
  IEncodedTxLightningSpark,
  IInvoiceDecodedResponse,
} from '@onekeyhq/shared/types/lightning';

import type {
  Payment,
  PrepareSendPaymentResponse,
} from '@breeztech/breez-sdk-spark';

// The Breez SDK resolves some inputs over the network before it decodes
// anything: Lightning addresses, LNURL and URLs. A string made of letters and
// digits after the `ln` prefix is none of these, so the SDK only receives
// invoices that pass this check and that the OneKey lightning service decoded.
const PAYABLE_INVOICE_PATTERN = /^ln[a-z0-9]+$/;

export function isSparkPayableInvoice(invoice: string): boolean {
  const value = invoice.toLowerCase();
  return PAYABLE_INVOICE_PATTERN.test(value) && !value.startsWith('lnurl');
}

function getInvoiceAmountMillisatoshis(decoded: IInvoiceDecodedResponse) {
  if (decoded.millisatoshis) {
    return new BigNumber(decoded.millisatoshis);
  }
  return new BigNumber(decoded.satoshis ?? 0).times(1000);
}

export function isZeroAmountDecodedInvoice(decoded: IInvoiceDecodedResponse) {
  return !getInvoiceAmountMillisatoshis(decoded).gt(0);
}

// The lightning service returns the invoice tags as a list, as the bolt11
// library decodes them; it sends no `tagsObject`.
function getInvoiceTagText(decoded: IInvoiceDecodedResponse, tagName: string) {
  const data = decoded.tags?.find((tag) => tag.tagName === tagName)?.data;
  return typeof data === 'string' ? data : undefined;
}

/**
 * Builds the payment from the OneKey lightning service's decode of the
 * invoice the user entered. An invoice without an amount pays the whole
 * number of sats the user entered on the amount page.
 */
export function buildSparkInvoiceEncodedTx({
  input,
  decoded,
  enteredAmountSats,
}: {
  input: string;
  decoded: IInvoiceDecodedResponse;
  enteredAmountSats?: string;
}): IEncodedTxLightningSpark {
  const invoice = decoded.paymentRequest ?? '';
  const paymentHash = getInvoiceTagText(decoded, 'payment_hash');
  // The confirm page shows the decode, so it must describe the invoice the
  // user entered and nothing else.
  if (
    !isSparkPayableInvoice(invoice) ||
    invoice.toLowerCase() !== input.trim().toLowerCase() ||
    !paymentHash ||
    !/^[0-9a-f]{64}$/i.test(paymentHash)
  ) {
    throw new InvalidLightningPaymentRequest();
  }
  const fields = {
    invoice,
    paymentHash,
    description: getInvoiceTagText(decoded, 'description'),
    expiresAt: decoded.timeExpireDate,
  };
  if (isZeroAmountDecodedInvoice(decoded)) {
    const amountSats = new BigNumber(enteredAmountSats ?? 0);
    if (!amountSats.isInteger() || amountSats.lte(0)) {
      throw new OneKeyLocalError('Enter an amount of at least 1 sat');
    }
    return { ...fields, amountSats: amountSats.toFixed() };
  }
  const amountMillisatoshis = getInvoiceAmountMillisatoshis(decoded);
  if (!amountMillisatoshis.isInteger()) {
    throw new InvalidLightningPaymentRequest();
  }
  return {
    ...fields,
    amountMillisatoshis: amountMillisatoshis.toFixed(),
    amountSats: amountMillisatoshis
      .div(1000)
      .integerValue(BigNumber.ROUND_CEIL)
      .toFixed(),
  };
}

// An invoice without an amount is prepared with the amount the user entered.
export function getPrepareAmountSats(encodedTx: IEncodedTxLightningSpark) {
  return encodedTx.amountMillisatoshis === undefined
    ? BigInt(encodedTx.amountSats)
    : undefined;
}

export function getPreparedFeeSats(prepared: PrepareSendPaymentResponse) {
  if (prepared.paymentMethod.type !== 'bolt11Invoice') {
    throw new InvalidLightningPaymentRequest();
  }
  return prepared.paymentMethod.lightningFeeSats;
}

/**
 * Stops a payment whose SDK preparation differs from the invoice the confirm
 * page showed: another invoice, hash or amount, or a token or conversion leg.
 * An invoice without an amount must still have none in the SDK's parse.
 */
export function checkPreparedInvoicePayment({
  prepared,
  encodedTx,
}: {
  prepared: PrepareSendPaymentResponse;
  encodedTx: IEncodedTxLightningSpark;
}) {
  const method = prepared.paymentMethod;
  if (
    method.type !== 'bolt11Invoice' ||
    method.invoiceDetails.invoice.bolt11.toLowerCase() !==
      encodedTx.invoice.toLowerCase() ||
    method.invoiceDetails.paymentHash !== encodedTx.paymentHash ||
    (encodedTx.amountMillisatoshis === undefined
      ? Boolean(method.invoiceDetails.amountMsat)
      : String(method.invoiceDetails.amountMsat) !==
        encodedTx.amountMillisatoshis) ||
    prepared.amount.toString() !== encodedTx.amountSats ||
    prepared.feePolicy !== 'feesExcluded' ||
    prepared.tokenIdentifier !== undefined ||
    prepared.conversionEstimate !== undefined
  ) {
    throw new OneKeyLocalError(
      'Lightning payment does not match the confirmed invoice',
    );
  }
  if (
    !Number.isSafeInteger(method.lightningFeeSats) ||
    method.lightningFeeSats < 0
  ) {
    throw new OneKeyLocalError('Invalid Lightning fee quote');
  }
}

/** The approved fee caps the fee of the payment that is sent. */
export function checkPreparedFeeApproved({
  prepared,
  encodedTx,
}: {
  prepared: PrepareSendPaymentResponse;
  encodedTx: IEncodedTxLightningSpark;
}) {
  const { maxFeeSats } = encodedTx;
  if (
    maxFeeSats === undefined ||
    new BigNumber(getPreparedFeeSats(prepared)).gt(maxFeeSats)
  ) {
    throw new OneKeyLocalError(
      'The Lightning fee changed, please confirm the payment again',
    );
  }
}

/**
 * A completed Lightning payment proves itself with the preimage of the
 * invoice's payment hash. Returns why a payment does not, or undefined.
 */
export function findSettledInvoicePaymentProblem({
  payment,
  encodedTx,
}: {
  payment: Payment;
  encodedTx: IEncodedTxLightningSpark;
}): string | undefined {
  const { details } = payment;
  if (details?.type !== 'lightning') {
    return 'not a Lightning payment';
  }
  const { paymentHash, preimage } = details.htlcDetails;
  if (paymentHash !== encodedTx.paymentHash) {
    return 'payment hash differs from the invoice';
  }
  if (
    !preimage ||
    !/^[0-9a-f]{64}$/i.test(preimage) ||
    bufferUtils.bytesToHex(sha256(bufferUtils.hexToBytes(preimage))) !==
      paymentHash.toLowerCase()
  ) {
    return 'preimage does not match the payment hash';
  }
  return undefined;
}
