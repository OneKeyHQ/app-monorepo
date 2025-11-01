import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

export const useBannerInfo = () => {
  const { result: earnBanners, run: refetchBanners } = usePromiseResult(
    async () => {
      const bannerResult =
        await backgroundApiProxy.serviceStaking.fetchEarnHomePageData();
      return (
        bannerResult?.map((i) => ({
          ...i,
          imgUrl: i.src,
          title: i.title || '',
          titleTextProps: {
            size: '$headingMd',
          },
        })) || []
      );
    },
    [],
    {
      revalidateOnReconnect: true,
      revalidateOnFocus: true,
    },
  );

  return { earnBanners, refetchBanners };
};
