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
}: {
  token: IMarketTokenDetail;
  pools: IMarketDetailPool[];
}) {
  const { md } = useMedia();

  const tabConfig = useMemo(
    () =>
      [
        pools?.length
          ? {
              title: 'Pools',
              // eslint-disable-next-line react/no-unstable-nested-components
              page: () => <MarketDetailPools token={token} pools={pools} />,
            }
          : undefined,
        md
          ? {
              title: 'Overview',
              // eslint-disable-next-line react/no-unstable-nested-components
              page: () => <MarketDetailOverview token={token} pools={pools} />,
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
    <Stack mt={100}>
      <Tab.Page
        data={tabConfig}
        onSelectedPageIndex={(index: number) => {
          console.log('选中', index);
        }}
      />
    </Stack>
  );
}

export const TokenDetailTabs = memo(BasicTokenDetailTabs);
