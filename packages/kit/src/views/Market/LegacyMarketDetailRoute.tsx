import { useMemo } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, Spinner, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabMarketParamList } from '@onekeyhq/shared/src/routes';

import { MarketDetailV2 } from './MarketDetailV2';
import { getLegacyMarketDetailV2RouteParams } from './utils/legacyMarketNetwork';

type ILegacyMarketDetailRouteProps = IPageScreenProps<
  ITabMarketParamList,
  ETabMarketRoutes.MarketDetail
>;

export default function LegacyMarketDetailRoute(
  props: ILegacyMarketDetailRouteProps,
) {
  const { route } = props;
  const marketTokenId = route.params.token;
  const { result: legacyDetail } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(marketTokenId),
    [marketTokenId],
    {
      checkIsFocused: false,
    },
  );
  const v2Route = useMemo(() => {
    if (!legacyDetail) {
      return undefined;
    }
    return {
      ...route,
      name: ETabMarketRoutes.MarketDetailV2,
      params: getLegacyMarketDetailV2RouteParams({
        marketTokenId,
        token: legacyDetail,
      }),
    };
  }, [legacyDetail, marketTokenId, route]);

  if (!v2Route) {
    return (
      <Page>
        <Page.Header />
        <Page.Body>
          <Stack flex={1} alignItems="center" justifyContent="center">
            <Spinner size="large" />
          </Stack>
        </Page.Body>
      </Page>
    );
  }

  const v2Props = {
    ...props,
    route: v2Route,
  } as unknown as IPageScreenProps<
    ITabMarketParamList,
    ETabMarketRoutes.MarketDetailV2
  >;

  return <MarketDetailV2 {...v2Props} />;
}
