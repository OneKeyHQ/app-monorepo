import { useCallback, useMemo } from 'react';

import { Dimensions } from 'react-native';

import { Page, Tab } from '@onekeyhq/components';

import { MarketHomeHeader } from './components/MarketHomeHeader';
import { MarketHomeList } from './components/MarketHomeList';

const windowWidth = Dimensions.get('window').width;

function MarketHome() {
  const tabConfig = useMemo(
    () => [
      { title: 'WatchList', page: MarketHomeList },
      { title: 'Trending', page: MarketHomeList },
      { title: 'New', page: MarketHomeList },
    ],
    [],
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
