// cspell: words unifold Unifold
import { OneKeyError } from '../errors';

import type {
  IUnifoldDepositAddressResult,
  IUnifoldDepositDestination,
} from '../../types/unifoldDeposit';

// Security MUST-1 (contract v1.1 §4): the deposit-address echo must match the
// request field-by-field (addresses compared case-insensitively). Any mismatch
// throws so the address is never rendered. This is the client half of the
// anti-MITM check; the server performs the same check against the vendor.
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
