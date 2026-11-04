import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IInviteRewardScope } from '@onekeyhq/shared/src/referralCode/type';

const EMPTY_SCOPES: IInviteRewardScope[] = [];

/**
 * Server-localized copy for which channels and protocols earn rewards.
 * Empty until it arrives and when the request fails: the copy is an optional
 * hint, shown only when present. The service caches it.
 */
export function useInviteRewardScopes(): IInviteRewardScope[] {
  const { result } = usePromiseResult(
    () => backgroundApiProxy.serviceReferralCode.getInviteRewardScopes(),
    [],
    {
      initResult: EMPTY_SCOPES,
      checkIsFocused: false,
      keepResultIfError: true,
    },
  );
  return result;
}
