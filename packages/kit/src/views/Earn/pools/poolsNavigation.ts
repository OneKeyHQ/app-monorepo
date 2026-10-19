import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETabEarnRoutes } from '@onekeyhq/shared/src/routes';

import { safePushToEarnRoute } from '../earnUtils';

// Entry points from the Earn home and other tabs. Pages inside the Pools
// flow push onto their own stack with navigation.push instead.
export const PoolsNavigation = {
  pushPools(navigation: IAppNavigation) {
    void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnPools);
  },
  pushPoolDetails(navigation: IAppNavigation, poolId: string) {
    void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnPoolDetails, {
      poolId,
    });
  },
  pushPosition(navigation: IAppNavigation, positionId: string) {
    void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnPoolPosition, {
      positionId,
    });
  },
  pushRemove(navigation: IAppNavigation, positionId: string) {
    void safePushToEarnRoute(
      navigation,
      ETabEarnRoutes.EarnPoolRemoveLiquidity,
      { positionId },
    );
  },
  pushExit(
    navigation: IAppNavigation,
    params: { networkId?: string; positionIds?: string[] } = {},
  ) {
    void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnPoolsExit, params);
  },
  pushTask(navigation: IAppNavigation, taskId: string) {
    void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnPoolTask, {
      taskId,
    });
  },
};
