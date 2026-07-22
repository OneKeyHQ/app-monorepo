// cspell: words unifold Unifold
import BigNumber from 'bignumber.js';

import { OneKeyError } from '../errors';

import type {
  IUnifoldDepositAddressResult,
  IUnifoldDepositDestination,
} from '../../types/unifoldDeposit';

// Security MUST-1 (contract v1.1 §4): the deposit-address echo must match the
// request field-by-field (addresses compared case-insensitively). Any mismatch
// throws so the address is never rendered. This is the client half of the
// anti-MITM check; the server performs the same check against the vendor.
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
