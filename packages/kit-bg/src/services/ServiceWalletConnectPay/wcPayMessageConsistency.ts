import BigNumber from 'bignumber.js';

import type { IWcPayOption } from '@onekeyhq/shared/src/walletConnect/payTypes';

// Canonical Permit2 deployment (same address on every supported EVM chain).
export const WC_PAY_PERMIT2_ADDRESS =
  '0x000000000022D473030F116dDEE9F6B43aC78BA3';
// A permit that outlives this bound is effectively unbounded for a payment.
// The ceiling is the whole deadline story (Phase 3 §6): permits only
// authorize — amount, token and nonce are pinned by this validator, Permit2
// nonces prevent replay, and the Pay server refuses an expired order
// regardless of the permit — so the bound only has to exclude
// effectively-unbounded deadlines, not track the order lifetime. 30 days
// accommodates the multi-week sigDeadlines Pay SDKs customarily issue.
export const WC_PAY_PERMIT_MAX_DEADLINE_S = 30 * 24 * 60 * 60;

export type IWcPayResolvedToken = {
  address: string;
  symbol: string;
  decimals: number;
};

export interface IWcPayTypedDataSummary {
  amountRaw: string;
  tokenAddress: string;
  spender: string;
  deadlineSec: number;
  chainReference: string;
}

export type IWcPayMessageConsistencyResult =
  | { ok: true; summary: IWcPayTypedDataSummary }
  | { ok: false; reason: string };

interface ITypedDataField {
  name: string;
  type: string;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
// A raw hex word is at most 64 hex chars (32 bytes); 78 is the digit length
// of uint256 max (2^256 - 1) — same caps as wcPayOrderConsistency.ts.
const MAX_HEX_UINT_CHARS = 64;
const MAX_DECIMAL_UINT_CHARS = 78;
const UINT_DEC_RE = new RegExp(
  `^(0|[1-9][0-9]{0,${MAX_DECIMAL_UINT_CHARS - 1}})$`,
);
const HEX_RE = new RegExp(`^0x[0-9a-fA-F]{1,${MAX_HEX_UINT_CHARS}}$`);
// The order's own `amount.value` mirrors wcPayOrderConsistency.ts's decimal
// rule (leading zeros accepted) so the same server field is never judged by
// two different formats depending on which validator ran. The typed-data
// fields (permitted.amount, nonce, deadline, domain.chainId) keep the
// stricter no-leading-zero UINT_DEC_RE above.
const ORDER_AMOUNT_RE = new RegExp(`^[0-9]{1,${MAX_DECIMAL_UINT_CHARS}}$`);
const PERMIT_TRANSFER_FROM = 'PermitTransferFrom';
const MESSAGE_KEYS = ['permitted', 'spender', 'nonce', 'deadline'];
const PERMITTED_KEYS = ['token', 'amount'];
const DOMAIN_KEYS = ['name', 'chainId', 'verifyingContract'];

// EIP-3009 ReceiveWithAuthorization — the gasless-pull shape the Pay server
// actually issues for Circle-native USDC (observed live 2026-08-31): the
// TOKEN CONTRACT is the verifying contract, and the user authorizes the
// named `to` to pull exactly `value` within the validity window. Only the
// Receive variant is supported: unlike TransferWithAuthorization, the chain
// enforces that only `to` itself can submit it, so a leaked signature cannot
// be redeemed by a third party.
const RECEIVE_WITH_AUTHORIZATION = 'ReceiveWithAuthorization';
const EIP3009_MESSAGE_KEYS = [
  'from',
  'to',
  'value',
  'validAfter',
  'validBefore',
  'nonce',
];
const EIP3009_DOMAIN_KEYS = ['name', 'version', 'chainId', 'verifyingContract'];
// Bounded length for the free-string domain fields (name/version). They are
// not pinned to specific values: the domain binds the signature to
// `verifyingContract`, whose identity the registry check proves — a wrong
// name/version merely produces a signature the chain rejects.
const EIP3009_DOMAIN_STRING_MAX_CHARS = 64;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const EIP3009_CANONICAL_TYPES: Record<string, ITypedDataField[]> = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
  ReceiveWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};
const EIP3009_TYPE_NAMES = Object.keys(EIP3009_CANONICAL_TYPES);

// The exact EIP-712 type definitions Permit2's canonical PermitTransferFrom
// signature is built from — struct name, field order, and each field's
// name/type must all match verbatim. `@metamask/eth-sig-util`'s V4 encoder
// either throws on a struct it cannot resolve (a missing/renamed referenced
// type) or silently hashes a different struct/domain separator when the
// field list disagrees with what it infers from `domain`/`message` — either
// way a wrong hash signs something other than the payload shown on screen.
// Pinning every type exactly makes this validator, not the signer's own
// error handling, the place that catches a malformed payload before it is
// trusted for headless inline signing.
const CANONICAL_TYPES: Record<string, ITypedDataField[]> = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
};
const CANONICAL_TYPE_NAMES = Object.keys(CANONICAL_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(
  record: Record<string, unknown>,
  allowed: string[],
): boolean {
  const keys = Object.keys(record);
  return (
    keys.length === allowed.length && allowed.every((key) => keys.includes(key))
  );
}

function fieldsMatchCanonical(
  actual: unknown,
  expected: ITypedDataField[],
): boolean {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    return false;
  }
  return expected.every((field, index) => {
    const entry: unknown = actual[index];
    return (
      isRecord(entry) && entry.name === field.name && entry.type === field.type
    );
  });
}

// `types` must carry exactly the three canonical Permit2 struct
// definitions — no fourth struct, none missing, and no reordered, extra, or
// mistyped field within any of them (see CANONICAL_TYPES for why this must
// be exact rather than merely "present").
function isCanonicalPermit2Types(types: Record<string, unknown>): boolean {
  if (!hasExactKeys(types, CANONICAL_TYPE_NAMES)) {
    return false;
  }
  return CANONICAL_TYPE_NAMES.every((name) =>
    fieldsMatchCanonical(types[name], CANONICAL_TYPES[name]),
  );
}

// uint256-ish inputs (chainId/amount/nonce/deadline) arrive as numbers,
// decimal strings or 0x hex strings. bignumber.js base-16 parsing is
// O(n^2) with no length cap of its own, so both string forms are bounded
// BEFORE construction — an oversized value smuggled into a server response
// must never reach `new BigNumber(...)` (mirrors the DoS guard in
// wcPayOrderConsistency.ts).
function parseUint(value: unknown): BigNumber | undefined {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0
      ? new BigNumber(value)
      : undefined;
  }
  if (typeof value === 'string') {
    if (UINT_DEC_RE.test(value)) return new BigNumber(value);
    if (HEX_RE.test(value)) return new BigNumber(value.slice(2), 16);
  }
  return undefined;
}

function unexpectedKey(
  record: Record<string, unknown>,
  allowed: string[],
): string | undefined {
  return Object.keys(record).find((key) => !allowed.includes(key));
}

/**
 * Proves a server-supplied `eth_signTypedData_v4` payload is exactly a
 * Permit2 `PermitTransferFrom` for the order the user approved: same chain,
 * same amount, same token (identity confirmed via the wallet's own token
 * registry, not the payload alone), and a deadline that is neither expired
 * nor unreasonably far in the future. The `spender` is shape-checked only —
 * the option carries no expected spender, so who may execute the transfer
 * remains server-trusted, exactly like the recipient in the tx-level
 * validator (see wcPayOrderConsistency.ts). The deadline ceiling is measured
 * against the caller's clock (`nowMs`), so a skewed device clock shifts the
 * window with it. Any uncertainty returns ok:false; the
 * caller falls back to the full confirm UI, never refuses the payment
 * outright. Must never throw on hostile input — `typedData` crosses a trust
 * boundary (server response).
 */
export function checkWcPayTypedDataMatchesOrder({
  typedData,
  caip2ChainId,
  option,
  nowMs,
  resolvedToken,
  maxDeadlineS,
}: {
  typedData: unknown;
  // The option's CAIP-2 chain (e.g. "eip155:8453").
  caip2ChainId: string;
  option: IWcPayOption;
  nowMs: number;
  // The order's token, resolved through the wallet's own token registry —
  // the typed-data payload's `permitted.token` alone is not trusted for
  // symbol/decimals identity.
  resolvedToken: IWcPayResolvedToken | undefined;
  // Tightens WC_PAY_PERMIT_MAX_DEADLINE_S, which stays a hard ceiling: a
  // finite positive value narrows the bound (via Math.min), but can never
  // widen it past the default. Any non-finite or non-positive value is
  // ignored in favor of the default — a bad caller input must never
  // silently disable the deadline bound.
  maxDeadlineS?: number;
}): IWcPayMessageConsistencyResult {
  // BigNumber comparisons against NaN silently return false, which would
  // let both deadline checks below pass regardless of the actual deadline —
  // the clock itself must be sane before it is trusted for any comparison.
  if (!Number.isFinite(nowMs)) {
    return { ok: false, reason: 'invalid clock' };
  }
  if (!isRecord(typedData)) {
    return { ok: false, reason: 'invalid typed data shape' };
  }
  const { types, domain, primaryType, message } = typedData;
  if (
    !isRecord(types) ||
    !isRecord(domain) ||
    !isRecord(message) ||
    typeof primaryType !== 'string'
  ) {
    return { ok: false, reason: 'invalid typed data shape' };
  }
  if (primaryType === RECEIVE_WITH_AUTHORIZATION) {
    return checkWcPayReceiveWithAuthorization({
      types,
      domain,
      message,
      caip2ChainId,
      option,
      nowMs,
      resolvedToken,
      maxDeadlineS,
    });
  }
  if (primaryType !== PERMIT_TRANSFER_FROM) {
    return { ok: false, reason: 'unsupported primaryType' };
  }
  if (!isCanonicalPermit2Types(types)) {
    return { ok: false, reason: 'unsupported typed data types' };
  }
  if (!hasExactKeys(domain, DOMAIN_KEYS) || domain.name !== 'Permit2') {
    return { ok: false, reason: 'unsupported domain' };
  }
  const { verifyingContract } = domain;
  if (
    typeof verifyingContract !== 'string' ||
    verifyingContract.toLowerCase() !== WC_PAY_PERMIT2_ADDRESS.toLowerCase()
  ) {
    return { ok: false, reason: 'verifyingContract is not Permit2' };
  }

  const accountParts =
    typeof option?.account === 'string' ? option.account.split(':') : [];
  if (accountParts.length !== 3 || accountParts.some((part) => !part)) {
    return { ok: false, reason: 'invalid option account shape' };
  }
  const [namespace, optionChainReference] = accountParts;
  // The eip155 prefix is part of the account's own shape, not a chain
  // comparison — an account on a foreign namespace (e.g. "solana:...") is
  // malformed input for this EVM-only validator, distinct from an eip155
  // account whose chain simply disagrees with the typed data.
  if (namespace !== 'eip155') {
    return { ok: false, reason: 'invalid option account shape' };
  }
  const domainChainId = parseUint(domain.chainId);
  if (
    !domainChainId ||
    !domainChainId.isEqualTo(optionChainReference) ||
    caip2ChainId !== `eip155:${optionChainReference}`
  ) {
    return { ok: false, reason: 'chain mismatch' };
  }

  const extraMessageKey = unexpectedKey(message, MESSAGE_KEYS);
  if (extraMessageKey) {
    return { ok: false, reason: `unexpected message key: ${extraMessageKey}` };
  }
  const { permitted } = message;
  if (!isRecord(permitted)) {
    return { ok: false, reason: 'invalid permitted shape' };
  }
  const extraPermittedKey = unexpectedKey(permitted, PERMITTED_KEYS);
  if (extraPermittedKey) {
    return {
      ok: false,
      reason: `unexpected permitted key: ${extraPermittedKey}`,
    };
  }

  const amount = parseUint(permitted.amount);
  // A zero amount can never equal a real (positive) order amount, but is
  // rejected here directly — mirrors wcPayOrderConsistency.ts's own
  // positive-amount guard rather than relying on the equality check below.
  if (!amount || amount.isZero()) {
    return { ok: false, reason: 'invalid amount' };
  }
  if (
    typeof option.amount?.value !== 'string' ||
    !ORDER_AMOUNT_RE.test(option.amount.value)
  ) {
    return { ok: false, reason: 'invalid order amount format' };
  }
  if (!amount.isEqualTo(option.amount.value)) {
    return { ok: false, reason: 'amount mismatch' };
  }

  const { token } = permitted;
  if (typeof token !== 'string' || !ADDRESS_RE.test(token)) {
    return { ok: false, reason: 'invalid token address' };
  }
  if (!resolvedToken) {
    return { ok: false, reason: 'unknown token' };
  }
  if (resolvedToken.address.toLowerCase() !== token.toLowerCase()) {
    return { ok: false, reason: 'token address mismatch' };
  }
  if (resolvedToken.symbol !== option.amount.display?.assetSymbol) {
    return { ok: false, reason: 'token symbol mismatch' };
  }
  if (resolvedToken.decimals !== option.amount.display?.decimals) {
    return { ok: false, reason: 'token decimals mismatch' };
  }

  const { spender } = message;
  if (typeof spender !== 'string' || !ADDRESS_RE.test(spender)) {
    return { ok: false, reason: 'invalid spender' };
  }
  if (!parseUint(message.nonce)) {
    return { ok: false, reason: 'invalid nonce' };
  }
  const deadline = parseUint(message.deadline);
  if (!deadline) {
    return { ok: false, reason: 'invalid deadline' };
  }
  const nowSec = Math.floor(nowMs / 1000);
  if (deadline.isLessThan(nowSec)) {
    return { ok: false, reason: 'deadline expired' };
  }
  // WC_PAY_PERMIT_MAX_DEADLINE_S is a hard ceiling, not just a default: a
  // caller-provided maxDeadlineS can only tighten the bound, never widen it
  // past what this validator considers "effectively unbounded" — Math.min
  // ignores a finite positive value larger than the ceiling rather than
  // trusting it outright.
  const effectiveMaxDeadlineS =
    typeof maxDeadlineS === 'number' &&
    Number.isFinite(maxDeadlineS) &&
    maxDeadlineS > 0
      ? Math.min(maxDeadlineS, WC_PAY_PERMIT_MAX_DEADLINE_S)
      : WC_PAY_PERMIT_MAX_DEADLINE_S;
  if (deadline.isGreaterThan(nowSec + effectiveMaxDeadlineS)) {
    return { ok: false, reason: 'deadline too far' };
  }

  return {
    ok: true,
    summary: {
      amountRaw: amount.toFixed(),
      // resolvedToken.address (registry-canonical casing), not the
      // payload's own `token` string — the two are only known to be
      // case-insensitively equal at this point.
      tokenAddress: resolvedToken.address,
      spender,
      deadlineSec: deadline.toNumber(),
      chainReference: optionChainReference,
    },
  };
}

/**
 * The EIP-3009 half of `checkWcPayTypedDataMatchesOrder` (which owns the
 * common shape checks and dispatched here on `primaryType`). Everything
 * Permit2 proves is proven here too, plus one property Permit2 cannot offer:
 * `from` is the payload's own field and must equal the option account, so
 * the authorization provably moves the order amount from the very account
 * the user approved. What stays server-trusted is `to` (the puller and
 * recipient) — the same accepted limitation as Permit2's `spender` and the
 * tx-level recipient. Must never throw — all inputs cross a trust boundary.
 */
function checkWcPayReceiveWithAuthorization({
  types,
  domain,
  message,
  caip2ChainId,
  option,
  nowMs,
  resolvedToken,
  maxDeadlineS,
}: {
  types: Record<string, unknown>;
  domain: Record<string, unknown>;
  message: Record<string, unknown>;
  caip2ChainId: string;
  option: IWcPayOption;
  nowMs: number;
  resolvedToken: IWcPayResolvedToken | undefined;
  maxDeadlineS?: number;
}): IWcPayMessageConsistencyResult {
  if (
    !hasExactKeys(types, EIP3009_TYPE_NAMES) ||
    !EIP3009_TYPE_NAMES.every((name) =>
      fieldsMatchCanonical(types[name], EIP3009_CANONICAL_TYPES[name]),
    )
  ) {
    return { ok: false, reason: 'unsupported typed data types' };
  }
  if (
    !hasExactKeys(domain, EIP3009_DOMAIN_KEYS) ||
    typeof domain.name !== 'string' ||
    domain.name.length > EIP3009_DOMAIN_STRING_MAX_CHARS ||
    typeof domain.version !== 'string' ||
    domain.version.length > EIP3009_DOMAIN_STRING_MAX_CHARS
  ) {
    return { ok: false, reason: 'unsupported domain' };
  }

  const accountParts =
    typeof option?.account === 'string' ? option.account.split(':') : [];
  if (accountParts.length !== 3 || accountParts.some((part) => !part)) {
    return { ok: false, reason: 'invalid option account shape' };
  }
  const [namespace, optionChainReference, optionAddress] = accountParts;
  if (namespace !== 'eip155') {
    return { ok: false, reason: 'invalid option account shape' };
  }
  const domainChainId = parseUint(domain.chainId);
  if (
    !domainChainId ||
    !domainChainId.isEqualTo(optionChainReference) ||
    caip2ChainId !== `eip155:${optionChainReference}`
  ) {
    return { ok: false, reason: 'chain mismatch' };
  }

  const extraMessageKey = unexpectedKey(message, EIP3009_MESSAGE_KEYS);
  if (extraMessageKey) {
    return { ok: false, reason: `unexpected message key: ${extraMessageKey}` };
  }

  const { from } = message;
  if (typeof from !== 'string' || !ADDRESS_RE.test(from)) {
    return { ok: false, reason: 'invalid from address' };
  }
  // Provable, unlike anything in the Permit2 shape: the authorization names
  // its own payer, and it must be the account the user approved paying from.
  if (from.toLowerCase() !== optionAddress.toLowerCase()) {
    return { ok: false, reason: 'from mismatch' };
  }
  const { to } = message;
  if (typeof to !== 'string' || !ADDRESS_RE.test(to)) {
    return { ok: false, reason: 'invalid to address' };
  }

  const value = parseUint(message.value);
  if (!value || value.isZero()) {
    return { ok: false, reason: 'invalid amount' };
  }
  if (
    typeof option.amount?.value !== 'string' ||
    !ORDER_AMOUNT_RE.test(option.amount.value)
  ) {
    return { ok: false, reason: 'invalid order amount format' };
  }
  if (!value.isEqualTo(option.amount.value)) {
    return { ok: false, reason: 'amount mismatch' };
  }

  // Token identity: the VERIFYING CONTRACT is the token being moved —
  // proven through the wallet's own registry, the §4.6 rule every other
  // signing leg applies.
  const { verifyingContract } = domain;
  if (
    typeof verifyingContract !== 'string' ||
    !ADDRESS_RE.test(verifyingContract)
  ) {
    return { ok: false, reason: 'invalid token address' };
  }
  if (!resolvedToken) {
    return { ok: false, reason: 'unknown token' };
  }
  if (resolvedToken.address.toLowerCase() !== verifyingContract.toLowerCase()) {
    return { ok: false, reason: 'token address mismatch' };
  }
  if (resolvedToken.symbol !== option.amount.display?.assetSymbol) {
    return { ok: false, reason: 'token symbol mismatch' };
  }
  if (resolvedToken.decimals !== option.amount.display?.decimals) {
    return { ok: false, reason: 'token decimals mismatch' };
  }

  if (typeof message.nonce !== 'string' || !BYTES32_RE.test(message.nonce)) {
    return { ok: false, reason: 'invalid nonce' };
  }
  const nowSec = Math.floor(nowMs / 1000);
  const validAfter = parseUint(message.validAfter);
  if (!validAfter) {
    return { ok: false, reason: 'invalid validAfter' };
  }
  // An authorization that only becomes redeemable later cannot settle the
  // payment now; refusing keeps the signed window entirely observable.
  if (validAfter.isGreaterThan(nowSec)) {
    return { ok: false, reason: 'authorization not yet valid' };
  }
  const validBefore = parseUint(message.validBefore);
  if (!validBefore) {
    return { ok: false, reason: 'invalid deadline' };
  }
  if (validBefore.isLessThan(nowSec)) {
    return { ok: false, reason: 'deadline expired' };
  }
  // Same ceiling semantics as the Permit2 branch (see the comment there).
  const effectiveMaxDeadlineS =
    typeof maxDeadlineS === 'number' &&
    Number.isFinite(maxDeadlineS) &&
    maxDeadlineS > 0
      ? Math.min(maxDeadlineS, WC_PAY_PERMIT_MAX_DEADLINE_S)
      : WC_PAY_PERMIT_MAX_DEADLINE_S;
  if (validBefore.isGreaterThan(nowSec + effectiveMaxDeadlineS)) {
    return { ok: false, reason: 'deadline too far' };
  }

  return {
    ok: true,
    summary: {
      amountRaw: value.toFixed(),
      tokenAddress: resolvedToken.address,
      // the named puller/recipient — plays the same "who may take it" role
      // the Permit2 spender does, and the sheet describes it identically
      spender: to,
      deadlineSec: validBefore.toNumber(),
      chainReference: optionChainReference,
    },
  };
}

/**
 * Best-effort read of the typed data's token address, so the caller can
 * resolve it through the registry before the full check runs: Permit2
 * payloads name it as `message.permitted.token`, EIP-3009 payloads move
 * value on the verifying contract itself. Returns undefined for anything
 * shaped like neither.
 */
export function readWcPayPermitTokenAddress(
  typedDataJson: string,
): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(typedDataJson);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed) || !isRecord(parsed.message)) {
    return undefined;
  }
  const { permitted } = parsed.message;
  if (isRecord(permitted) && typeof permitted.token === 'string') {
    return ADDRESS_RE.test(permitted.token) ? permitted.token : undefined;
  }
  if (
    parsed.primaryType === RECEIVE_WITH_AUTHORIZATION &&
    isRecord(parsed.domain) &&
    typeof parsed.domain.verifyingContract === 'string' &&
    ADDRESS_RE.test(parsed.domain.verifyingContract)
  ) {
    return parsed.domain.verifyingContract;
  }
  return undefined;
}
