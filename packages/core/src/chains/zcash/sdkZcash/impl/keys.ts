import bs58check from 'bs58check';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { getKeys, getRuntime, getRuntimeWasm } from './carrier';
import { zcashHexToBytes } from './hex';

import type {
  IZcashDeriveAccountKeysParams,
  IZcashDeriveAccountKeysResult,
  IZcashDeriveAccountParams,
  IZcashDeriveAccountResult,
  IZcashDeriveAddressFromUfvkParams,
  IZcashDeriveAddressFromUfvkResult,
  IZcashDeriveTransparentXpubFromUfvkParams,
  IZcashGetChainTipParams,
  IZcashNetwork,
  IZcashParseTransparentTransactionsParams,
  IZcashParsedTransparentTransaction,
  IZcashPcztReviewRequest,
  IZcashSignPcztParams,
  IZcashTransparentHardwareCreateParams,
  IZcashTransparentHardwareFinalizeParams,
  IZcashTransparentTxBuildResult,
  IZcashTransparentTxQuote,
  IZcashTransparentTxRequest,
} from '../types/sdk';

// Keys package has no storage/network/SQLite; a compile-time boundary keeps
// spending material from reaching the scanning code even by accident.

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function validateAddress(params: {
  network: IZcashNetwork;
  address: string;
}): Promise<boolean> {
  const keys = await getKeys();
  return keys.validateAddress(params.network, params.address);
}

export async function deriveAccountKeys(
  params: IZcashDeriveAccountKeysParams,
): Promise<IZcashDeriveAccountKeysResult> {
  const keys = await getKeys();
  const orchardSk = zcashHexToBytes(params.orchardSkHex);
  let ufvk: string;
  try {
    ufvk = keys.ufvkFromAccountKeys(
      params.network,
      orchardSk,
      params.accountXpub,
      params.hdIndex,
    );
  } finally {
    // Clear even if the wasm call throws. The wire-format string itself can't
    // be cleared in JS.
    orchardSk.fill(0);
  }

  // Unified address omits Sapling (wallet can't spend it - would strand
  // funds) and transparent (would link transparent/shielded activity).
  const unifiedAddress = keys.unifiedAddress(params.network, ufvk, 'orchard');
  const transparentAddress = keys.transparentAddressFromUfvk(
    params.network,
    ufvk,
  );
  return { ufvk, unifiedAddress, transparentAddress };
}

export async function deriveAccount(
  params: IZcashDeriveAccountParams,
): Promise<IZcashDeriveAccountResult> {
  const { lightwalletdUrl, ...keyParams } = params;
  // Keys first: the Orchard key copy is cleared before the network await.
  const derived = await deriveAccountKeys(keyParams);

  let chainTip: number | null = null;
  try {
    const rt = await getRuntime();
    chainTip = await rt.chainTipAt(lightwalletdUrl);
  } catch {
    // Offline, or no wallet runtime: null is a documented outcome, not a
    // failure - caller already handles null when picking a birthday.
    chainTip = null;
  }

  return { ...derived, chainTip };
}

export async function deriveAddressFromUfvk(
  params: IZcashDeriveAddressFromUfvkParams,
): Promise<IZcashDeriveAddressFromUfvkResult> {
  const keys = await getKeys();
  return {
    unifiedAddress: keys.unifiedAddress(params.network, params.ufvk, 'orchard'),
    transparentAddress: keys.transparentAddressFromUfvk(
      params.network,
      params.ufvk,
    ),
  };
}

// UFVK carries only chain code + pubkey; depth/child number come from the
// known account path, parent fingerprint is unused metadata left zero.
const XPUB_VERSION: Record<IZcashNetwork, number> = {
  main: 0x04_88_b2_1e,
  test: 0x04_35_87_cf,
};

export async function deriveTransparentXpubFromUfvk(
  params: IZcashDeriveTransparentXpubFromUfvkParams,
): Promise<{ xpub: string }> {
  const keys = await getKeys();
  const accountKey = Buffer.from(
    keys.transparentAccountPubKeyFromUfvk(params.network, params.ufvk),
    'hex',
  );
  if (accountKey.length !== 65) {
    throw new OneKeyLocalError(
      `zcash: unexpected transparent account key length ${accountKey.length}`,
    );
  }
  const payload = Buffer.alloc(78);
  payload.writeUInt32BE(XPUB_VERSION[params.network], 0);
  payload[4] = 3; // depth: m/44'/133'/account'
  payload.writeUInt32BE(0, 5); // parent fingerprint unknown
  payload.writeUInt32BE(0x80_00_00_00 + params.hdIndex, 9); // hardened child
  accountKey.copy(payload, 13); // chain code (32) + compressed pubkey (33)
  return { xpub: bs58check.encode(payload) };
}

export async function signPczt(
  params: IZcashSignPcztParams,
): Promise<{ pcztHex: string }> {
  const keys = await getKeys();
  const pczt = zcashHexToBytes(params.pcztHex);
  const reviewJson = stringUtils.stableStringify(params.review);
  // Verify the review before any key is used.
  keys.pcztVerifyReview(pczt, reviewJson);
  const orchardSk = zcashHexToBytes(params.orchardSkHex);
  const accountXprvBytes = zcashHexToBytes(params.accountXprvHex);
  try {
    const signed = keys.pcztSignWithAccountKeys(
      params.network,
      orchardSk,
      bs58check.encode(accountXprvBytes),
      params.hdIndex,
      pczt,
      reviewJson,
    );
    return { pcztHex: bytesToHex(signed) };
  } finally {
    // Only clears these copies; the caller's hex strings stay until GC -
    // the host's problem to bound, not fixable at the wasm boundary.
    orchardSk.fill(0);
    accountXprvBytes.fill(0);
    pczt.fill(0);
  }
}

// The copy a hardware signer gets, without Sapling `bsk` and proving fields
// that signing doesn't need (as upstream `redact_pczt_for_signer`). Keep the
// original; combining the device's result into it restores them.
export async function redactPcztForHardwareSigner(params: {
  pcztHex: string;
}): Promise<{ pcztHex: string }> {
  const keys = await getKeys();
  return {
    pcztHex: bytesToHex(
      keys.pcztRedactForHardwareSigner(zcashHexToBytes(params.pcztHex)),
    ),
  };
}

export async function verifyPcztReview(params: {
  pcztHex: string;
  review: IZcashPcztReviewRequest;
}): Promise<void> {
  const keys = await getKeys();
  keys.pcztVerifyReview(
    zcashHexToBytes(params.pcztHex),
    stringUtils.stableStringify(params.review),
  );
}

export async function parseTransparentTransactions(
  params: IZcashParseTransparentTransactionsParams,
): Promise<IZcashParsedTransparentTransaction[]> {
  const keys = await getKeys();
  return JSON.parse(
    keys.parseTransparentTransactions(stringUtils.stableStringify(params)),
  ) as IZcashParsedTransparentTransaction[];
}

export async function quoteTransparentTx(
  params: IZcashTransparentTxRequest,
): Promise<IZcashTransparentTxQuote> {
  const keys = await getKeys();
  return JSON.parse(
    keys.transparentTxQuote(stringUtils.stableStringify(params)),
  ) as IZcashTransparentTxQuote;
}

async function buildStatelessShielding({
  request,
  create,
  sign,
}: {
  request: IZcashTransparentTxRequest;
  create: () => Uint8Array;
  sign: (original: Uint8Array, proved: Uint8Array) => Uint8Array;
}): Promise<IZcashTransparentTxBuildResult> {
  const quote = await quoteTransparentTx(request);
  // Load only the computation module: getRuntime() would initialize OPFS.
  const runtime = await getRuntimeWasm();
  const original = create();
  let proved: Uint8Array | undefined;
  let signed: Uint8Array | undefined;
  try {
    proved = runtime.pcztProveAtHeight(request.targetHeight, original);
    signed = sign(original, proved);
    const extracted = JSON.parse(runtime.pcztExtractStateless(signed)) as {
      rawTx: string;
      txid: string;
    };
    return {
      ...extracted,
      feeZat: quote.feeZat,
      expiryHeight: quote.expiryHeight,
      spentOutpoints: quote.spentOutpoints,
    };
  } finally {
    original.fill(0);
    proved?.fill(0);
    signed?.fill(0);
  }
}

export async function buildTransparentTxWithAccountXprv(
  params: IZcashTransparentTxRequest & { accountXprvHex: string },
): Promise<IZcashTransparentTxBuildResult> {
  const { accountXprvHex, ...request } = params;
  const keys = await getKeys();
  const accountXprvBytes = zcashHexToBytes(accountXprvHex);
  try {
    if (
      request.recipients.some((recipient) => recipient.address.startsWith('u1'))
    ) {
      const requestJson = stringUtils.stableStringify(request);
      const accountXprv = bs58check.encode(accountXprvBytes);
      return await buildStatelessShielding({
        request,
        create: () =>
          keys.transparentShieldCreateWithAccountXprv(requestJson, accountXprv),
        sign: (original, proved) =>
          keys.transparentShieldSignWithAccountXprv(
            requestJson,
            accountXprv,
            original,
            proved,
          ),
      });
    }
    return JSON.parse(
      keys.transparentTxBuildWithAccountXprv(
        stringUtils.stableStringify(request),
        bs58check.encode(accountXprvBytes),
      ),
    ) as IZcashTransparentTxBuildResult;
  } finally {
    accountXprvBytes.fill(0);
  }
}

export async function createTransparentHardwarePczt(
  params: IZcashTransparentHardwareCreateParams,
): Promise<{ pcztHex: string }> {
  const keys = await getKeys();
  const pczt = keys.transparentTxCreateWithAccountXpub(
    stringUtils.stableStringify(params.request),
    params.accountXpub,
    params.seedFingerprintHex,
  );
  try {
    return { pcztHex: bytesToHex(pczt) };
  } finally {
    pczt.fill(0);
  }
}

export async function finalizeTransparentHardwarePczt(
  params: IZcashTransparentHardwareFinalizeParams,
): Promise<IZcashTransparentTxBuildResult> {
  const keys = await getKeys();
  const quote = await quoteTransparentTx(params.request);
  const original = zcashHexToBytes(params.originalPcztHex);
  const signed = zcashHexToBytes(params.signedPcztHex);
  let combined: Uint8Array | undefined;
  let proved: Uint8Array | undefined;
  try {
    combined = keys.transparentTxCombineHardwareSigned(
      stringUtils.stableStringify(params.request),
      params.accountXpub,
      original,
      signed,
    );
    const runtime = await getRuntimeWasm();
    proved = runtime.pcztProveAtHeight(params.request.targetHeight, combined);
    const extracted = JSON.parse(runtime.pcztExtractStateless(proved)) as {
      rawTx: string;
      txid: string;
    };
    return {
      ...extracted,
      feeZat: quote.feeZat,
      expiryHeight: quote.expiryHeight,
      spentOutpoints: quote.spentOutpoints,
    };
  } finally {
    original.fill(0);
    signed.fill(0);
    combined?.fill(0);
    proved?.fill(0);
  }
}

export async function getChainTip(
  params: IZcashGetChainTipParams,
): Promise<number | null> {
  try {
    const rt = await getRuntime();
    return await rt.chainTipAt(params.lightwalletdUrl);
  } catch {
    // Contract: null on failure, not a throw - callers must handle it when offline.
    return null;
  }
}
