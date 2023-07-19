import { TabRoutes } from '../../routes/routesEnum';
import { ScreenMarketOrSwap } from '../Market/ScreenMarketOrSwap';
import { memo } from 'react';

const ScreenSwap = () => <ScreenMarketOrSwap routeName={TabRoutes.Swap} />;

export default memo(ScreenSwap);
