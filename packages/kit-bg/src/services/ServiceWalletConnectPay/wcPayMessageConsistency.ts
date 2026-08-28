import BigNumber from 'bignumber.js';

import type { IWcPayOption } from '@onekeyhq/shared/src/walletConnect/payTypes';

// Canonical Permit2 deployment (same address on every supported EVM chain).
export const WC_PAY_PERMIT2_ADDRESS =
  '0x000000000022D473030F116dDEE9F6B43aC78BA3';
// A permit that outlives this bound is effectively unbounded for a payment.
export const WC_PAY_PERMIT_MAX_DEADLINE_S = 24 * 60 * 60;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// uint256-ish inputs (chainId/amount/nonce/deadline) arrive as numbers,
// decimal strings or 0x hex strings. bignumber.js base-16 parsing is
// O(n^2) with no length cap of its own, so both string forms are bounded
// BEFORE construction — an oversized value smuggled into a server response
// must never reach `new BigNumber(...)` (mirrors the DoS guard in
// wcPayOrderConsistency.ts).
function parseUint(value: unknown): BigNumber | undefined {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0
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
 * nor unreasonably far in the future. Any uncertainty returns ok:false; the
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
}): IWcPayMessageConsistencyResult {
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
  if (primaryType !== PERMIT_TRANSFER_FROM) {
    return { ok: false, reason: 'unsupported primaryType' };
  }
  if (!Array.isArray(types[primaryType])) {
    return { ok: false, reason: 'invalid typed data shape' };
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
  if (!amount) {
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
  if (deadline.isGreaterThan(nowSec + WC_PAY_PERMIT_MAX_DEADLINE_S)) {
    return { ok: false, reason: 'deadline too far' };
  }

  return {
    ok: true,
    summary: {
      amountRaw: amount.toFixed(),
      tokenAddress: token,
      spender,
      deadlineSec: deadline.toNumber(),
      chainReference: optionChainReference,
    },
  };
}

/**
 * Best-effort read of `message.permitted.token` from the serialized typed
 * data, so the caller can resolve the token before the full check runs.
 * Returns undefined for anything that is not shaped like a Permit2 payload.
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
  if (!isRecord(permitted) || typeof permitted.token !== 'string') {
    return undefined;
  }
  return ADDRESS_RE.test(permitted.token) ? permitted.token : undefined;
}
