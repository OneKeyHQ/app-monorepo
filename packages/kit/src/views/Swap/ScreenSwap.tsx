import { memo } from 'react';

import { TabRoutes } from '../../routes/routesEnum';
import { ScreenMarketOrSwap } from '../Market/ScreenMarketOrSwap';

const ScreenSwap = () => <ScreenMarketOrSwap routeName={TabRoutes.Swap} />;

export default memo(ScreenSwap);
