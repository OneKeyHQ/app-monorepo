import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IInviteRewardScope } from '@onekeyhq/shared/src/referralCode/type';

const EMPTY_SCOPES: IInviteRewardScope[] = [];

// The invite and perks tabs both show the scopes, so they share one request
// and later mounts start from the last answer while it refreshes.
let lastScopes: IInviteRewardScope[] | undefined;
let pendingRequest: Promise<IInviteRewardScope[]> | undefined;

function requestInviteRewardScopes() {
  if (!pendingRequest) {
    const request = backgroundApiProxy.serviceReferralCode
      .getInviteRewardScopes()
      .then((scopes) => {
        lastScopes = scopes;
        return scopes;
      });
    pendingRequest = request;
    const clear = () => {
      if (pendingRequest === request) {
        pendingRequest = undefined;
      }
    };
    void request.then(clear, clear);
  }
  return pendingRequest;
}

/**
 * Server-localized copy for which channels and protocols earn rewards. It
 * needs no OneKey ID login, so invitees see it as well as inviters.
 *
 * Empty until the first answer and whenever the request fails: the copy is an
 * optional hint, shown only when present. A plain effect rather than
 * `usePromiseResult`, so it also works outside a navigator.
 */
export function useInviteRewardScopes(): IInviteRewardScope[] {
  const [scopes, setScopes] = useState<IInviteRewardScope[]>(
    () => lastScopes ?? EMPTY_SCOPES,
  );

  useEffect(() => {
    let isActive = true;
    void (async () => {
      try {
        const next = await requestInviteRewardScopes();
        if (isActive) {
          setScopes(next);
        }
      } catch {
        // Keep what is shown; a failed refresh must not remove the hint.
      }
    })();
    return () => {
      isActive = false;
    };
  }, []);

  return scopes;
}

export function resetInviteRewardScopesCacheForTest() {
  lastScopes = undefined;
  pendingRequest = undefined;
}
