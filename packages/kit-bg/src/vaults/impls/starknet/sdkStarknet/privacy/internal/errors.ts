import { ProvingServiceError } from "./proving-service";

/** Error thrown when a block reorg is detected (HTTP 409 status). */
export class ReorgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReorgError";
  }
}

/**
 * The address the pool screens for this transaction is on the sanctions list — a deposit's own
 * depositor, the shadow account an interaction runs through, or an invoke target the pool requires
 * screening for. Terminal: retrying with the same address will not succeed.
 */
export class ScreeningRejected extends Error {
  override readonly name = "ScreeningRejected";
  constructor(reason?: string) {
    super(reason ? `Screening rejected: ${reason}` : "Screening rejected");
  }
}

/**
 * Screening could not be completed. It fails closed either way: no signature, no transaction.
 *
 * - The screener (FPI cloud function or upstream) or the pool's policy list could not be read.
 *   Transient, so the caller may retry.
 * - The pool answered a policy variant the interceptor's ABI cannot decode. Clears only once the
 *   interceptor is upgraded.
 */
export class ScreeningUnavailable extends Error {
  override readonly name = "ScreeningUnavailable";
  constructor(reason?: string) {
    super(reason ? `Screening unavailable: ${reason}` : "Screening unavailable");
  }
}

/**
 * Opaque `data` reasons the proof interceptor emits on the screening checkpoint. These are the
 * *only* values that denote a screening verdict — a wire contract with the proof interceptor; keep
 * both sides in sync.
 *
 * The interceptor also blocks with `multiple_screening_subjects`, `unknown_delegated_depositor`,
 * `undeposited_open_notes` and `shadow_account_undetermined`. Those are deliberately not mapped:
 * they are terminal for the transaction as built but say nothing about the address, so reporting
 * them as {@link ScreeningRejected} would tell a caller they are sanctioned. They reach the caller
 * as the prover's own error, whose message already carries the reason.
 */
const SCREENING_BLOCKED_REASON = "address_blocked";
const SCREENING_UNAVAILABLE_REASON = "screening_unavailable";
// The pool's policy list is as much a screening dependency as the screener itself, so a read the
// interceptor could not complete is transient rather than a verdict on the address.
const SCREENING_POLICY_UNAVAILABLE_REASON = "screening_policy_unavailable";

/**
 * Map a {@link ProvingServiceError} to a typed screening error, or `undefined`
 * if it is not a screening verdict so the caller can rethrow the original.
 *
 * Code 10000 ("Transaction rejected") is overloaded — the interceptor also
 * emits it for non-pool blocks and for unexpected interceptor exceptions
 * (whose `data` is the raw error message). We therefore switch on the *exact*
 * opaque reasons above rather than treating every 10000 as terminal: a
 * transient interceptor fault must not be reported as a permanent sanctions
 * rejection the user is told never to retry.
 */
export function screeningErrorFromProvingError(
  error: ProvingServiceError
): ScreeningRejected | ScreeningUnavailable | undefined {
  const TRANSACTION_REJECTED = 10000;
  if (error.code !== TRANSACTION_REJECTED) {
    return undefined;
  }
  if (
    error.data === SCREENING_UNAVAILABLE_REASON ||
    error.data === SCREENING_POLICY_UNAVAILABLE_REASON
  ) {
    return new ScreeningUnavailable(error.data);
  }
  if (error.data === SCREENING_BLOCKED_REASON) {
    return new ScreeningRejected(error.data);
  }
  return undefined;
}
