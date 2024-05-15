import { useMemo } from 'react';

import { Page, Tab } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

import { MarketHomeHeader } from './components/MarketHomeHeader';
import { MarketHomeList } from './components/MarketHomeList';

function MarketHome() {
  const { result: categories } = usePromiseResult(
    async () => backgroundApiProxy.serviceMarket.fetchCategories(),
    [],
  );

  const tabConfig = useMemo(
    () =>
      categories?.map((category) => ({
        title: category.name,
        // eslint-disable-next-line react/no-unstable-nested-components
        page: () => <MarketHomeList category={category} />,
      })) || [],
    [categories],
  );
  return (
    <Page>
      <MarketHomeHeader />
      <Page.Body>
        <Tab.Page
          data={tabConfig}
          onSelectedPageIndex={(index: number) => {
            console.log('选中', index);
          }}
        />
      </Page.Body>
    </Page>
  );
}

export default MarketHome;
