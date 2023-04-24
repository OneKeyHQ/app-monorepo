import { TabRoutes } from '../../routes/routesEnum';
import { ScreenMarketOrSwap } from '../Market/ScreenMarketOrSwap';

export function ScreenSwap() {
  return <ScreenMarketOrSwap marketTopTabName={TabRoutes.Swap} />;
}
