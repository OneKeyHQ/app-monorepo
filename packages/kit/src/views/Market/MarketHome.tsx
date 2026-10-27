import { TradingViewEmbedGlobalPreload } from '../../provider/TradingViewEmbedGlobalPreload';

import { MarketHomeV2 } from './MarketHomeV2';

export default function MarketHome(props: any) {
  return (
    <>
      <TradingViewEmbedGlobalPreload />
      <MarketHomeV2 {...props} />
    </>
  );
}
