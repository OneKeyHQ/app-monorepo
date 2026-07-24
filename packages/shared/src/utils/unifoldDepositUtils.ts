// cspell: words unifold Unifold
import BigNumber from 'bignumber.js';

import { OneKeyError } from '../errors';

import type {
  IUnifoldDepositAddressResult,
  IUnifoldDepositDestination,
} from '../../types/unifoldDeposit';

// Security MUST-1 (contract v1.1 §4): the deposit-address echo must match the
// request field-by-field (addresses compared case-insensitively). Any mismatch
// throws so the address is never rendered.
//
// Scope, precisely: this detects a server that answered about a DIFFERENT
// request — cross-user response mix-ups, cache-key collisions, a silently
// downgraded destination. It is NOT an anti-MITM control: the echo travels in
// the same response body as the deposit address, so anyone able to rewrite one
// can rewrite the other. Nor can it ever cover `depositAddress`/`wallets[]` —
// an echo only authenticates values the client independently knows, and a
// freshly minted escrow address is not one of them. Binding that address
// requires an out-of-band signature (see docs), not a wider echo.
// Vendor USD amounts arrive as raw decimal strings with full precision
// ("3.29960100000000000000"). Amount discipline (contract §4-3): parse with
// BigNumber, never Number, and never render null as 0 — display only.
// Lives in shared because both the UI and the bg terminal toast format it.
// Explicit format so output never depends on a global BigNumber.config.
const GROUPED_FORMAT: BigNumber.Format = {
  prefix: '',
  decimalSeparator: '.',
  groupSeparator: ',',
  groupSize: 3,
  secondaryGroupSize: 0,
  fractionGroupSeparator: '',
  fractionGroupSize: 0,
  suffix: '',
};

export function formatUnifoldUsdAmount(
  value: string | null | undefined,
): string {
  if (!value) {
    return '—';
  }
  const amount = new BigNumber(value);
  if (amount.isNaN()) {
    return '—';
  }
  if (amount.isZero()) {
    return '$0.00';
  }
  if (amount.abs().lt(0.01)) {
    return amount.isNegative() ? '>-$0.01' : '<$0.01';
  }
  // Sign goes outside the currency symbol: -$3.50, not $-3.50.
  const rendered = amount.abs().toFormat(2, GROUPED_FORMAT);
  return amount.isNegative() ? `-$${rendered}` : `$${rendered}`;
}

// Token amounts keep more precision than USD, but a non-zero balance must
// never collapse to a bare "0" — that would read as "nothing arrived".
export function formatUnifoldTokenAmountValue({
  baseUnit,
  decimals,
}: {
  baseUnit: string | null | undefined;
  decimals: number | null | undefined;
}): string | null {
  if (!baseUnit || decimals === null || decimals === undefined) {
    return null;
  }
  const amount = new BigNumber(baseUnit).shiftedBy(-decimals);
  if (amount.isNaN()) {
    return null;
  }
  if (amount.isZero()) {
    return '0';
  }
  if (amount.abs().gte(1)) {
    return amount.toFormat(2, GROUPED_FORMAT);
  }
  const small = amount.decimalPlaces(8);
  if (small.isZero()) {
    return amount.isNegative() ? '>-0.00000001' : '<0.00000001';
  }
  return small.toFormat(GROUPED_FORMAT);
}

// createdAt is a nullable vendor passthrough with no pinned format: accept
// epoch seconds, epoch ms, or a date string. null means "cannot bound" and
// callers must fail safe (skip, never announce; render an em dash, never a
// wrong date). Shared so the bg discovery window and the UI timestamp can
// never disagree about what a given payload means.
export function parseUnifoldExecutionCreatedAtMs(
  createdAt: string | null | undefined,
): number | null {
  if (!createdAt) {
    return null;
  }
  const numeric = Number(createdAt);
  if (Number.isFinite(numeric)) {
    // A numeric value is an epoch, full stop. Falling through to Date.parse
    // here would read '0' as the year 2000 and '-1' as year -1 — a confidently
    // wrong timestamp where the contract says we cannot bound the value.
    if (numeric <= 0) {
      return null;
    }
    return numeric >= 1e12 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(createdAt);
  return Number.isNaN(parsed) ? null : parsed;
}

// The executions query is keyed on recipientAddress, but nothing binds the
// response to it. Consumers render these rows and toast "deposit completed"
// off them, so an execution that positively claims a different recipient — a
// server-side filter regression, a response mix-up, a rewritten response —
// must never reach them. `recipientAddress` is a nullable passthrough: a null
// row carries no claim to contradict and is kept.
export function filterUnifoldExecutionsByRecipient<
  T extends { recipientAddress: string | null },
>(executions: T[], recipientAddress: string): T[] {
  const recipient = recipientAddress.toLowerCase();
  return executions.filter(
    (execution) =>
      !execution.recipientAddress ||
      execution.recipientAddress.toLowerCase() === recipient,
  );
}

// Picks the wallet the user is told to pay for a given source chain family.
// Case-insensitive because the two sides come from different endpoints (the
// catalog and the address response) with no casing pinned between them, and
// `isPrimary` wins because array order is not a contract.
export function pickUnifoldDepositWallet<
  T extends { chainType: string; address: string; isPrimary: boolean },
>(wallets: T[] | null | undefined, chainType: string | null | undefined) {
  if (!wallets?.length || !chainType) {
    return null;
  }
  const wanted = chainType.toLowerCase();
  const matches = wallets.filter((w) => w?.chainType?.toLowerCase() === wanted);
  return matches.find((w) => w.isPrimary) ?? matches[0] ?? null;
}

export function assertUnifoldEchoMatches(
  echo: IUnifoldDepositAddressResult['echo'] | null | undefined,
  request: { recipientAddress: string } & IUnifoldDepositDestination,
) {
  const sameAddress = (a: string | undefined, b: string | undefined) =>
    Boolean(a) && (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
  const ok =
    Boolean(echo) &&
    sameAddress(echo?.recipientAddress, request.recipientAddress) &&
    echo?.destinationChainType === request.destinationChainType &&
    echo?.destinationChainId === request.destinationChainId &&
    sameAddress(echo?.destinationTokenAddress, request.destinationTokenAddress);
  if (!ok) {
    throw new OneKeyError('Unifold deposit-address echo mismatch');
  }
}
