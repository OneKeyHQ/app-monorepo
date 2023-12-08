import type { IModalRootNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { iOSFullScreenTestModalRouter } from '../../views/iOSFullScreenTestModal/router';

import { EIOSFullScreenModalRoutes } from './type';

const router: IModalRootNavigatorConfig<EIOSFullScreenModalRoutes>[] = [];

// Pages in Dev Mode
if (platformEnv.isDev) {
  router.push({
    name: EIOSFullScreenModalRoutes.iOSFullScreenTestModal,
    children: iOSFullScreenTestModalRouter,
  });
}

export const iOSFullScreenRouter = router;
