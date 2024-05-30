import type { ReactElement } from 'react';
import { memo, useMemo } from 'react';

import { Stack, Tab, useMedia } from '@onekeyhq/components';
import type { ITabPageProps } from '@onekeyhq/components';
import type {
  IMarketDetailPool,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import { MarketDetailLinks } from './MarketDetailLinks';
import { MarketDetailOverview } from './MarketDetailOverview';
import { MarketDetailPools } from './MarketDetailPools';

function BasicTokenDetailTabs({
  token,
  pools,
  listHeaderComponent,
}: {
  token: IMarketTokenDetail;
  pools: IMarketDetailPool[];
  listHeaderComponent?: ReactElement;
}) {
  const { md } = useMedia();

  const tabConfig = useMemo(
    () =>
      [
        pools?.length
          ? {
              title: 'Pools',
              // eslint-disable-next-line react/no-unstable-nested-components
              page: (props: ITabPageProps) => (
                <MarketDetailPools {...props} pools={pools} />
              ),
            }
          : undefined,
        md
          ? {
              title: 'Overview',
              // eslint-disable-next-line react/no-unstable-nested-components
              page: (props: ITabPageProps) => (
                <Stack px="$5">
                  <MarketDetailOverview
                    {...props}
                    token={token}
                    pools={pools}
                  />
                </Stack>
              ),
            }
          : undefined,
        {
          title: 'Links',
          // eslint-disable-next-line react/no-unstable-nested-components
          page: (props: ITabPageProps) => (
            <MarketDetailLinks {...props} token={token} />
          ),
        },
      ].filter(Boolean),
    [md, pools, token],
  );
  return (
    <Tab
      $gtMd={{ mt: '$8', mx: '$5' }}
      mt="$5"
      data={tabConfig}
      ListHeaderComponent={listHeaderComponent}
      onSelectedPageIndex={(index: number) => {
        console.log('选中', index);
      }}
    />
  );
}

export const TokenDetailTabs = memo(BasicTokenDetailTabs);
