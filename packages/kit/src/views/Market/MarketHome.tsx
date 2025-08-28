import { useMarketV2Enabled } from '../../hooks/useMarketV2Enabled';

import MarketHomeV1 from './MarketHomeV1/MarketHome';
import { MarketHomeV2 } from './MarketHomeV2';

export default function MarketHome(props: any) {
  const enableMarketV2 = useMarketV2Enabled();

  if (enableMarketV2) {
    return <MarketHomeV2 {...props} />;
  }

  return <MarketHomeV1 {...props} />;
}
