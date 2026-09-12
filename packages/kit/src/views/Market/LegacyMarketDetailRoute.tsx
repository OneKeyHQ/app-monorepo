import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Page,
  SizableText,
  Spinner,
  Stack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabMarketParamList } from '@onekeyhq/shared/src/routes';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { MarketDetailV2 } from './MarketDetailV2';
import { getLegacyMarketDetailV2RouteParams } from './utils/legacyMarketNetwork';

type ILegacyMarketDetailRouteProps = IPageScreenProps<
  ITabMarketParamList,
  ETabMarketRoutes.MarketDetail
>;

type ILegacyDetailRequestState =
  | { status: 'pending' }
  | { status: 'success'; data: IMarketTokenDetail }
  | { status: 'error' };

export default function LegacyMarketDetailRoute(
  props: ILegacyMarketDetailRouteProps,
) {
  const intl = useIntl();
  const { route } = props;
  const marketTokenId = route.params.token;
  const {
    result: legacyDetailResult,
    isLoading,
    run: retry,
  } = usePromiseResult<ILegacyDetailRequestState>(
    async () => {
      try {
        const data =
          await backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(
            marketTokenId,
          );
        return { status: 'success', data };
      } catch (_error) {
        return { status: 'error' };
      }
    },
    [marketTokenId],
    {
      initResult: { status: 'pending' },
      watchLoading: true,
      checkIsFocused: false,
    },
  );
  const legacyDetail =
    legacyDetailResult.status === 'success'
      ? legacyDetailResult.data
      : undefined;
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

  if (legacyDetailResult.status === 'error') {
    return (
      <Page>
        <Page.Header />
        <Page.Body>
          <Stack flex={1} alignItems="center" justifyContent="center" gap="$2">
            <SizableText color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.global_unknown_error_retry_message,
              })}
            </SizableText>
            <Button
              testID="legacy-market-detail-retry"
              size="small"
              variant="tertiary"
              loading={isLoading}
              onPress={() => void retry()}
            >
              {intl.formatMessage({ id: ETranslations.global_retry })}
            </Button>
          </Stack>
        </Page.Body>
      </Page>
    );
  }

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
