import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import BigNumber from 'bignumber.js';

import type { IWcPayOption } from '@onekeyhq/shared/src/walletConnect/payTypes';

import type { TransactionInstruction } from '@solana/web3.js';

export type IWcPaySolanaSummary = {
  amountRaw: string;
  kind: 'native' | 'spl';
  // Present for spl legs only (read from the TransferChecked instruction);
  // absent for native legs, which have no mint.
  mint?: string;
  decimals?: number;
};

export type IWcPaySolanaConsistencyResult =
  | { ok: true; summary: IWcPaySolanaSummary }
  | { ok: false; reason: string };

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
// SPL Token instruction discriminants (same byte layout on both the classic
// Token program and Token-2022 for these two variants).
const SPL_TRANSFER = 3;
const SPL_TRANSFER_CHECKED = 12;

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

type IPaymentLeg = {
  kind: 'native' | 'spl';
  amount: BigNumber;
  sender: string;
  mint?: string;
  decimals?: number;
};

type IInstructionOutcome =
  | { kind: 'skip' }
  | { kind: 'leg'; leg: IPaymentLeg }
  | { kind: 'error'; reason: string };

// Classifies one decompiled instruction: an allowed accompaniment to skip
// (never counted as a payment leg), a single payment leg, or an outright
// refusal reason. Kept as its own function (rather than a for-loop with
// `continue`) so every instruction has exactly one exit path.
function classifyInstruction(ix: TransactionInstruction): IInstructionOutcome {
  const programId = ix.programId.toBase58();
  if (
    programId === COMPUTE_BUDGET_PROGRAM_ID ||
    MEMO_PROGRAM_IDS.has(programId) ||
    programId === ASSOCIATED_TOKEN_PROGRAM_ID_STR
  ) {
    return { kind: 'skip' };
  }
  if (programId === SYSTEM_PROGRAM_ID) {
    const data = Buffer.from(ix.data);
    const index = data.length >= 4 ? data.readUInt32LE(0) : -1;
    const lamports = readU64LE(data, 4);
    if (index !== SYSTEM_TRANSFER_INDEX || !lamports || ix.keys.length < 2) {
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
  if (
    programId === TOKEN_PROGRAM_ID_STR ||
    programId === TOKEN_2022_PROGRAM_ID_STR
  ) {
    const data = Buffer.from(ix.data);
    const kind = data[0];
    if (kind === SPL_TRANSFER) {
      // Plain `Transfer` carries no mint/decimals in its instruction data —
      // the asset behind the raw amount cannot be tied to the order offline,
      // so it is refused here rather than risk approving a payment in the
      // wrong token. The confirm page (which resolves the source account's
      // mint through RPC) still handles this case.
      return { kind: 'error', reason: 'unverifiable mint' };
    }
    if (kind !== SPL_TRANSFER_CHECKED) {
      return { kind: 'error', reason: 'unsupported instruction' };
    }
    const amount = readU64LE(data, 1);
    // transferChecked keys: [source, mint, destination, authority]; data:
    // [discriminator(1), amount(8), decimals(1)] — the decimals byte must
    // be present before it is read.
    const AUTHORITY_INDEX = 3;
    const MINT_INDEX = 1;
    const DECIMALS_OFFSET = 9;
    if (
      !amount ||
      data.length <= DECIMALS_OFFSET ||
      ix.keys.length <= AUTHORITY_INDEX
    ) {
      return { kind: 'error', reason: 'unsupported instruction' };
    }
    return {
      kind: 'leg',
      leg: {
        kind: 'spl',
        amount,
        sender: ix.keys[AUTHORITY_INDEX].pubkey.toBase58(),
        mint: ix.keys[MINT_INDEX].pubkey.toBase58(),
        decimals: data[DECIMALS_OFFSET],
      },
    };
  }
  return { kind: 'error', reason: 'unsupported instruction' };
}

/**
 * Proves a server-supplied `solana_signTransaction` blob structurally
 * matches the order the user approved: same chain, same fee payer as the
 * option account, and exactly one payment instruction (native SOL transfer
 * or SPL `TransferChecked`) for the order amount and asset from that same
 * account. A plain SPL `Transfer` is refused (see `classifyInstruction`) —
 * it carries no mint, so the asset it moves cannot be verified offline.
 * ComputeBudget, Memo, and Associated-Token-Account program instructions are
 * tolerated alongside the payment leg since the inline pipeline never
 * injects fee instructions of its own for this path (the sol vault only
 * adds a ComputeBudget priority-fee ix when `feeInfoEditable`, which this
 * headless path never sets — see Vault.ts) but the server or a wallet
 * default might still carry one.
 *
 * Asset identity: this validator only proves the instruction *kind* (native
 * vs spl) and, for spl, the mint's on-chain `decimals` agree with what the
 * option displays — it does NOT resolve the mint address to a symbol. The
 * caller must still confirm `summary.mint`'s symbol against the option
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
  const feePayer = message.staticAccountKeys[0]?.toBase58();
  if (feePayer !== optionAddress) {
    return { ok: false, reason: 'fee payer mismatch' };
  }

  let instructions;
  try {
    instructions = TransactionMessage.decompile(message).instructions;
  } catch {
    return { ok: false, reason: 'undecodable transaction' };
  }

  const legs: IPaymentLeg[] = [];
  for (const ix of instructions) {
    const outcome = classifyInstruction(ix);
    if (outcome.kind === 'error') {
      return { ok: false, reason: outcome.reason };
    }
    if (outcome.kind === 'leg') {
      legs.push(outcome.leg);
    }
  }

  if (legs.length !== 1) {
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

  if (!leg.amount.isEqualTo(orderAmount)) {
    return { ok: false, reason: 'amount mismatch' };
  }
  return {
    ok: true,
    summary: {
      amountRaw: leg.amount.toFixed(),
      kind: leg.kind,
      ...(leg.kind === 'spl' ? { mint: leg.mint, decimals: leg.decimals } : {}),
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
