import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { readZcashRuntimeError } from '../runtimeError';

import { getKeys, getRuntime, withWallet } from './carrier';
import {
  ALLOW_ZERO_CONF_SHIELDING,
  FALLBACK_CHANGE_POOL,
  LOCK_FOR_BLOCKS,
  PAD_ORCHARD_BUNDLE,
  SHIELDING_THRESHOLD_ZAT,
  TRUSTED_CONFIRMATIONS,
  UNTRUSTED_CONFIRMATIONS,
} from './policy';

import type {
  IZcashCombinePcztParams,
  IZcashPcztReservation,
  IZcashSendQuote,
  IZcashSendResult,
  IZcashSpendSource,
  IZcashWalletAccount,
} from '../types/sdk';

// The send pipeline, in the order the protocol requires:
//
//   create  -> lock the selected notes, produce an unsigned PCZT
//   prove   -> zero-knowledge proofs (must precede signing: the signer needs
//              to verify the proof covers the right data)
//   sign    -> in the keys package, the only place spending keys exist
//   finalize -> atomically store the transaction and broadcast intent
//   broadcast -> actually submit it

type IPcztCreated = {
  pcztHex: string;
  reservationId: string;
  feeZat: number;
};

const MAX_MONEY_ZAT = 2_100_000_000_000_000n;

// The runtime takes a u64: a negative BigInt wraps, a fraction throws a bare
// SyntaxError, and zero builds a fee-only transaction to a shielded address.
// Reject all of those here with the runtime's own error shape.
function toZatoshi(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw zcashParamError('AMOUNT_OUT_OF_RANGE', { valueZat: value });
  }
  const zat = BigInt(value);
  if (zat <= 0n || zat > MAX_MONEY_ZAT) {
    throw zcashParamError('AMOUNT_OUT_OF_RANGE', { valueZat: value });
  }
  return zat;
}

function zcashParamError(
  code: string,
  params: Record<string, unknown>,
): OneKeyLocalError {
  const err = new OneKeyLocalError(`zcash: ${code}`);
  Object.assign(err, { code, params });
  return err;
}

// Refuses before anything is built or locked.
//
// The failure this prevents is expensive and confusing: creating a proposal
// locks the selected notes, and only the proving step discovers the bundle
// cannot be proven. The user has by then confirmed the amount and entered
// their password, and the notes stay locked until the lock expires.
//
// The check reads the same flags the runtime enforces, so it cannot drift into
// claiming support that is not there.
async function assertCanSpend(
  what: 'spend' | 'shield',
  options?: { spendTransparent?: boolean },
): Promise<void> {
  const rt = await getRuntime();
  const keys = await getKeys();
  const prove = JSON.parse(rt.capabilities()) as {
    prove: { orchard: boolean; ironwood: boolean };
    notes: Record<string, string>;
  };
  const sign = (
    JSON.parse(keys.keysCapabilities()) as {
      sign: { orchard: boolean; ironwood: boolean; transparent: boolean };
    }
  ).sign;

  const missing: string[] = [];
  if (!prove.prove.ironwood || !sign.ironwood) missing.push('ironwood');
  if (!prove.prove.orchard || !sign.orchard) missing.push('orchard');
  if ((what === 'shield' || options?.spendTransparent) && !sign.transparent) {
    missing.push('transparent');
  }

  if (missing.length > 0) {
    const err = new OneKeyLocalError(
      `zcash: ${what} unavailable in this build (missing: ${missing.join(', ')})`,
    );
    // Same shape the runtime uses for its own failures — a stable `code` plus
    // structured `params` — so the host branches and translates instead of
    // matching on message text.
    Object.assign(err, {
      code: 'UNIMPLEMENTED',
      params: { what, missing, reasons: prove.notes },
    });
    throw err;
  }
}

export async function quotePczt(
  account: IZcashWalletAccount,
  params: {
    toAddress: string;
    valueZat: string;
    spendSource: IZcashSpendSource;
    reservationId?: string;
    spendTransparent?: boolean;
  },
): Promise<IZcashSendQuote> {
  const { rt, accountUuid } = await withWallet(account, {
    registerIfMissing: false,
  });
  // Runs the same proposal path as createPczt but stops before building the
  // transaction, so the quoted fee is the fee that will actually be paid, and
  // the reported sources are the inputs it will actually spend. It takes no
  // lock, so quoting repeatedly costs nothing.
  const quote = JSON.parse(
    rt.pcztQuote(
      accountUuid,
      params.toAddress,
      toZatoshi(params.valueZat),
      null,
      TRUSTED_CONFIRMATIONS,
      UNTRUSTED_CONFIRMATIONS,
      FALLBACK_CHANGE_POOL,
      // Must match createPczt exactly: a different input source produces a
      // different fee *and* a different privacy story, so a quote taken under
      // other settings would warn about a transaction that never happens.
      params.spendTransparent ?? false,
      ALLOW_ZERO_CONF_SHIELDING,
      params.spendSource,
    ),
  ) as {
    feeZat: number;
    sourceTransparentZat: number;
    sourceShieldedZat: number;
    linksTransparentToShielded: boolean;
    shieldedOnlyFeeZat: number | null;
  };
  return {
    feeZat: String(quote.feeZat),
    sourceTransparentZat: String(quote.sourceTransparentZat),
    sourceShieldedZat: String(quote.sourceShieldedZat),
    linksTransparentToShielded: quote.linksTransparentToShielded,
    shieldedOnlyFeeZat:
      quote.shieldedOnlyFeeZat === null
        ? null
        : String(quote.shieldedOnlyFeeZat),
  };
}

export async function createPczt(
  account: IZcashWalletAccount,
  params: {
    toAddress: string;
    valueZat: string;
    spendSource: IZcashSpendSource;
    reservationId?: string;
    spendTransparent?: boolean;
  },
): Promise<IZcashPcztReservation> {
  await assertCanSpend('spend', {
    spendTransparent: params.spendTransparent,
  });
  const { rt, accountUuid } = await withWallet(account, {
    registerIfMissing: false,
  });
  const created = JSON.parse(
    rt.pcztCreate(
      accountUuid,
      params.toAddress,
      toZatoshi(params.valueZat),
      null,
      TRUSTED_CONFIRMATIONS,
      UNTRUSTED_CONFIRMATIONS,
      FALLBACK_CHANGE_POOL,
      PAD_ORCHARD_BUNDLE,
      LOCK_FOR_BLOCKS,
      params.reservationId ?? null,
      params.spendTransparent ?? false,
      ALLOW_ZERO_CONF_SHIELDING,
      params.spendSource,
    ),
  ) as IPcztCreated;
  return { ...created, feeZat: String(created.feeZat) };
}

export async function shieldFunds(
  account: IZcashWalletAccount,
  params?: { reservationId?: string },
): Promise<IZcashPcztReservation> {
  await assertCanSpend('shield');
  const { rt, accountUuid } = await withWallet(account, {
    registerIfMissing: false,
  });
  // No recipient and no amount: it sweeps the whole transparent balance into
  // this account's own shielded address. Leaving a remainder behind would
  // defeat the point — it stays publicly visible and costs another fee later.
  const created = JSON.parse(
    rt.pcztShield(
      accountUuid,
      SHIELDING_THRESHOLD_ZAT,
      TRUSTED_CONFIRMATIONS,
      UNTRUSTED_CONFIRMATIONS,
      FALLBACK_CHANGE_POOL,
      PAD_ORCHARD_BUNDLE,
      LOCK_FOR_BLOCKS,
      params?.reservationId ?? null,
      ALLOW_ZERO_CONF_SHIELDING,
    ),
  ) as IPcztCreated;
  return { ...created, feeZat: String(created.feeZat) };
}

export async function quoteShieldFunds(
  account: IZcashWalletAccount,
): Promise<{ feeZat: string }> {
  const { rt, accountUuid } = await withWallet(account, {
    registerIfMissing: false,
  });
  const quote = JSON.parse(
    rt.pcztShieldQuote(
      accountUuid,
      SHIELDING_THRESHOLD_ZAT,
      TRUSTED_CONFIRMATIONS,
      UNTRUSTED_CONFIRMATIONS,
      FALLBACK_CHANGE_POOL,
      PAD_ORCHARD_BUNDLE,
      ALLOW_ZERO_CONF_SHIELDING,
    ),
  ) as { feeZat: number };
  return { feeZat: String(quote.feeZat) };
}

export async function provePczt(
  account: IZcashWalletAccount,
  params: { pcztHex: string },
): Promise<{ pcztHex: string }> {
  const { rt } = await withWallet(account, { registerIfMissing: false });
  const proved = rt.pcztProve(hexToBytes(params.pcztHex));
  return { pcztHex: bytesToHex(proved) };
}

export async function combinePczt(
  params: IZcashCombinePcztParams,
): Promise<{ pcztHex: string }> {
  const rt = await getRuntime();
  const combined = rt.pcztCombine(
    hexToBytes(params.originalPcztHex),
    hexToBytes(params.signedPcztHex),
  );
  return { pcztHex: bytesToHex(combined) };
}

export async function finalizePczt(
  account: IZcashWalletAccount,
  params: { pcztHex: string; reservationId: string },
): Promise<{ txid: string }> {
  const { rt, accountUuid } = await withWallet(account, {
    registerIfMissing: false,
  });

  // This RPC ends after the local write. The host must possess the txid before
  // it starts the separate irreversible broadcast RPC.
  const txid = await rt.pcztSend(
    accountUuid,
    hexToBytes(params.pcztHex),
    params.reservationId,
  );
  return { txid };
}

export async function getPendingBroadcasts(
  account: IZcashWalletAccount,
): Promise<string[]> {
  const { rt, accountUuid } = await withWallet(account, {
    registerIfMissing: false,
  });
  return JSON.parse(rt.pendingBroadcastTxids(accountUuid)) as string[];
}

export async function broadcastPczt(
  account: IZcashWalletAccount,
  params: { txid: string },
): Promise<IZcashSendResult> {
  const { rt } = await withWallet(account, { registerIfMissing: false });
  try {
    await rt.broadcastTransaction(params.txid);
    return { txid: params.txid, broadcastState: 'accepted' };
  } catch (e) {
    const runtimeError = readZcashRuntimeError(e);
    if (runtimeError?.code === 'BROADCAST_REJECTED') {
      return {
        txid: params.txid,
        broadcastState: 'rejected',
        broadcastError: runtimeError,
      };
    }
    // Once txid is known, every transport/runtime failure is an unknown
    // broadcast outcome. The locally recorded transaction stays Pending and
    // the sync loop retries it; rebuilding a new payment would be unsafe.
    return {
      txid: params.txid,
      broadcastState: 'unknown',
      broadcastError: runtimeError ?? {
        code: 'BROADCAST_OUTCOME_UNKNOWN',
        params: {},
        detail: e instanceof Error ? e.message : String(e),
      },
    };
  }
}

export async function releasePczt(
  account: IZcashWalletAccount,
  params: { reservationId: string },
): Promise<void> {
  const { rt } = await withWallet(account, { registerIfMissing: false });
  // Idempotent by design: cancel paths run more than once, and an unknown id
  // means the notes are already free.
  rt.releaseReservation(params.reservationId);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
