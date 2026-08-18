import type { IGasPayer } from '@onekeyhq/shared/types/fee';

export interface IResolveSponsorPayerStateParams {
  /** Raw `payer` returned by the fee service (defaulted to 'user'). */
  serverPayer: IGasPayer;
  /** Raw `megafuelEligible.sponsorable` from the fee service, pre-filtering. */
  megafuelSponsorable: boolean;
  /** Whether the estimate carries an eligible gas account quote. */
  gasAccountQuoteEligible: boolean;
  isCustomRpcEnabled: boolean;
  sponsorDisabledForBatch: boolean;
  megafuelDisabledForPrivateSend: boolean;
  gasAccountDisabledByScenario: boolean;
  gasAccountTemporarilyDisabled: boolean;
}

export interface ISponsorPayerState {
  effectiveFeePayer: IGasPayer;
  selectedPayer: 'user' | 'gasAccount';
}

/**
 * Derives the display payer (`effectiveFeePayer`) and the submit wiring
 * (`selectedPayer`) from the post-filtered sponsor state, in one place so the
 * two can never drift apart (see the atom docs in
 * `states/jotai/contexts/signatureConfirm/atoms.ts`).
 *
 * Megafuel wins over a coexisting gas account quote when it is actually
 * available: it sponsors at the chain level (zeroed gas price), so the quote
 * must not be attached on top of it. When megafuel is suppressed for the
 * scenario (Private Send), the server's megafuel preference falls through to
 * an eligible gas account quote instead of silently degrading to user-paid.
 */
export function resolveSponsorPayerState({
  serverPayer,
  megafuelSponsorable,
  gasAccountQuoteEligible,
  isCustomRpcEnabled,
  sponsorDisabledForBatch,
  megafuelDisabledForPrivateSend,
  gasAccountDisabledByScenario,
  gasAccountTemporarilyDisabled,
}: IResolveSponsorPayerStateParams): ISponsorPayerState {
  const gasAccountSuppressed =
    isCustomRpcEnabled ||
    sponsorDisabledForBatch ||
    gasAccountDisabledByScenario ||
    gasAccountTemporarilyDisabled;
  const megafuelSuppressed =
    isCustomRpcEnabled ||
    sponsorDisabledForBatch ||
    megafuelDisabledForPrivateSend;

  const megafuelAvailable = !megafuelSuppressed && megafuelSponsorable;
  const payerPreference =
    megafuelDisabledForPrivateSend && serverPayer === 'megafuel'
      ? 'gasAccount'
      : serverPayer;

  const selectedPayer: 'user' | 'gasAccount' =
    gasAccountQuoteEligible &&
    !gasAccountSuppressed &&
    !megafuelAvailable &&
    payerPreference === 'gasAccount'
      ? 'gasAccount'
      : 'user';

  let effectiveFeePayer: IGasPayer = serverPayer;
  if (
    isCustomRpcEnabled ||
    sponsorDisabledForBatch ||
    (gasAccountDisabledByScenario && serverPayer === 'gasAccount') ||
    (gasAccountTemporarilyDisabled && serverPayer === 'gasAccount')
  ) {
    effectiveFeePayer = 'user';
  } else if (megafuelDisabledForPrivateSend && serverPayer === 'megafuel') {
    effectiveFeePayer = selectedPayer === 'gasAccount' ? 'gasAccount' : 'user';
  }

  return { effectiveFeePayer, selectedPayer };
}
