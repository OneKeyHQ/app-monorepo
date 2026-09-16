import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import {
  type ILinkConfigItem,
  PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
} from '@onekeyhq/shared/types/linkConfig';

const EMPTY_LINK_CONFIG_ITEMS: ILinkConfigItem[] = [];

export function resolveLinkConfigRequestLocale(
  settingsLocale: string | undefined,
) {
  if (!settingsLocale || settingsLocale === 'system') {
    return getDefaultLocale();
  }
  return settingsLocale;
}

export async function fetchPrimeGiftClaimSuccessLinks(
  requestLocale?: string,
): Promise<ILinkConfigItem[]> {
  // Locale is applied by the shared request interceptor. The argument exists
  // so the hook runs again when the active language changes.
  void requestLocale;
  try {
    return await backgroundApiProxy.serviceSetting.fetchGetStartedLinks({
      slots: [PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT],
    });
  } catch {
    return EMPTY_LINK_CONFIG_ITEMS;
  }
}

export function pickPrimeGiftClaimSuccessLink(
  items: ILinkConfigItem[] | undefined,
) {
  return items?.[0];
}

export function usePrimeGiftClaimSuccessLink() {
  const [{ locale: settingsLocale }] = useSettingsPersistAtom();
  const requestLocale = resolveLinkConfigRequestLocale(settingsLocale);
  const { result, isLoading } = usePromiseResult(
    async () => fetchPrimeGiftClaimSuccessLinks(requestLocale),
    [requestLocale],
    {
      initResult: EMPTY_LINK_CONFIG_ITEMS,
      watchLoading: true,
    },
  );
  if (isLoading) {
    return undefined;
  }
  return pickPrimeGiftClaimSuccessLink(result);
}
