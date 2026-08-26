import { EOneKeyIdIdentityType } from '@onekeyhq/shared/types/prime/primeTypes';
import type { IOneKeyIdAccount } from '@onekeyhq/shared/types/prime/primeTypes';

/**
 * Whether the OneKey ID account is a legacy email account that has not bound
 * any OAuth identity yet (has a LegacyEmail identity and no OAuth identity).
 *
 * Returns false when the identities array is empty or missing. Callers that
 * need a different classification for unknown identity data (e.g. offline or
 * stale persisted login state) must handle the empty-identities case
 * themselves before calling this core predicate.
 */
export function isLegacyOneKeyIdAccountMissingOAuthIdentity(
  onekeyAccount: IOneKeyIdAccount | undefined,
): boolean {
  const identities = onekeyAccount?.identities ?? [];
  const hasLegacyEmailIdentity = identities.some(
    (identity) => identity.identityType === EOneKeyIdIdentityType.LegacyEmail,
  );
  const hasOAuthIdentity = identities.some(
    (identity) => identity.identityType === EOneKeyIdIdentityType.OAuth,
  );
  return hasLegacyEmailIdentity && !hasOAuthIdentity;
}
