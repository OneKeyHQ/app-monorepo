import { TabRoutes } from '../../routes/routesEnum';

import { ScreenMarketOrSwap } from './ScreenMarketOrSwap';

export function ScreenMarket() {
  return <ScreenMarketOrSwap routeName={TabRoutes.Market} />;
}
