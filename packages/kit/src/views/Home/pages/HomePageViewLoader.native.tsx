import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import { HomeLaunchSkeleton } from './HomeLaunchSkeleton';

import type { INativeHomePageViewProps } from '../NativeHomePageView.types';

export const HomePageView = LazyLoad<INativeHomePageViewProps>(
  async () => {
    const { HomePageView: ReactHomePageView } = await import('./HomePageView');
    return { default: ReactHomePageView };
  },
  undefined,
  <HomeLaunchSkeleton />,
);
