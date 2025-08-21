import { TradingView } from '@onekeyhq/kit/src/components/TradingView';

import { Layout } from './utils/Layout';

const TradingViewGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="TradingView"
    elements={[
      {
        title: '默认状态',
        element: (
          <TradingView
            mode="realtime"
            baseToken="BTC"
            targetToken="USDT"
            identifier="binance"
            h={400}
            w="100%"
            decimal={8}
            onLoadEnd={() => console.log('onLoadEnd')}
          />
        ),
      },
    ]}
  />
);

export default TradingViewGallery;
