import { memo, useMemo } from 'react';

import { Tab, useMedia } from '@onekeyhq/components';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { MarketDetailLinks } from './MarketDetailLinks';
import { MarketDetailOverview } from './MarketDetailOverview';

function BasicTokenDetailTabs({ token }: { token: IMarketTokenDetail }) {
  const { md } = useMedia();

  const tabConfig = useMemo(
    () =>
      [
        {
          title: 'Pools',
          // eslint-disable-next-line react/no-unstable-nested-components
          page: () => <MarketDetailOverview token={token} />,
        },
        md
          ? {
              title: 'Overview',
              // eslint-disable-next-line react/no-unstable-nested-components
              page: () => <MarketDetailOverview token={token} />,
            }
          : undefined,
        {
          title: 'Links',
          // eslint-disable-next-line react/no-unstable-nested-components
          page: () => <MarketDetailLinks token={token} />,
        },
      ].filter(Boolean),
    [md, token],
  );
  return (
    <Tab.Page
      data={tabConfig}
      onSelectedPageIndex={(index: number) => {
        console.log('选中', index);
      }}
    />
  );
}

export const TokenDetailTabs = memo(BasicTokenDetailTabs);
