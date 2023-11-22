import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button, ListView, Page, SearchBar, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { ETabRoutes } from '../../../../routes/Root/Tab/Routes';
import useWebTabAction from '../../hooks/useWebTabAction';
import { useDisplayHomePageFlag } from '../../hooks/useWebTabs';
import { openMatchDApp } from '../../utils/gotoSite';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import { mockData } from './dataSource';

function SearchModal() {
  const navigation = useAppNavigation();
  const [value, setValue] = useState('');
  const { setDisplayHomePage } = useWebTabAction();
  const { displayHomePage } = useDisplayHomePageFlag();

  useEffect(() => {
    console.log('SearchModal renderer ===> : ', displayHomePage);
  }, [displayHomePage]);

  const handleOnPress = useCallback(
    (item: { url: string; name: string; _id: string; logoURL: string }) => {
      console.log(1, 'displayHomePage', displayHomePage);
      setDisplayHomePage(false);

      // @ts-expect-error
      openMatchDApp({ dapp: item, isNewWindow: true });
      if (platformEnv.isDesktop) {
        navigation.switchTab(ETabRoutes.MultiTabBrowser);
      } else {
        navigation.pop();
      }
    },
    [displayHomePage, setDisplayHomePage, navigation],
  );

  const dataSource = useMemo(() => {
    // 如果 value 为空，返回 mockData 的数据
    // 如果 value 有值，则插入至 dataSource 的最前面，生成一个 id
    if (!value) {
      return mockData;
    }
    return [
      {
        _id: value,
        name: value,
        url: value,
        logoURL: '',
      },
      ...mockData,
    ];
  }, [value]);

  return (
    <Page>
      <Page.Header
        headerTitle="Search Modal"
        headerSearchBarOptions={{
          placeholder: 'search',
          inputType: 'text',
          onChangeText: ({ nativeEvent }) => {
            setValue(nativeEvent.text);
          },
        }}
      />
      <Page.Body>
        <Stack flex={1}>
          <ListView
            height="100%"
            estimatedItemSize="$10"
            contentContainerStyle={{
              bg: '$borderLight',
              m: '$4',
            }}
            data={dataSource}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <Button
                onPress={() => {
                  handleOnPress(item);
                }}
              >
                {item.name}
              </Button>
            )}
          />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(SearchModal);
