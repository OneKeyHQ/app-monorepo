import type { ReactElement } from 'react';
import { memo, useMemo, useState } from 'react';

import { Stack, Tab, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

import { MarketDetailLinks } from './MarketDetailLinks';
import { MarketDetailOverview } from './MarketDetailOverview';
import { MarketDetailPools } from './MarketDetailPools';

function BasicTokenDetailTabs({
  token,
  listHeaderComponent,
}: {
  token?: IMarketTokenDetail;
  listHeaderComponent?: ReactElement;
}) {
  const { md } = useMedia();

  const { result: pools, isLoading } = usePromiseResult(
    () =>
      token?.symbol
        ? backgroundApiProxy.serviceMarket.fetchPools(token?.symbol)
        : Promise.resolve(undefined),
    [token?.symbol],
  );

  const tabConfig = useMemo(
    () =>
      [
        pools?.length
          ? {
              title: 'Pools',
              // eslint-disable-next-line react/no-unstable-nested-components
              page: () => <MarketDetailPools pools={pools} />,
            }
          : undefined,
        md
          ? {
              title: 'Overview',
              // eslint-disable-next-line react/no-unstable-nested-components
              page: () => (
                <Stack px="$5">
                  <MarketDetailOverview token={token} pools={pools} />
                </Stack>
              ),
            }
          : undefined,
        {
          title: 'Links',
          // eslint-disable-next-line react/no-unstable-nested-components
          page: () => <MarketDetailLinks token={token} />,
        },
      ].filter(Boolean),
    [md, pools, token],
  );
  return (
    <Stack $gtMd={{ pt: '$8', px: '$5' }} py="$5">
      <Tab.Page
        data={tabConfig}
        ListHeaderComponent={listHeaderComponent}
        onSelectedPageIndex={(index: number) => {
          console.log('选中', index);
        }}
      />
    </Stack>
  );
}

export const TokenDetailTabs = memo(BasicTokenDetailTabs);
