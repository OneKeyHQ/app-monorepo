import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IInviteRewardScope } from '@onekeyhq/shared/src/referralCode/type';

const EMPTY_SCOPES: IInviteRewardScope[] = [];

/**
 * Server-localized copy for which channels and protocols earn rewards.
 * Empty until it arrives and when the request fails: the copy is an optional
 * hint, shown only when present. The service caches it.
 */
export function useInviteRewardScopes(): IInviteRewardScope[] {
  const locale = useLocaleVariant();
  const { result } = usePromiseResult(
    async () => ({
      locale,
      scopes:
        await backgroundApiProxy.serviceReferralCode.getInviteRewardScopes(),
    }),
    [locale],
    {
      checkIsFocused: false,
      keepResultIfError: true,
    },
  );
  // Never paint the previous language while the new request is pending or fails.
  return result?.locale === locale ? result.scopes : EMPTY_SCOPES;
}
