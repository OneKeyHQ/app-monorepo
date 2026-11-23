import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabEarnRoutes } from '@onekeyhq/shared/src/routes';
import type { IPoolTickRange } from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { pushEarnRouteOverSameName, safePushToEarnRoute } from '../earnUtils';
import {
  getNetworkIdByShareName,
  getShareNetworkParam,
} from '../utils/earnShareNetworkUtils';

// Entry points from the Earn home and other tabs. Pages inside the Pools
// flow push onto their own stack with navigation.push instead.
export const PoolsNavigation = {
  pushPools(navigation: IAppNavigation) {
    void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnPools);
  },
  pushPoolDetails(
    navigation: IAppNavigation,
    poolId: string,
    /** A range chosen before the page opens; its form starts with it */
    initialRange?: IPoolTickRange,
  ) {
    void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnPoolDetails, {
      poolId,
      initialRange,
    });
  },
  /** Another pool from a pool's page: Back returns to the one before */
  pushPairPool(navigation: IAppNavigation, poolId: string) {
    pushEarnRouteOverSameName(navigation, ETabEarnRoutes.EarnPoolDetails, {
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

// A pool page's link: /earn/pool/:network/:version/:poolKey, the network by
// its share name as protocol links use it

export function buildPoolShareLink(
  pool: Pick<IPool, 'networkId' | 'version' | 'poolKey'>,
  { isDevMode = false }: { isDevMode?: boolean } = {},
) {
  let origin = WEB_APP_URL;
  if (platformEnv.isWeb) {
    origin = globalThis.location.origin;
  } else if (isDevMode) {
    origin = WEB_APP_URL_DEV;
  }
  const network = getShareNetworkParam(pool.networkId);
  return `${origin}/earn/pool/${network}/${pool.version}/${pool.poolKey}`;
}

/** The pool id a shared link names, or undefined for an unknown network */
export function parsePoolShareParams({
  network,
  version,
  poolKey,
}: {
  network: string;
  version: string;
  poolKey: string;
}) {
  const networkId = getNetworkIdByShareName(network);
  if (!networkId || !version || !poolKey) {
    return undefined;
  }
  // Pool keys are lowercase hex; a pasted link may carry mixed case
  return `${networkId}:uniswap:${version.toLowerCase()}:${poolKey.toLowerCase()}`;
}
