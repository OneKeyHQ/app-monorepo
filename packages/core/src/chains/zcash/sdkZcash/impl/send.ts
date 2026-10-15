import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { validateZcashMemoHex } from '@onekeyhq/shared/src/utils/zcashMemo';

import {
  getKeys,
  getRuntime,
  getRuntimeWasm,
  noteNetworkOutcome,
  withWallet,
} from './carrier';
import { zcashHexToBytes } from './hex';
import {
  ALLOW_ZERO_CONF_SHIELDING,
  FALLBACK_CHANGE_POOL,
  LOCK_FOR_BLOCKS,
  PAD_ORCHARD_BUNDLE,
  TRUSTED_CONFIRMATIONS,
  UNTRUSTED_CONFIRMATIONS,
} from './policy';

import type {
  IZcashCombinePcztParams,
  IZcashNetwork,
  IZcashPcztReservation,
  IZcashSendQuote,
  IZcashSendResult,
  IZcashSpendSource,
  IZcashWalletAccount,
} from '../types/sdk';

export async function prewarmPczt(params: {
  network: IZcashNetwork;
  targetHeight: number;
}): Promise<void> {
  const rt = await getRuntimeWasm();
  rt.prewarmPczt(params.network, params.targetHeight);
}

// Required order: create (locks notes) -> prove -> sign (only place spend
// keys exist) -> finalize -> broadcast.
type IPcztCreated = {
  pcztHex: string;
  reservationId: string;
  feeZat: number;
};

const MAX_MONEY_ZAT = 2_100_000_000_000_000n;

// Runtime takes a u64: negative wraps, a fraction throws a bare error, and
// zero silently builds a fee-only tx. Rejected here with the runtime's own error shape.
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

// Checked before notes lock: discovering unprovable only at the proving step
// would leave them locked until expiry with nothing to show the user.
async function assertCanSpend(): Promise<void> {
  const rt = await getRuntime();
  const keys = await getKeys();
  const prove = JSON.parse(rt.capabilities()) as {
    prove: { orchard: boolean; ironwood: boolean };
    notes: Record<string, string>;
  };
  const sign = (
    JSON.parse(keys.keysCapabilities()) as {
      sign: { orchard: boolean; ironwood: boolean };
    }
  ).sign;

  const missing: string[] = [];
  if (!prove.prove.ironwood || !sign.ironwood) missing.push('ironwood');
  if (!prove.prove.orchard || !sign.orchard) missing.push('orchard');

  if (missing.length > 0) {
    const err = new OneKeyLocalError(
      `zcash: spend unavailable in this build (missing: ${missing.join(', ')})`,
    );
    // Same {code, params} shape as the runtime's own failures, so the host
    // branches on code, not message text.
    Object.assign(err, {
      code: 'UNIMPLEMENTED',
      params: { what: 'spend', missing, reasons: prove.notes },
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
    memoHex?: string;
    reservationId?: string;
  },
): Promise<IZcashSendQuote> {
  const { rt, accountUuid } = await withWallet(account);
  // Same proposal path as createPczt but stops before building, so the
  // quoted fee is the fee actually paid; takes no lock, so repeat quoting is free.
  const quote = JSON.parse(
    rt.pcztQuote(
      accountUuid,
      params.toAddress,
      toZatoshi(params.valueZat),
      null,
      TRUSTED_CONFIRMATIONS,
      UNTRUSTED_CONFIRMATIONS,
      FALLBACK_CHANGE_POOL,
      // Must match createPczt's params exactly, or the quoted fee won't be
      // the one paid (padding changes bundle size and so the ZIP-317 fee).
      PAD_ORCHARD_BUNDLE,
      ALLOW_ZERO_CONF_SHIELDING,
      params.spendSource,
      validateZcashMemoHex(params.memoHex) ?? null,
    ),
  ) as { feeZat: number };
  return { feeZat: String(quote.feeZat) };
}

export async function createPczt(
  account: IZcashWalletAccount,
  params: {
    toAddress: string;
    valueZat: string;
    spendSource: IZcashSpendSource;
    memoHex?: string;
    reservationId?: string;
  },
): Promise<IZcashPcztReservation> {
  await assertCanSpend();
  const { rt, accountUuid } = await withWallet(account);
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
      ALLOW_ZERO_CONF_SHIELDING,
      params.spendSource,
      validateZcashMemoHex(params.memoHex) ?? null,
    ),
  ) as IPcztCreated;
  return { ...created, feeZat: String(created.feeZat) };
}

export async function provePczt(
  account: IZcashWalletAccount,
  params: { pcztHex: string },
): Promise<{ pcztHex: string }> {
  const { rt } = await withWallet(account);
  const proved = rt.pcztProve(zcashHexToBytes(params.pcztHex));
  return { pcztHex: bytesToHex(proved) };
}

export async function combinePczt(
  params: IZcashCombinePcztParams,
): Promise<{ pcztHex: string }> {
  const rt = await getRuntime();
  const combined = rt.pcztCombine(
    zcashHexToBytes(params.originalPcztHex),
    zcashHexToBytes(params.signedPcztHex),
  );
  return { pcztHex: bytesToHex(combined) };
}

// Runtime records the tx before broadcasting; an explicit rejection keeps
// its notes locked until expiry, while unknown outcomes get rebroadcast by the sync loop.
export async function submitPczt(
  account: IZcashWalletAccount,
  params: { pcztHex: string; reservationId: string },
): Promise<IZcashSendResult> {
  const { rt, accountUuid } = await withWallet(account);
  const outcome = JSON.parse(
    await rt.pcztSubmit(
      accountUuid,
      zcashHexToBytes(params.pcztHex),
      params.reservationId,
    ),
  ) as {
    txid: string;
    broadcast: IZcashSendResult['broadcastState'];
    error?: { code: string; params: Record<string, unknown>; detail?: string };
  };
  noteNetworkOutcome(outcome.broadcast === 'unknown' ? outcome.error : null);
  return {
    txid: outcome.txid,
    broadcastState: outcome.broadcast,
    broadcastError: outcome.error
      ? { ...outcome.error, detail: outcome.error.detail ?? undefined }
      : undefined,
  };
}

export async function getPendingBroadcasts(
  account: IZcashWalletAccount,
): Promise<string[]> {
  const { rt, accountUuid } = await withWallet(account);
  return JSON.parse(rt.pendingBroadcastTxids(accountUuid)) as string[];
}

export async function releasePczt(
  account: IZcashWalletAccount,
  params: { reservationId: string },
): Promise<void> {
  const { rt } = await withWallet(account);
  // Idempotent: cancel paths may run more than once; an unknown id just
  // means the notes are already free.
  rt.releaseReservation(params.reservationId);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
