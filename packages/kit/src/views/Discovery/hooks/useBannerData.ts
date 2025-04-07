import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { useBannerClosePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';

/**
 * Hook to transform and filter banner data based on user preferences
 * @param banners - List of discovery banners from the API
 * @returns Transformed banner data ready for display
 */
export function useBannerData(banners: IDiscoveryBanner[]) {
  const [bannerClose, setBannerClose] = useBannerClosePersistAtom();

  const data = useMemo(
    () =>
      banners
        .map((i) => ({
          ...i,
          imgUrl: i.src,
          title: i.title || '',
          titleTextProps: {
            maxWidth: '$96',
            size: '$headingLg',
            $gtMd: {
              size: '$heading2xl',
            },
          } as ISizableTextProps,
        }))
        .filter((i) => !bannerClose.ids.includes(i.bannerId)),
    [banners, bannerClose],
  );

  return {
    data,
    hasActiveBanners: data.length > 0,
    closeBanner: (id: string) => {
      setBannerClose({
        ids: [...bannerClose.ids, id],
      });
    },
    closeAllBanners: () => {
      const allBannerIds = banners
        .map((banner) => banner.bannerId)
        .filter(Boolean);
      setBannerClose({
        ids: [...new Set([...bannerClose.ids, ...allBannerIds])],
      });
    },
  };
}
