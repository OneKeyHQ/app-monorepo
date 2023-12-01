import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import {
  ListItem,
  ListView,
  Page,
  Skeleton,
  Stack,
} from '@onekeyhq/components';
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Search Modal',
      headerSearchBarOptions: {
        autoFocus: true,
        placeholder: 'Search',
        inputType: 'text',
        hideNavigationBar: true,
        hideWhenScrolling: false,
        onChangeText: ({ nativeEvent }) => {
          setValue(nativeEvent.text);
        },
      },
    });
  }, [navigation]);

  const handleOnPress = useCallback(
    (item: {
      url: string;
      name: string;
      desc?: string;
      _id: string;
      logoURL: string;
    }) => {
      setDisplayHomePage(false);

      // @ts-expect-error
      openMatchDApp({ dapp: item, isNewWindow: true });
      if (platformEnv.isDesktop) {
        navigation.switchTab(ETabRoutes.MultiTabBrowser);
      } else {
        navigation.pop();
      }
    },
    [setDisplayHomePage, navigation],
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
        desc: '',
        url: value,
        logoURL: 'https://nutty-tomato-parrot.faviconkit.com/google.com/256',
      },
      ...mockData,
    ];
  }, [value]);

  return (
    <Page skipLoading>
      <Page.Body>
        <Stack flex={1}>
          <ListView
            height="100%"
            estimatedItemSize="$10"
            data={dataSource}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <ListItem
                avatarProps={{
                  src: item.logoURL,
                  fallbackProps: {
                    children: <Skeleton w="$10" h="$10" />,
                  },
                }}
                title={item.name}
                subtitle={item.desc}
                subtitleProps={{
                  numberOfLines: 1,
                }}
                testID={`search-modal-${item.name.toLowerCase()}`}
                onPress={() => {
                  handleOnPress(item);
                }}
              />
            )}
          />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(SearchModal);
