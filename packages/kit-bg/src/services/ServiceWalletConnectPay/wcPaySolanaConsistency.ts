import {
  ComputeBudgetProgram,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import BigNumber from 'bignumber.js';

import { parseToNativeTx } from '@onekeyhq/core/src/chains/sol/sdkSol/parse';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import {
  EWcPayErrorCode,
  WcPayError,
} from '@onekeyhq/shared/src/walletConnect/payErrors';
import type { IWcPayOption } from '@onekeyhq/shared/src/walletConnect/payTypes';

import type { TransactionInstruction } from '@solana/web3.js';

export type IWcPaySolanaSummary = {
  amountRaw: string;
  kind: 'native' | 'spl';
  // Present for spl legs only (read from the TransferChecked instruction);
  // absent for native legs, which have no mint.
  mint?: string;
  decimals?: number;
  // Always present. '0' when the blob carries no SetComputeUnitPrice ix.
  priorityFeeLamports: string;
  // True when the FEE PAYER is not the account: the Pay server sponsors the
  // network fee (base + priority), so those are not the user's costs and
  // the sheet must not present them as such.
  sponsoredFee: boolean;
  // True iff the accepted ATA rent-payment instruction is present AND the
  // ACCOUNT funds it, so the sheet can name the extra ~0.002 SOL cost —
  // a sponsor-funded ATA costs the user nothing.
  fundsRecipientAta: boolean;
};

export type IWcPaySolanaConsistencyResult =
  | { ok: true; summary: IWcPaySolanaSummary }
  | { ok: false; reason: string };

/**
 * Preflight twin of the executor's first decode of a Solana action (sol
 * Vault `_extractATADetailsFromEncodedTx` -> `parseToNativeTx`): throws for
 * exactly the bs58 blobs that would fail there, so a malformed later action
 * is refused before any earlier action in the list can broadcast. Lives in
 * this lazily imported module so @solana/web3.js stays out of the background
 * startup graph.
 */
export function assertWcPaySolanaEncodedTxParses(encodedTx: string): void {
  let parsed: unknown;
  try {
    parsed = parseToNativeTx(encodedTx);
  } catch {
    parsed = null;
  }
  if (!parsed) {
    throw new WcPayError({
      code: EWcPayErrorCode.InvalidSolanaPayload,
      message: 'Invalid Solana transaction payload',
    });
  }
}

// 0.01 SOL. This path signs the server's bytes verbatim — unlike the EVM
// validator (which the inline pipeline re-estimates fees for before
// signing, see wcPayOrderConsistency.ts's ALLOWED_TX_KEYS comment), there is
// no later re-estimation step to catch an inflated priority fee, so it must
// be bounded here.
export const WC_PAY_SOLANA_MAX_PRIORITY_FEE_LAMPORTS = 10_000_000;

// These program ids overlap `SYSTEM_PROGRAM_IDS` / `SPL_PROGRAM_IDS` in
// packages/core/src/chains/sol/constants.ts; the duplication is intentional
// — core exports them as opaque membership Sets, while this file needs each
// id individually, next to the account-layout/data-length comments that
// document how it is parsed.
const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);
// Both the legacy and current Memo program deployments — either can appear
// alongside a Pay payment instruction (e.g. an order reference note).
const MEMO_PROGRAM_IDS = new Set([
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
  'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo',
]);
const COMPUTE_BUDGET_PROGRAM_ID = ComputeBudgetProgram.programId.toBase58();
const SYSTEM_PROGRAM_ID = SystemProgram.programId.toBase58();
const ASSOCIATED_TOKEN_PROGRAM_ID_STR = ASSOCIATED_TOKEN_PROGRAM_ID.toBase58();
const TOKEN_PROGRAM_ID_STR = TOKEN_PROGRAM_ID.toBase58();
const TOKEN_2022_PROGRAM_ID_STR = TOKEN_2022_PROGRAM_ID.toBase58();

// SystemInstruction enum index for `Transfer`.
const SYSTEM_TRANSFER_INDEX = 2;
const SYSTEM_TRANSFER_KEY_COUNT = 2;
// index(u32 LE, 4 bytes) + lamports(u64 LE, 8 bytes).
const SYSTEM_TRANSFER_DATA_LEN = 12;
// SPL Token instruction discriminants (same byte layout on both the classic
// Token program and Token-2022 for these two variants).
const SPL_TRANSFER = 3;
const SPL_TRANSFER_CHECKED = 12;
const TRANSFER_CHECKED_KEY_COUNT = 4;
const TRANSFER_CHECKED_MINT_INDEX = 1;
const TRANSFER_CHECKED_DESTINATION_INDEX = 2;
const TRANSFER_CHECKED_AUTHORITY_INDEX = 3;
const TRANSFER_CHECKED_DECIMALS_OFFSET = 9;
// discriminator(1) + amount(u64 LE, 8 bytes) + decimals(1 byte).
const TRANSFER_CHECKED_DATA_LEN = 10;

// ComputeBudget instruction discriminants — see @solana/web3.js
// COMPUTE_BUDGET_INSTRUCTION_LAYOUTS (programs/compute-budget.ts).
// 0x00 (RequestUnitsDeprecated) has no named constant: it is refused by the
// same fallback branch as any other unrecognized discriminant.
const CU_REQUEST_HEAP_FRAME = 0x01;
const CU_SET_COMPUTE_UNIT_LIMIT = 0x02;
const CU_SET_COMPUTE_UNIT_PRICE = 0x03;
const CU_SET_LOADED_ACCOUNTS_DATA_SIZE_LIMIT = 0x04;
// Exact instruction data lengths (1-byte discriminator + payload) — anything
// shorter OR longer is refused, not merely "at least this many bytes".
const CU_U32_PAYLOAD_DATA_LEN = 5; // discriminator(1) + u32 LE
const CU_U64_PAYLOAD_DATA_LEN = 9; // discriminator(1) + u64 LE
// The runtime's own cap on compute units per transaction — the ceiling a
// SetComputeUnitLimit value is clamped to.
const MAX_COMPUTE_UNITS = 1_400_000;
// Runtime default when no SetComputeUnitLimit is present: 200,000 CU per
// instruction that isn't itself a ComputeBudget instruction, capped at
// MAX_COMPUTE_UNITS. NOT "the max" — a single-instruction transaction with
// no limit ix actually budgets 200,000 CU, not 1,400,000.
const DEFAULT_COMPUTE_UNITS_PER_INSTRUCTION = 200_000;
const MICRO_LAMPORTS_PER_LAMPORT = 1_000_000;

// Associated Token Account program: [funder, ata, owner, mint,
// systemProgram, tokenProgram], with an optional legacy 7th key (the Rent
// sysvar, still passed by some older clients).
const ATA_KEY_COUNT = 6;
const ATA_FUNDER_INDEX = 0;
const ATA_ADDRESS_INDEX = 1;
const ATA_MINT_INDEX = 3;
const ATA_TOKEN_PROGRAM_INDEX = 5;
const ATA_LEGACY_RENT_SYSVAR_INDEX = 6;
const ATA_LEGACY_KEY_COUNT = 7;
const ATA_CREATE = 0;
const ATA_CREATE_IDEMPOTENT = 1;
const SYSVAR_RENT_PUBKEY_STR = SYSVAR_RENT_PUBKEY.toBase58();
const ATA_REASON = 'unexpected associated token account instruction';

// A plain decimal order amount. 78 is the digit length of uint256 max —
// the same cap used by wcPayOrderConsistency.ts / wcPayMessageConsistency.ts
// for `option.amount.value`; kept identical here rather than tightened to
// Solana's u64 range so the shared order-amount field is judged by one
// format rule everywhere it is validated.
const MAX_DECIMAL_AMOUNT_CHARS = 78;
const ORDER_AMOUNT_RE = new RegExp(`^[0-9]{1,${MAX_DECIMAL_AMOUNT_CHARS}}$`);

function decodeTransaction(txBase64: string): VersionedTransaction | undefined {
  try {
    return VersionedTransaction.deserialize(Buffer.from(txBase64, 'base64'));
  } catch {
    return undefined;
  }
}

// Reads a little-endian u64 out of raw instruction data without going
// through bignumber.js's base-16 parser (kept bounded and allocation-free —
// the loop below only ever touches 8 fixed bytes).
function readU64LE(data: Uint8Array, offset: number): BigNumber | undefined {
  if (data.length < offset + 8) {
    return undefined;
  }
  let value = new BigNumber(0);
  for (let i = 7; i >= 0; i -= 1) {
    value = value.multipliedBy(256).plus(data[offset + i]);
  }
  return value;
}

type IPaymentLeg =
  | { kind: 'native'; amount: BigNumber; sender: string }
  | {
      kind: 'spl';
      amount: BigNumber;
      sender: string;
      mint: string;
      decimals: number;
      destination: string;
      programId: string;
    };

type IAtaOutcome = {
  funder: string;
  address: string;
  mint: string;
  tokenProgram: string;
};

type IInstructionOutcome =
  | { kind: 'skip' }
  | { kind: 'leg'; leg: IPaymentLeg }
  | { kind: 'computeBudgetLimit'; units: number }
  | { kind: 'computeBudgetPrice'; microLamports: BigNumber }
  // RequestHeapFrame / SetLoadedAccountsDataSizeLimit: tolerated, but still
  // subject to the same "at most one of each" rule as limit/price — the
  // discriminator is carried through so the caller can dedupe by it.
  | { kind: 'computeBudgetOther'; discriminator: number }
  | { kind: 'ata'; ata: IAtaOutcome }
  | { kind: 'error'; reason: string };

// SystemProgram.transfer only — exactly 2 keys ([from, to]); an extra key
// is a shape this validator does not understand and must not silently
// tolerate (see the "pin key counts" hardening note).
function classifySystemInstruction(
  ix: TransactionInstruction,
): IInstructionOutcome {
  const data = Buffer.from(ix.data);
  if (data.length !== SYSTEM_TRANSFER_DATA_LEN) {
    return { kind: 'error', reason: 'unsupported instruction' };
  }
  const index = data.readUInt32LE(0);
  const lamports = readU64LE(data, 4);
  if (
    index !== SYSTEM_TRANSFER_INDEX ||
    lamports === undefined ||
    ix.keys.length !== SYSTEM_TRANSFER_KEY_COUNT
  ) {
    return { kind: 'error', reason: 'unsupported instruction' };
  }
  return {
    kind: 'leg',
    leg: {
      kind: 'native',
      amount: lamports,
      sender: ix.keys[0].pubkey.toBase58(),
    },
  };
}

// TokenProgram / Token-2022 only. Plain `Transfer` carries no mint/decimals
// in its instruction data — the asset behind the raw amount cannot be tied
// to the order offline, so it is refused rather than risk approving a
// payment in the wrong token (the confirm page, which resolves the source
// account's mint through RPC, still handles this case). Only
// `TransferChecked` with exactly 4 keys yields an spl leg — multisig
// authorities and Token-2022 transfer-hook extra accounts fall back to the
// confirm page instead of being silently accepted.
function classifyTokenInstruction(
  ix: TransactionInstruction,
  programId: string,
): IInstructionOutcome {
  const data = Buffer.from(ix.data);
  const discriminator = data[0];
  if (discriminator === SPL_TRANSFER) {
    return { kind: 'error', reason: 'unverifiable mint' };
  }
  if (discriminator !== SPL_TRANSFER_CHECKED) {
    return { kind: 'error', reason: 'unsupported instruction' };
  }
  if (data.length !== TRANSFER_CHECKED_DATA_LEN) {
    return { kind: 'error', reason: 'unsupported instruction' };
  }
  const amount = readU64LE(data, 1);
  if (amount === undefined || ix.keys.length !== TRANSFER_CHECKED_KEY_COUNT) {
    return { kind: 'error', reason: 'unsupported instruction' };
  }
  return {
    kind: 'leg',
    leg: {
      kind: 'spl',
      amount,
      sender: ix.keys[TRANSFER_CHECKED_AUTHORITY_INDEX].pubkey.toBase58(),
      mint: ix.keys[TRANSFER_CHECKED_MINT_INDEX].pubkey.toBase58(),
      decimals: data[TRANSFER_CHECKED_DECIMALS_OFFSET],
      destination:
        ix.keys[TRANSFER_CHECKED_DESTINATION_INDEX].pubkey.toBase58(),
      programId,
    },
  };
}

// Every accompaniment is parsed, not merely allow-listed by program id —
// this path signs the server's bytes verbatim (no fee re-estimation),
// unlike the EVM path, so an unparsed ComputeBudget/ATA instruction could
// hide an arbitrary priority fee or rent payment beyond the order amount.
function classifyComputeBudgetInstruction(
  ix: TransactionInstruction,
): IInstructionOutcome {
  const data = Buffer.from(ix.data);
  const discriminator = data.length >= 1 ? data[0] : -1;
  if (discriminator === CU_SET_COMPUTE_UNIT_LIMIT) {
    if (data.length !== CU_U32_PAYLOAD_DATA_LEN) {
      return { kind: 'error', reason: 'unsupported instruction' };
    }
    return { kind: 'computeBudgetLimit', units: data.readUInt32LE(1) };
  }
  if (discriminator === CU_SET_COMPUTE_UNIT_PRICE) {
    if (data.length !== CU_U64_PAYLOAD_DATA_LEN) {
      return { kind: 'error', reason: 'unsupported instruction' };
    }
    const microLamports = readU64LE(data, 1);
    if (microLamports === undefined) {
      return { kind: 'error', reason: 'unsupported instruction' };
    }
    return { kind: 'computeBudgetPrice', microLamports };
  }
  if (
    discriminator === CU_REQUEST_HEAP_FRAME ||
    discriminator === CU_SET_LOADED_ACCOUNTS_DATA_SIZE_LIMIT
  ) {
    if (data.length !== CU_U32_PAYLOAD_DATA_LEN) {
      return { kind: 'error', reason: 'unsupported instruction' };
    }
    return { kind: 'computeBudgetOther', discriminator };
  }
  // RequestUnitsDeprecated (0x00, carries a direct `additional_fee` in
  // lamports outside this validator's fee accounting) and any unrecognized
  // discriminator.
  return { kind: 'error', reason: 'unsupported instruction' };
}

// Create / CreateIdempotent only, with exactly the 6-key layout (or 7 when
// the trailing key is the legacy Rent sysvar); RecoverNested and any other
// shape fall back to the confirm page. Every refusal on this program — bad
// data, bad key count, or (post-loop, in the caller) a mismatch against the
// leg or a second occurrence — reports the single ATA reason, since this
// program is never a fallback candidate: any instruction routed here is
// either exactly the accepted rent-payment shape or refused outright.
function classifyAtaInstruction(
  ix: TransactionInstruction,
): IInstructionOutcome {
  const data = Buffer.from(ix.data);
  const discriminator = data.length === 0 ? ATA_CREATE : data[0];
  if (
    data.length > 1 ||
    (discriminator !== ATA_CREATE && discriminator !== ATA_CREATE_IDEMPOTENT)
  ) {
    return { kind: 'error', reason: ATA_REASON };
  }
  const hasLegacyRentSysvar =
    ix.keys.length === ATA_LEGACY_KEY_COUNT &&
    ix.keys[ATA_LEGACY_RENT_SYSVAR_INDEX].pubkey.toBase58() ===
      SYSVAR_RENT_PUBKEY_STR;
  if (ix.keys.length !== ATA_KEY_COUNT && !hasLegacyRentSysvar) {
    return { kind: 'error', reason: ATA_REASON };
  }
  return {
    kind: 'ata',
    ata: {
      // who pays the rent — needed for cost attribution in the summary
      // (with a sponsored fee payer the funder is customarily the sponsor)
      funder: ix.keys[ATA_FUNDER_INDEX].pubkey.toBase58(),
      address: ix.keys[ATA_ADDRESS_INDEX].pubkey.toBase58(),
      mint: ix.keys[ATA_MINT_INDEX].pubkey.toBase58(),
      tokenProgram: ix.keys[ATA_TOKEN_PROGRAM_INDEX].pubkey.toBase58(),
    },
  };
}

// Classifies one decompiled instruction: an allowed accompaniment to skip
// (never counted as a payment leg), a single payment leg, a ComputeBudget /
// ATA accompaniment the caller must accumulate and bound, or an outright
// refusal reason. Kept as its own function (rather than a for-loop with
// `continue`) so every instruction has exactly one exit path.
function classifyInstruction(ix: TransactionInstruction): IInstructionOutcome {
  const programId = ix.programId.toBase58();
  if (MEMO_PROGRAM_IDS.has(programId)) {
    return { kind: 'skip' };
  }
  if (programId === COMPUTE_BUDGET_PROGRAM_ID) {
    return classifyComputeBudgetInstruction(ix);
  }
  if (programId === ASSOCIATED_TOKEN_PROGRAM_ID_STR) {
    return classifyAtaInstruction(ix);
  }
  if (programId === SYSTEM_PROGRAM_ID) {
    return classifySystemInstruction(ix);
  }
  if (
    programId === TOKEN_PROGRAM_ID_STR ||
    programId === TOKEN_2022_PROGRAM_ID_STR
  ) {
    return classifyTokenInstruction(ix, programId);
  }
  return { kind: 'error', reason: 'unsupported instruction' };
}

/**
 * Proves a server-supplied `solana_signTransaction` blob structurally
 * matches the order the user approved: same chain, the option account among
 * the REQUIRED SIGNERS (the fee payer may be the Pay server's sponsoring
 * co-signer — see the signer check below), and exactly one payment
 * instruction (native SOL transfer or SPL `TransferChecked`) for the order
 * amount and asset from that same account. A plain SPL `Transfer` is
 * refused (see `classifyTokenInstruction`) — it carries no mint, so the
 * asset it moves cannot be verified offline.
 *
 * Fee/rent boundary: because this path signs the server's bytes verbatim
 * (no later fee re-estimation, unlike the EVM path), every accompanying
 * instruction is parsed rather than merely allow-listed by program id. This
 * validator bounds: the payment amount, the priority fee (capped at
 * `WC_PAY_SOLANA_MAX_PRIORITY_FEE_LAMPORTS`), and at most one Associated
 * Token Account rent payment for the payment leg's own recipient. It does
 * NOT bound the base signature fee (5 000 lamports/signature), which the
 * caller must budget for separately.
 *
 * Asset identity: this validator only proves the instruction *kind* (native
 * vs spl) and, for spl, that the mint's on-chain `decimals` agree with what
 * the option displays — it does NOT resolve the mint address to a symbol.
 * The caller must still confirm `summary.mint`'s symbol against the option
 * through the wallet's own token registry (the same boundary
 * `checkWcPayTypedDataMatchesOrder`'s `resolvedToken` draws for EVM), since
 * a hostile mint address can claim any decimals.
 *
 * Any uncertainty returns ok:false; the caller falls back to the full
 * confirm UI, never refuses the payment outright. Must never throw on
 * hostile input — `txBase64` crosses a trust boundary (server response).
 */
export function checkWcPaySolanaTxMatchesOrder({
  txBase64,
  caip2ChainId,
  option,
}: {
  txBase64: string;
  // The option's CAIP-2 chain, e.g. "solana:<genesis-hash-reference>".
  caip2ChainId: string;
  option: IWcPayOption;
}): IWcPaySolanaConsistencyResult {
  const accountParts =
    typeof option?.account === 'string' ? option.account.split(':') : [];
  if (accountParts.length !== 3 || accountParts.some((part) => !part)) {
    return { ok: false, reason: 'invalid option account shape' };
  }
  const [namespace, chainReference, optionAddress] = accountParts;
  if (namespace !== 'solana' || caip2ChainId !== `solana:${chainReference}`) {
    return { ok: false, reason: 'chain mismatch' };
  }
  if (
    typeof option.amount?.value !== 'string' ||
    !ORDER_AMOUNT_RE.test(option.amount.value)
  ) {
    return { ok: false, reason: 'invalid order amount format' };
  }
  const orderAmount = new BigNumber(option.amount.value);
  if (!orderAmount.isFinite() || orderAmount.isLessThanOrEqualTo(0)) {
    return { ok: false, reason: 'invalid order amount format' };
  }

  const tx = decodeTransaction(txBase64);
  if (!tx) {
    return { ok: false, reason: 'undecodable transaction' };
  }
  const { message } = tx;
  if (message.addressTableLookups.length > 0) {
    // Keys resolved through a lookup table cannot be identified offline —
    // e.g. the actual payment recipient could be swapped without any
    // visible change to the static account keys below.
    return { ok: false, reason: 'address lookup tables' };
  }
  // The account must be a REQUIRED SIGNER — that signature is what the
  // wallet is being asked to produce, and a message the account need not
  // sign is not this account's payment. The FEE PAYER, however, may be
  // someone else: the Pay server customarily sponsors the network fee (fee
  // payer = its own co-signing account, observed live 2026-08-31), and the
  // user's signature then authorizes nothing beyond the validated
  // instructions below. Cost attribution follows: a sponsored fee is not
  // the user's cost, and the summary must say so rather than warn about a
  // priority fee somebody else pays.
  const feePayer = message.staticAccountKeys[0]?.toBase58();
  const numRequiredSignatures = message.header?.numRequiredSignatures ?? 0;
  const requiredSigners = message.staticAccountKeys
    .slice(0, numRequiredSignatures)
    .map((key) => key.toBase58());
  if (!requiredSigners.includes(optionAddress)) {
    return { ok: false, reason: 'account is not a signer' };
  }
  const isSponsoredFee = feePayer !== optionAddress;

  let instructions: TransactionInstruction[];
  try {
    instructions = TransactionMessage.decompile(message).instructions;
  } catch {
    return { ok: false, reason: 'undecodable transaction' };
  }

  const legs: IPaymentLeg[] = [];
  let computeUnitLimit: number | undefined;
  let priceMicroLamports: BigNumber | undefined;
  // "At most one of each" applies to all four ComputeBudget variants, not
  // just limit/price — RequestHeapFrame and SetLoadedAccountsDataSizeLimit
  // carry no value this validator needs, so their duplicate check lives in
  // this shared discriminator set rather than a value-holding variable.
  const seenComputeBudgetDiscriminators = new Set<number>();
  let ata: IAtaOutcome | undefined;
  // Every instruction that is NOT itself a ComputeBudget instruction —
  // counted for the runtime's own unset-limit default (see effectiveLimit
  // below). Legs, memos, and the ATA instruction all count.
  let nonComputeBudgetInstructionCount = 0;
  for (const ix of instructions) {
    const outcome = classifyInstruction(ix);
    switch (outcome.kind) {
      case 'error':
        return { ok: false, reason: outcome.reason };
      case 'leg':
        legs.push(outcome.leg);
        nonComputeBudgetInstructionCount += 1;
        break;
      case 'skip':
        nonComputeBudgetInstructionCount += 1;
        break;
      case 'ata':
        if (ata !== undefined) {
          return { ok: false, reason: ATA_REASON };
        }
        ata = outcome.ata;
        nonComputeBudgetInstructionCount += 1;
        break;
      case 'computeBudgetLimit':
        // The runtime itself rejects a duplicate SetComputeUnitLimit — a
        // second one here is already a shape the real runtime never
        // produces.
        if (seenComputeBudgetDiscriminators.has(CU_SET_COMPUTE_UNIT_LIMIT)) {
          return { ok: false, reason: 'unsupported instruction' };
        }
        seenComputeBudgetDiscriminators.add(CU_SET_COMPUTE_UNIT_LIMIT);
        computeUnitLimit = outcome.units;
        break;
      case 'computeBudgetPrice':
        if (seenComputeBudgetDiscriminators.has(CU_SET_COMPUTE_UNIT_PRICE)) {
          return { ok: false, reason: 'unsupported instruction' };
        }
        seenComputeBudgetDiscriminators.add(CU_SET_COMPUTE_UNIT_PRICE);
        priceMicroLamports = outcome.microLamports;
        break;
      case 'computeBudgetOther':
        if (seenComputeBudgetDiscriminators.has(outcome.discriminator)) {
          return { ok: false, reason: 'unsupported instruction' };
        }
        seenComputeBudgetDiscriminators.add(outcome.discriminator);
        break;
      default: {
        // Exhaustiveness guard: a future IInstructionOutcome variant that
        // isn't handled by one of the cases above fails to compile here
        // (the `never` assignment) rather than being silently tolerated —
        // e.g. dropped from the fee/rent accounting — at runtime.
        const exhaustiveCheck: never = outcome;
        throw new OneKeyInternalError(
          `Unhandled wc pay solana instruction outcome: ${String(
            exhaustiveCheck,
          )}`,
        );
      }
    }
  }

  // effectiveLimit: the explicit limit clamped to the runtime ceiling, or,
  // when no limit ix is present, the runtime's own default — 200,000 CU per
  // non-ComputeBudget instruction, capped at the ceiling. NOT the ceiling
  // itself: a single-instruction transaction with no limit ix actually
  // budgets 200,000 CU, not 1,400,000.
  const effectiveLimit =
    computeUnitLimit === undefined
      ? Math.min(
          DEFAULT_COMPUTE_UNITS_PER_INSTRUCTION *
            nonComputeBudgetInstructionCount,
          MAX_COMPUTE_UNITS,
        )
      : Math.min(computeUnitLimit, MAX_COMPUTE_UNITS);
  const priorityFeeLamports = priceMicroLamports
    ? priceMicroLamports
        .multipliedBy(effectiveLimit)
        .dividedBy(MICRO_LAMPORTS_PER_LAMPORT)
        .integerValue(BigNumber.ROUND_CEIL)
    : new BigNumber(0);
  if (
    priorityFeeLamports.isGreaterThan(WC_PAY_SOLANA_MAX_PRIORITY_FEE_LAMPORTS)
  ) {
    return { ok: false, reason: 'priority fee too high' };
  }

  if (legs.length === 0) {
    return { ok: false, reason: 'no payment instruction' };
  }
  if (legs.length > 1) {
    return { ok: false, reason: 'unexpected instruction count' };
  }
  const [leg] = legs;
  if (leg.sender !== optionAddress) {
    return { ok: false, reason: 'sender mismatch' };
  }

  const displaySymbol = option.amount.display?.assetSymbol;
  const displayDecimals = option.amount.display?.decimals;
  if (leg.kind === 'native') {
    // SOL's decimals are a network constant (9), not something the leg
    // itself carries — assert it against what the option displays rather
    // than trusting the option blindly.
    const NATIVE_SOL_DECIMALS = 9;
    if (displaySymbol !== 'SOL' || displayDecimals !== NATIVE_SOL_DECIMALS) {
      return { ok: false, reason: 'asset mismatch' };
    }
  } else {
    // An spl leg paying out as 'SOL' would silently swap the asset the user
    // approved on screen.
    if (displaySymbol === 'SOL') {
      return { ok: false, reason: 'asset mismatch' };
    }
    if (leg.decimals !== displayDecimals) {
      return { ok: false, reason: 'decimals mismatch' };
    }
  }

  if (ata) {
    // The one accepted cost beyond the amount and the bounded priority fee
    // is funding the payment recipient's own ATA rent (~0.002 SOL) — never
    // an unrelated account.
    if (
      leg.kind !== 'spl' ||
      ata.address !== leg.destination ||
      ata.mint !== leg.mint ||
      ata.tokenProgram !== leg.programId
    ) {
      return { ok: false, reason: ATA_REASON };
    }
  }

  if (!leg.amount.isEqualTo(orderAmount)) {
    return { ok: false, reason: 'amount mismatch' };
  }
  return {
    ok: true,
    summary: {
      amountRaw: leg.amount.toFixed(),
      kind: leg.kind,
      ...(leg.kind === 'spl' ? { mint: leg.mint, decimals: leg.decimals } : {}),
      priorityFeeLamports: priorityFeeLamports.toFixed(),
      // costs are attributed to whoever actually pays them: the fee payer
      // for the network fee, the ATA funder for the rent
      sponsoredFee: isSponsoredFee,
      fundsRecipientAta: ata !== undefined && ata.funder === optionAddress,
    },
  };
}

/**
 * True when the signed transaction carries exactly the message bytes of the
 * unsigned request the user approved — i.e. nothing (a fee instruction, the
 * blockhash, an account key) was mutated anywhere on the path from request
 * to signature. Only signatures are allowed to differ. This is the belt to
 * `checkWcPaySolanaTxMatchesOrder`'s suspenders: that function proves the
 * unsigned blob matches the order; this proves signing didn't silently
 * change what got signed.
 */
export function isWcPaySolanaMessageUnchanged(
  unsignedBase64: string,
  signedBase64: string,
): boolean {
  const unsigned = decodeTransaction(unsignedBase64);
  const signed = decodeTransaction(signedBase64);
  if (!unsigned || !signed) {
    return false;
  }
  try {
    return Buffer.from(unsigned.message.serialize()).equals(
      Buffer.from(signed.message.serialize()),
    );
  } catch {
    return false;
  }
}
