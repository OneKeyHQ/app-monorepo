import { EWcPayActionMethod, type IWcPayAction } from './payTypes';

// User-facing verdicts (platform refusal, damaged progress, payment already
// in progress) are WcPayError codes — see payErrors.ts — and the UI renders
// their i18n keys; nothing here is matched by message text anymore.

// Error identities for the two payload-failure verdicts of the durable
// progress store (see SimpleDbEntityWalletConnectPay.readSecureEntries):
// thrown by the entity, matched by message in ServiceWalletConnectPay. They
// live in this shared leaf so the service never needs a VALUE import of the
// entity module — SimpleDb entity implementations must stay lazy in the
// background startup graph (check-bundle-architecture enforces it).
export const WC_PAY_PROGRESS_UNREADABLE_ERROR =
  'WalletConnect Pay progress record is not readable';
export const WC_PAY_PROGRESS_CORRUPT_ERROR =
  'WalletConnect Pay progress record is corrupt';

/**
 * True when the action list contains an irreversible on-chain transfer.
 * Sign-only methods (typed data, personal_sign, Solana sign-only) are
 * excluded: re-executing them reproduces the same consumable artifact
 * instead of a second transfer, so they may run without durable progress.
 */
export function hasWcPayBroadcastAction(
  actions: IWcPayAction[] | undefined,
): boolean {
  return Boolean(
    actions?.some(
      (action) =>
        action.walletRpc.method === EWcPayActionMethod.EthSendTransaction,
    ),
  );
}

/**
 * Broadcast-capable actions must not start when their txid cannot be
 * durably recorded. Runs in getRequiredPaymentActions on the authoritative,
 * freshly fetched action list; the options page refuses earlier and without
 * consulting the advisory option.actions (see
 * shouldRefuseWcPayOptionUpfront).
 */
export function shouldRefuseWcPayWithoutDurableProgress({
  actions,
  supportsDurableProgress,
}: {
  actions: IWcPayAction[] | undefined;
  supportsDurableProgress: boolean;
}): boolean {
  return !supportsDurableProgress && hasWcPayBroadcastAction(actions);
}

/**
 * Pre-form gate used while only the advisory per-option action list exists.
 * `option.actions` may be empty or diverge from the authoritative list that
 * getRequiredPaymentActions fetches AFTER compliance data is collected, so
 * gating on it can let a user submit personal identity data and only then
 * learn the payment cannot complete. Without durable progress the only
 * deterministic refusal point is upfront, before any option — including
 * apparently sign-only ones — reaches the compliance form.
 */
export function shouldRefuseWcPayOptionUpfront({
  supportsDurableProgress,
}: {
  supportsDurableProgress: boolean;
}): boolean {
  return !supportsDurableProgress;
}
