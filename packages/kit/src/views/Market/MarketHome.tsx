import { useEffect, useMemo, useState } from 'react';

import { Icon, Page, Tab, useMedia } from '@onekeyhq/components';
import type { IMarketCategory } from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { MarketHomeHeader } from './components/MarketHomeHeader';
import { MarketHomeHeader as MDMarketHomeHeader } from './components/MarketHomeHeader.md';
import { MarketHomeList } from './components/MarketHomeList';
import { MarketWatchList } from './components/MarketWatchList';

function MarketHome() {
  const [categories, setCategories] = useState<IMarketCategory[]>([]);
  useEffect(() => {
    void backgroundApiProxy.serviceMarket.fetchCategories().then((response) => {
      setCategories(response);
    });
  }, []);

  const { gtMd } = useMedia();

  const tabConfig = useMemo(
    () =>
      categories?.map((category, index) => ({
        title: category.name,
        // eslint-disable-next-line react/no-unstable-nested-components
        page: () =>
          index === 0 ? (
            <MarketWatchList category={category} />
          ) : (
            <MarketHomeList category={category} />
          ),
      })) || [],
    [categories],
  );
  return (
    <Page>
      {gtMd ? <MarketHomeHeader /> : <MDMarketHomeHeader />}
      <Page.Body>
        <Tab.Page
          data={tabConfig}
          headerProps={{
            contentContainerStyle: { paddingRight: '$5' },
            renderItem: (item, index, titleStyle) =>
              index === 0 && !gtMd ? (
                <Icon name="StarOutline" />
              ) : (
                <Tab.SelectedLabel {...(titleStyle as any)} />
              ),
          }}
          onSelectedPageIndex={(index: number) => {
            console.log('选中', index);
          }}
        />
      </Page.Body>
    </Page>
  );
}

export default MarketHome;
