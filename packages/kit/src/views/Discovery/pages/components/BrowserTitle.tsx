import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useBannerData } from '../../hooks/useBannerData';

export function BrowserTitle() {
  const intl = useIntl();
  const media = useMedia();

  const { result: homePageData } = usePromiseResult(
    async () => {
      const data =
        await backgroundApiProxy.serviceDiscovery.fetchDiscoveryHomePageData();
      return data;
    },
    [],
    {
      watchLoading: true,
    },
  );

  const { data: bannerData } = useBannerData(homePageData?.banners || []);

  // Check if there are any active banners (not closed by user)
  const hasActiveBanners = bannerData && bannerData.length > 0;

  const memoizedText = useMemo(
    () =>
      intl.formatMessage({
        id: media.gtSm
          ? ETranslations.global_browser
          : ETranslations.browser_dive_in,
      }),
    [intl, media.gtSm],
  );

  if (hasActiveBanners) {
    return null;
  }

  return (
    <SizableText size="$headingLg" color="$text">
      {memoizedText}
    </SizableText>
  );
}
