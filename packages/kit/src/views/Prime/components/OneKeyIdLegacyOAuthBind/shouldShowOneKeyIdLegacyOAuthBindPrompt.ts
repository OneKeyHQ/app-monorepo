import { isLegacyOneKeyIdAccountMissingOAuthIdentity } from '@onekeyhq/shared/src/utils/oneKeyIdAccountUtils';
import type { IOneKeyIdAccount } from '@onekeyhq/shared/types/prime/primeTypes';

/**
 * Whether the inline legacy OAuth bind card should stay visible.
 *
 * The shared predicate treats empty or missing identities as "not a bind
 * candidate". A partial profile refresh can write that unknown shape and
 * would otherwise unmount an already-shown card. Callers pass the last
 * known visibility so unknown data cannot hide a card that was already
 * classified as a legacy email account missing OAuth.
 */
export function shouldShowOneKeyIdLegacyOAuthBindPrompt({
  onekeyAccount,
  lastKnownShouldShow = false,
}: {
  onekeyAccount: IOneKeyIdAccount | undefined;
  lastKnownShouldShow?: boolean;
}): boolean {
  if ((onekeyAccount?.identities?.length ?? 0) === 0) {
    return lastKnownShouldShow;
  }
  return isLegacyOneKeyIdAccountMissingOAuthIdentity(onekeyAccount);
}
