import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

// A OneKey ID logout should tear down the local keyless wallet ONLY when the
// current OneKey ID login is actually backed by that wallet's shared OAuth
// session (logging out tears down the wallet's active credential). That is
// exactly `authSessionSource === KeylessOAuth`.
//
// Deliberately NOT based on server-side account identities
// (onekeyAccount.identities): identities are account-level and shared across
// devices — after another device binds an OAuth identity, this device may
// still be logged in via the legacy email session, and its local keyless
// wallet may even belong to a different social account. Logging out here only
// clears the legacy session, so the wallet must be preserved. An unknown
// source (bridge read failed, stale persisted state) must never trigger wallet
// removal either, so anything other than a confirmed KeylessOAuth source takes
// the wallet-preserving classification.
function shouldSkipLinkedKeylessLogoutBySource({
  authSessionSource,
}: {
  authSessionSource?: EPrimeAuthSessionSource;
}) {
  return authSessionSource !== EPrimeAuthSessionSource.KeylessOAuth;
}

/**
 * Pure classifier for how a OneKey ID logout should treat the local keyless
 * auth. Kept side-effect free (no bridge calls) so it can be unit-tested.
 *
 * - `shouldSkipLinkedLogout`: the keyless wallet must NOT be torn down as part
 *   of this logout (no confirmed keyless-backed server session).
 * - `preserveLocalKeylessAuthOnOneKeyIdLogout`: the OneKey ID logout must keep
 *   the local keyless session + legacy OAuth refresh blobs intact.
 *
 * `keylessWalletReadFailed` (a transient getKeylessWallet() error) is UNKNOWN
 * state, not a confirmed "no wallet": it takes the wallet-preserving branch,
 * the same default the unknown-source and not-logged-in cases use, so a
 * momentary read error never triggers the destructive keyless teardown
 * (clearing the shared keyless session slot + deleting every keyless wallet's
 * legacy OAuth refresh blob).
 */
export function classifyOneKeyIdLogoutKeylessHandling({
  isOneKeyIdSource,
  hasKeylessWallet,
  keylessWalletReadFailed,
  isOneKeyIdLoggedIn,
  authSessionSource,
}: {
  isOneKeyIdSource: boolean;
  hasKeylessWallet: boolean;
  keylessWalletReadFailed: boolean;
  isOneKeyIdLoggedIn: boolean;
  authSessionSource?: EPrimeAuthSessionSource;
}): {
  shouldSkipLinkedLogout: boolean;
  preserveLocalKeylessAuthOnOneKeyIdLogout: boolean;
} {
  const shouldSkipLinkedLogout =
    hasKeylessWallet &&
    (!isOneKeyIdLoggedIn ||
      shouldSkipLinkedKeylessLogoutBySource({ authSessionSource }));
  const preserveLocalKeylessAuthOnOneKeyIdLogout =
    isOneKeyIdSource && (keylessWalletReadFailed || shouldSkipLinkedLogout);
  return { shouldSkipLinkedLogout, preserveLocalKeylessAuthOnOneKeyIdLogout };
}
