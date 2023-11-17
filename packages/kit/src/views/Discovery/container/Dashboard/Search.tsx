import { useMemo, useState } from 'react';

import {
  Button,
  ListView,
  ModalContainer,
  SearchBar,
  Stack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { ETabRoutes } from '../../../../routes/Root/Tab/Routes';
import { openMatchDApp } from '../../utils/gotoSite';

import { mockData } from './dataSource';

function SearchModal() {
  const navigation = useAppNavigation();
  const [value, setValue] = useState('');
  // const [dataSource, setDataSource] = useState([]);

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

  console.log(dataSource);

  return (
    <ModalContainer>
      <Stack p="$4">
        <SearchBar value={value} onChangeText={setValue} />
      </Stack>

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
                // @ts-expect-error
                openMatchDApp({ dapp: item, isNewWindow: true });
                if (platformEnv.isDesktop) {
                  navigation.switchTab(ETabRoutes.MultiTabBrowser);
                } else {
                  navigation.pop();
                }
              }}
            >
              {item.name}
            </Button>
          )}
        />
      </Stack>
    </ModalContainer>
  );
}

export default SearchModal;
