import BigNumber from 'bignumber.js';

import type {
  IWcPayAction,
  IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';
import { EWcPayActionMethod } from '@onekeyhq/shared/src/walletConnect/payTypes';

import { EErc20MethodSelectors } from '../../vaults/impls/evm/decoder/abi';

import { WC_PAY_PERMIT2_ADDRESS } from './wcPayMessageConsistency';

// ERC20 transfer(address,uint256): 4-byte selector + two 32-byte words
const ERC20_TRANSFER_DATA_LENGTH = 2 + 8 + 64 + 64; // '0x' + selector + 2 words
// ERC20 approve(address,uint256): same '0x' + selector + 2 words layout
const ERC20_APPROVE_DATA_LENGTH = 2 + 8 + 64 + 64;

// A raw hex word is at most 64 hex chars (32 bytes); 78 is the digit length
// of uint256 max (2^256 - 1). This is a digit-length cap, not full
// uint256-max enforcement: a value like '9'.repeat(78) passes this format
// check but can never equal a real order amount, so it is rejected
// fail-closed at the equality comparison further down instead of here.
const MAX_HEX_AMOUNT_CHARS = 64;
const MAX_DECIMAL_AMOUNT_CHARS = 78;
// Prefix must be a strictly lowercase '0x' (mirrors ethers.BigNumber.from,
// which throws on '0X...'); hex digits themselves may be either case.
const HEX_AMOUNT_RE = new RegExp(`^0x[0-9a-fA-F]{1,${MAX_HEX_AMOUNT_CHARS}}$`);
const DECIMAL_AMOUNT_RE = new RegExp(`^[0-9]{1,${MAX_DECIMAL_AMOUNT_CHARS}}$`);
const EVM_ADDRESS_RE = /^0x[0-9a-f]{40}$/i;

// Only fields the inline send pipeline knows how to carry through unchanged.
// Fee fields are tolerated because the inline pipeline re-estimates fees and
// overwrites them before signing (useFeeInTx:false semantics) — their value
// here is never trusted. `nonce` is deliberately NOT in this list: it gets
// its own two-stage check below (see `expectedNonce`) rather than a plain
// whitelist pass, since whether it's legitimate depends on which stage of
// the pipeline is calling.
const ALLOWED_TX_KEYS = new Set([
  'from',
  'to',
  'value',
  'data',
  'gas',
  'gasLimit',
  'gasPrice',
  'maxFeePerGas',
  'maxPriorityFeePerGas',
  'type',
  'chainId',
]);

export type IWcPayOrderConsistencyResult =
  | { ok: true; kind: 'native' | 'erc20' | 'approve' }
  | { ok: false; reason: string };

/**
 * Strictly validates an amount string BEFORE any BigNumber construction.
 * bignumber.js base-16 parsing is O(n^2) with no length cap of its own — a
 * ~100KB hex string smuggled into a server JSON response can freeze the
 * runtime for tens of seconds (mirrors the size-cap precedent in
 * `solPayUtils.ts` for bs58 encoding). Only a strictly-lowercase-prefixed
 * `0x` hex string (<=64 hex chars, digits either case) or a plain decimal
 * string (<=78 digits) is accepted; anything else — scientific notation,
 * signs, whitespace, an uppercase `0X` prefix, oversized input — is
 * rejected before it ever reaches `BigNumber`.
 */
function isStrictAmountString(value: string): boolean {
  return HEX_AMOUNT_RE.test(value) || DECIMAL_AMOUNT_RE.test(value);
}

function toAmountBN(value: string | undefined): BigNumber | undefined {
  if (value === undefined) {
    return new BigNumber(0);
  }
  if (!isStrictAmountString(value)) {
    return undefined;
  }
  if (value.startsWith('0x')) {
    return new BigNumber(value.slice(2), 16);
  }
  return new BigNumber(value);
}

/**
 * Whether calldata carries no call at all, i.e. the tx is a plain native
 * transfer. Exported because the inline send pipeline splits its balance check
 * on the same native/ERC20 boundary this validator uses: two copies of the
 * predicate could drift and have the pipeline check the wrong asset class
 * against the amount this file validated.
 */
export function isWcPayEmptyCalldata(data: string | undefined): boolean {
  if (!data) {
    return true;
  }
  const normalized = data.toLowerCase();
  return normalized === '0x' || normalized === '0x0';
}

/**
 * Proves an already-parsed eth_sendTransaction tx object structurally
 * matches the order the user approved on screen: sender, amount, an exact
 * plain-transfer shape, and (for ERC20) a canonical recipient word. The
 * option carries no token contract or recipient (see payTypes.ts), so those
 * remain server-trusted — identical to the confirm-page path. Any
 * uncertainty returns ok:false; the caller falls back to the full confirm
 * UI, never refuses the payment outright.
 *
 * Exported separately from `checkWcPayEvmActionMatchesOrder` because the
 * send pipeline re-runs this exact tx-level check on the FINAL encodedTx
 * immediately before signing — sharing the function means the validated
 * object and the signed object can never drift apart.
 */
export function checkWcPayEvmTxMatchesOrder({
  tx,
  caip2ChainId,
  option,
  expectedNonce,
}: {
  tx: Record<string, unknown>;
  // The option's CAIP-2 chain (e.g. "eip155:8453") — NEVER `encodedTx.chainId`,
  // which the evm vault rewrites to a hex chain id before signing
  // (Vault.ts:1169) and would permanently mismatch here.
  caip2ChainId: string;
  option: IWcPayOption;
  // Undefined at the pre-flight stage: any `nonce` own-key on `tx` is
  // rejected outright — a server-supplied action must never carry one. A
  // number at the final-recheck stage (the evm vault writes `nonce` into
  // encodedTx via `_attachNonceInfoToEncodedTx`): `tx.nonce` must equal it
  // exactly, asserting the nonce was decided by the send pipeline, not the
  // server — the property the field whitelist alone can no longer prove
  // once `nonce` is a legitimate encodedTx field.
  expectedNonce?: number;
}): IWcPayOrderConsistencyResult {
  if (typeof option?.account !== 'string') {
    return { ok: false, reason: 'invalid option account' };
  }
  if (typeof option?.amount?.value !== 'string') {
    return { ok: false, reason: 'invalid option amount' };
  }

  const accountParts = option.account.split(':');
  if (
    accountParts.length !== 3 ||
    accountParts.some((part) => part.length === 0)
  ) {
    return { ok: false, reason: 'invalid option account shape' };
  }
  const [namespace, reference, optionAddress] = accountParts;
  const optionChainId = `${namespace}:${reference}`;
  if (caip2ChainId !== optionChainId) {
    return { ok: false, reason: 'chain mismatch' };
  }

  const from = typeof tx.from === 'string' ? tx.from : undefined;
  if (!from || from.toLowerCase() !== optionAddress.toLowerCase()) {
    return { ok: false, reason: 'sender mismatch' };
  }

  // `nonce` is checked separately below (its acceptance depends on
  // `expectedNonce`), so it is exempt from the plain whitelist lookup here.
  const unsupportedKey = Object.keys(tx).find(
    (key) => key !== 'nonce' && !ALLOWED_TX_KEYS.has(key),
  );
  if (unsupportedKey) {
    return { ok: false, reason: `unsupported tx field: ${unsupportedKey}` };
  }

  if (expectedNonce === undefined) {
    if ('nonce' in tx) {
      return { ok: false, reason: 'unsupported tx field: nonce' };
    }
  } else if (typeof tx.nonce !== 'number' || tx.nonce !== expectedNonce) {
    return { ok: false, reason: 'nonce mismatch' };
  }

  const to = typeof tx.to === 'string' ? tx.to : undefined;
  // Missing `to` means contract-deployment semantics (packTransaction zeroes
  // the value in that case) — never a plain transfer, so it must reject.
  if (!to || !EVM_ADDRESS_RE.test(to)) {
    return { ok: false, reason: 'invalid or missing to' };
  }

  // `data`/`value` must be either absent or a string; any other type (e.g. a
  // JSON number) is a shape this validator doesn't understand and must not
  // silently coerce away — that could hide a real value/calldata mismatch.
  if (tx.data !== undefined && typeof tx.data !== 'string') {
    return { ok: false, reason: 'invalid data type' };
  }
  if (tx.value !== undefined && typeof tx.value !== 'string') {
    return { ok: false, reason: 'invalid value type' };
  }
  const data = typeof tx.data === 'string' ? tx.data : undefined;
  const value = typeof tx.value === 'string' ? tx.value : undefined;

  // option.amount.value is always decimal (never hex) — see IWcPayAmount.
  if (!DECIMAL_AMOUNT_RE.test(option.amount.value)) {
    return { ok: false, reason: 'invalid order amount format' };
  }
  const orderAmount = new BigNumber(option.amount.value);
  if (!orderAmount.isFinite() || orderAmount.isLessThanOrEqualTo(0)) {
    return { ok: false, reason: 'invalid order amount' };
  }

  const valueAmount = toAmountBN(value);
  if (!valueAmount) {
    return { ok: false, reason: 'invalid value format' };
  }

  if (isWcPayEmptyCalldata(data)) {
    if (!valueAmount.isEqualTo(orderAmount)) {
      return { ok: false, reason: 'native amount mismatch' };
    }
    return { ok: true, kind: 'native' };
  }

  const normalizedData = data?.toLowerCase() ?? '';
  if (
    normalizedData.startsWith(EErc20MethodSelectors.tokenTransfer) &&
    normalizedData.length === ERC20_TRANSFER_DATA_LENGTH
  ) {
    if (!valueAmount.isZero()) {
      return { ok: false, reason: 'erc20 transfer carries native value' };
    }
    // transfer(address,uint256): the first word is the recipient, left-padded
    // to 32 bytes — the high 12 bytes MUST be zero for a canonical encoding.
    const recipientWord = normalizedData.slice(10, 10 + 64);
    const recipientHighBytes = recipientWord.slice(0, 24);
    if (!/^0+$/.test(recipientHighBytes)) {
      return { ok: false, reason: 'non-canonical recipient word' };
    }
    const amountWord = normalizedData.slice(10 + 64);
    if (!new BigNumber(amountWord, 16).isEqualTo(orderAmount)) {
      return { ok: false, reason: 'erc20 amount mismatch' };
    }
    return { ok: true, kind: 'erc20' };
  }

  // The Permit2 approve leg of the two-action flow (Phase 3, §5). The
  // calldata `to` (token contract) is proven by the CALLER through the
  // wallet registry — this pure layer has no registry — so what is pinned
  // here is the spender and the amount floor.
  if (
    normalizedData.startsWith(EErc20MethodSelectors.tokenApprove) &&
    normalizedData.length === ERC20_APPROVE_DATA_LENGTH
  ) {
    if (!valueAmount.isZero()) {
      return { ok: false, reason: 'approve carries native value' };
    }
    const spenderWord = normalizedData.slice(10, 10 + 64);
    if (!/^0+$/.test(spenderWord.slice(0, 24))) {
      return { ok: false, reason: 'non-canonical spender word' };
    }
    if (`0x${spenderWord.slice(24)}` !== WC_PAY_PERMIT2_ADDRESS.toLowerCase()) {
      return { ok: false, reason: 'approve spender is not Permit2' };
    }
    const approveAmount = new BigNumber(normalizedData.slice(10 + 64), 16);
    // Fail-closed on an unparseable word FIRST: this comparison is written
    // in the ACCEPTING direction (unlike the transfer branch's isEqualTo),
    // so a NaN from non-hex calldata would sail through isLessThan === false
    // and approve calldata the validator never understood.
    if (!approveAmount.isFinite()) {
      return { ok: false, reason: 'invalid approve amount word' };
    }
    // Lenient by recorded product decision (2026-08-31): the customary
    // unlimited approve (2^256-1) and any amount covering the order both
    // pass; the later permit signature is what pins the actual spend to the
    // order amount and nonce.
    if (approveAmount.isLessThan(orderAmount)) {
      return { ok: false, reason: 'approve amount below order' };
    }
    return { ok: true, kind: 'approve' };
  }

  return { ok: false, reason: 'unrecognized calldata shape' };
}

/**
 * Proves a single eth_sendTransaction action structurally matches the order
 * the user approved on screen. Handles the action-level shape (walletRpc
 * guard, method assertion, JSON.parse of params, params-array-length check)
 * and delegates the tx-level checks to `checkWcPayEvmTxMatchesOrder`. Any
 * uncertainty returns ok:false; the caller falls back to the full confirm
 * page, never refuses the payment outright. Must never throw on hostile
 * input — `action` crosses a trust boundary (server response).
 */
export function checkWcPayEvmActionMatchesOrder({
  action,
  option,
}: {
  action: IWcPayAction;
  option: IWcPayOption;
}): IWcPayOrderConsistencyResult {
  if (!action?.walletRpc) {
    return { ok: false, reason: 'missing walletRpc' };
  }
  if (action.walletRpc.method !== EWcPayActionMethod.EthSendTransaction) {
    return { ok: false, reason: 'unsupported method' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(action.walletRpc.params);
  } catch {
    return { ok: false, reason: 'unparseable params' };
  }

  // eth_sendTransaction params are always [tx] per JSON-RPC convention; any
  // other shape (not an array, or more/fewer than one element) is unknown.
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    return { ok: false, reason: 'unexpected params array length' };
  }
  const [tx] = parsed;

  if (!tx || typeof tx !== 'object' || Array.isArray(tx)) {
    return { ok: false, reason: 'invalid tx shape' };
  }

  // expectedNonce is intentionally omitted: a raw server-supplied action
  // must never carry a nonce (see checkWcPayEvmTxMatchesOrder's doc).
  return checkWcPayEvmTxMatchesOrder({
    tx: tx as Record<string, unknown>,
    caip2ChainId: action.walletRpc.chainId,
    option,
  });
}
