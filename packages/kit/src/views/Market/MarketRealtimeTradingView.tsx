import { Page, Stack } from '@onekeyhq/components';
import type { IPageScreenProps } from '@onekeyhq/components';
import { TradingView } from '@onekeyhq/kit/src/components/TradingView';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';

export default function MarketRealtimeTradingView({
  route,
}: IPageScreenProps<
  ITabMarketParamList,
  ETabMarketRoutes.MarketRealTimeTradingView
>) {
  const { symbol } = route.params;
  return (
    <Page>
      <Page.Header title="real time" />
      <Page.Body>
        <TradingView flex={1} mode="realtime" symbol={symbol} />
      </Page.Body>
    </Page>
  );
}
