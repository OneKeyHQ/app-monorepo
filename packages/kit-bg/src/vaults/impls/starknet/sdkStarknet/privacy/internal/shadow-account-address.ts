import { hash as starknetHash } from "starknet";

import { hash as poseidonHash, toHex } from "../utils/index";
import { compute_identity_key } from "../utils/hashes";

/**
 * Class hash of the `Primer` contract every shadow account is deployed from, before the anonymizer
 * replaces its class with the shadow account's. Mirrors `PRIMER_CLASS_HASH` in
 * `packages/shadow_account_anonymizer/src/shadow_account_anonymizer.cairo`, cemented there so a
 * shadow account's address does not move when the shadow account class changes.
 *
 * A mismatch with the Cairo constant makes every address below wrong, so CI asserts the two agree.
 */
export const PRIMER_CLASS_HASH =
  0x00123e6bc1c14ae9934e933d3f64916a6116dd6b036a922b2b1f0815e0d1d300n;

/**
 * The user+dapp half of a shadow account's identity commitment,
 * `hash(compute_identity_key(user, viewingKey, anonymizer), dappName)`.
 *
 * Mirrors `partial_commitment` in the anonymizer. `dappName` is a felt, so encode a short string
 * before calling.
 */
export function shadowAccountPartialCommitment(
  user: bigint,
  viewingKey: bigint,
  anonymizerAddress: bigint,
  dappName: bigint
): bigint {
  return poseidonHash(compute_identity_key(user, viewingKey, anonymizerAddress), dappName);
}

/**
 * The full identity commitment of one shadow account, `hash(partialCommitment, nonce)`. Mirrors
 * `commitment_from_partial` in the anonymizer.
 */
export function shadowAccountCommitment(partialCommitment: bigint, nonce: bigint): bigint {
  return poseidonHash(partialCommitment, nonce);
}

/**
 * The address the anonymizer deploys the shadow account of `commitment` to, salted by that
 * commitment.
 *
 * The anonymizer deploys with `deploy_from_zero: false` and no constructor arguments, so the
 * address derives from (commitment, `PRIMER_CLASS_HASH`, empty calldata, the anonymizer). Callers
 * that need the address of an *already deployed* account can read it from the anonymizer's
 * `get_shadow_account` view instead. The two agree for anything deployed under the primer pattern.
 *
 * Returned as a felt in hex with no leading zeros; the commitments above stay felts.
 */
export function shadowAccountAddress(commitment: bigint, anonymizerAddress: bigint): string {
  return toHex(
    starknetHash.calculateContractAddressFromHash(
      commitment,
      PRIMER_CLASS_HASH,
      [],
      anonymizerAddress
    )
  );
}
