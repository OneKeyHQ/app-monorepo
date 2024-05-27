import type { ReactElement } from 'react';
import { memo, useMemo } from 'react';

import { Stack, Tab, useMedia } from '@onekeyhq/components';
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
    <Stack $gtMd={{ pt: '$10', px: '$5' }} py="$5">
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
