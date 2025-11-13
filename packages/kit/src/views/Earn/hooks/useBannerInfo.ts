import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { useEarnActions } from '../../../states/jotai/contexts/earn';
import { useEarnAtom } from '../../../states/jotai/contexts/earn/atoms';

export const useBannerInfo = () => {
  const actions = useEarnActions();
  const [earnData] = useEarnAtom();

  const refetchBanners = useCallback(async () => {
    const bannerResult =
      await backgroundApiProxy.serviceStaking.fetchEarnHomePageBannerList();
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
  }, [actions]);

  return { earnBanners: earnData.banners, refetchBanners };
};
