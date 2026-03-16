import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, Table, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { usePerpsNavigation } from '../hooks/usePerpsNavigation';
import {
  type IMarketPerpsToken,
  mapServerToken,
} from '../MarketHomeV2/components/MarketPerpsList/hooks/useMarketPerpsTokenList';
import { usePerpsColumns } from '../MarketHomeV2/components/MarketPerpsList/hooks/usePerpsColumns';

export function PerpsTokenListSection({
  tokenListId,
}: {
  tokenListId: string;
}) {
  const { navigateToPerps } = usePerpsNavigation(
    EPerpPageEnterSource.MarketBanner,
  );
  const perpsColumns = usePerpsColumns();
  const { md } = useMedia();
  const intl = useIntl();

  const { result: perpsResult, isLoading } = usePromiseResult(
    async () => {
      const [tokenListData, tokenSearchAliases] = await Promise.all([
        backgroundApiProxy.serviceMarketV2.fetchMarketBannerPerpsTokenList({
          tokenListId,
        }),
        backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases(),
      ]);
      return { tokenListData, tokenSearchAliases };
    },
    [tokenListId],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
      watchLoading: true,
    },
  );

  const tokens = useMemo(() => {
    if (!perpsResult?.tokenListData?.tokens) return [];
    return perpsResult.tokenListData.tokens.map((t) =>
      mapServerToken(t, perpsResult.tokenSearchAliases),
    );
  }, [perpsResult]);

  const showSkeleton = Boolean(isLoading) && tokens.length === 0;

  const TableEmptyComponent = useMemo(() => {
    if (isLoading) return null;
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }, [isLoading, intl]);

  return (
    <Stack flex={1} width="100%">
      <Stack
        flex={1}
        className="normal-scrollbar"
        style={{
          paddingTop: 4,
          overflowX: 'auto',
          ...(md ? { marginLeft: 8, marginRight: 8 } : {}),
        }}
      >
        <Stack flex={1} minHeight={platformEnv.isNative ? undefined : 400}>
          {showSkeleton ? (
            <Table.Skeleton
              columns={perpsColumns}
              count={20}
              rowProps={{ minHeight: '$14' }}
            />
          ) : (
            <Table<IMarketPerpsToken>
              stickyHeader
              columns={perpsColumns}
              dataSource={tokens}
              keyExtractor={(item) => item.name}
              estimatedItemSize="$14"
              extraData={tokens.length}
              TableEmptyComponent={TableEmptyComponent}
              onRow={(item) => ({
                onPress: () => navigateToPerps(item.name),
              })}
            />
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}
