import { useCallback, useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { useEarnActions } from '../../../states/jotai/contexts/earn';
import { useEarnAtom } from '../../../states/jotai/contexts/earn/atoms';

export const useBannerInfo = () => {
  const actions = useEarnActions();
  const [earnData] = useEarnAtom();

  const themeVariant = useThemeVariant();

  const refetchBanners = useCallback(async () => {
    await backgroundApiProxy.serviceStaking.clearEarnHomePageBannerListCache();
    const bannerResult =
      await backgroundApiProxy.serviceStaking.fetchEarnHomePageBannerList({
        theme: themeVariant,
      });
    const transformedBanners =
      bannerResult?.map((i) => ({
        ...i,
        imgUrl: i.src,
        title: i.title || '',
        titleTextProps: {
          size: '$headingMd',
        },
      })) || [];

    actions.current.updateBanners(transformedBanners);
  }, [actions, themeVariant]);

  useEffect(() => {
    void refetchBanners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeVariant, refetchBanners]);

  return { earnBanners: earnData.banners, refetchBanners };
};
