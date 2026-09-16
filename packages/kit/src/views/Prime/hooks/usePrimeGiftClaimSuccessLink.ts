import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
  asLinkConfigItems,
} from '@onekeyhq/shared/types/linkConfig';

const EMPTY_LINK_CONFIG_ITEMS = asLinkConfigItems(undefined);

export function usePrimeGiftClaimSuccessLink() {
  const locale = useLocaleVariant();
  const { result, isLoading } = usePromiseResult(
    async () => {
      try {
        return asLinkConfigItems(
          await backgroundApiProxy.serviceSetting.fetchGetStartedLinks({
            slots: [PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT],
          }),
        );
      } catch {
        // Fail closed so a Utility slot error cannot break the success page.
        return EMPTY_LINK_CONFIG_ITEMS;
      }
    },
    // Locale is applied by the shared request interceptor; this dep only
    // retriggers the fetch when the active language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
    {
      initResult: EMPTY_LINK_CONFIG_ITEMS,
      watchLoading: true,
    },
  );
  if (isLoading) {
    return undefined;
  }
  return result?.[0];
}
