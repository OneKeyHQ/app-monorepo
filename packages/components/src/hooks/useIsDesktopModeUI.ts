import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EPageType, usePageType } from '../hocs/PageType';

import { useMedia } from './useStyle';

export const useIsDesktopModeUIInTabPages = platformEnv.isNative
  ? () => false
  : () => {
      const { gtMd } = useMedia();
      const pageType = usePageType();
      return (
        gtMd &&
        pageType !== EPageType.modal &&
        pageType !== EPageType.fullScreen &&
        pageType !== EPageType.onboarding
      );
    };
