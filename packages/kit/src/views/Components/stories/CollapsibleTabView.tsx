import { useCallback, useMemo, useState } from 'react';

import { SafeAreaView } from 'react-native';

import {
  Badge,
  Box,
  Button,
  Center,
  FlatList,
  ListItem,
  ScrollView,
  Token,
  Typography,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { Network } from '@onekeyhq/engine/src/types/network';
import { freezedEmptyArray } from '@onekeyhq/shared/src/consts/sharedConsts';

import { useAppSelector } from '../../../hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ReactElement } from 'react';

function TokenList({ networks }: { networks: Network[] }) {
  console.log();

  const renderItem = useCallback(
    ({ item }: { item: Network }) => (
      <ListItem onPress={() => {}}>
        <ListItem.Column>
          <Token
            size={8}
            token={{
              logoURI: item.logoURI,
              name: item.name,
              symbol: item.name,
            }}
          />
        </ListItem.Column>
        <ListItem.Column
          text={{
            label: item.name,
          }}
          flex={1}
        />
        <ListItem.Column
          text={{
            label: <Badge size="sm" title={item.impl.toUpperCase()} />,
          }}
        />
      </ListItem>
    ),
    [],
  );

  return (
    <FlatList
      data={networks}
      renderItem={renderItem}
      keyExtractor={(item, index) => `${item.id}-${index}`}
    />
  );
}

function ContainerView({ children }: { children: ReactElement }) {
  if (platformEnv.isNative) {
    return <SafeAreaView>{children}</SafeAreaView>;
  }
  return children;
}

function CollapsibleTabView() {
  const networks =
    useAppSelector((s) => s.runtime.networks) ?? freezedEmptyArray;

  const [showNetworks, setShowNetworks] = useState<Network[]>(networks);

  const [headerHeight, setHeaderHeight] = useState(300);

  const headerHeightCall = useCallback(() => {
    setHeaderHeight((pre) => {
      if (pre === 200) {
        return 300;
      }
      return 200;
    });
  }, []);

  const loadMoreDataCall = useCallback(() => {
    setShowNetworks((pre) => [...pre, ...networks]);
  }, [networks]);

  const headerView = useMemo(() => {
    if (headerHeight === 200) {
      return (
        <Center bg="background-hovered" height={200}>
          <Box>Header View Simple</Box>
          <Box>{`Header Height ${headerHeight}`}</Box>
          <Box>{`Item Count ${showNetworks.length}`}</Box>
          <Button onPress={headerHeightCall}>切换高度</Button>
          <Button onPress={loadMoreDataCall}>添加数据</Button>
        </Center>
      );
    }

    return (
      <Center bg="background-hovered" height={300}>
        <Box>Header View Simple</Box>
        <Box>{`Header Height ${headerHeight}`}</Box>
        <Box>{`Item Count ${showNetworks.length}`}</Box>
        <Box>My High</Box>
        <Button onPress={headerHeightCall}>切换高度</Button>
        <Button onPress={loadMoreDataCall}>添加数据</Button>
      </Center>
    );
  }, [headerHeight, showNetworks.length, headerHeightCall, loadMoreDataCall]);

  return (
    <Box flex={1} w="full" h="full" bg="background-hovered">
      <ContainerView>
        <Tabs.Container headerView={headerView}>
          <Tabs.Tab name="tab1" label="我是 Tab1">
            <TokenList networks={showNetworks} />
          </Tabs.Tab>

          <Tabs.Tab name="tab2" label="我是 Tab2">
            <ScrollView>
              <Typography.Body1>Network 1</Typography.Body1>
              <TokenList networks={showNetworks} />

              <Typography.Body1>Network 2</Typography.Body1>
              <TokenList networks={showNetworks} />

              <Typography.Body1>End</Typography.Body1>
            </ScrollView>
          </Tabs.Tab>

          <Tabs.Tab name="tab3" label="我是 Tab3">
            <ScrollView>
              {showNetworks.flatMap((item, index) => (
                <Typography.Body1 key={`network-${index}`}>
                  {`${item.name}`}
                </Typography.Body1>
              ))}
            </ScrollView>
          </Tabs.Tab>

          <Tabs.Tab name="tab4" label="我是 Tab4" autoDestroy={3 * 1000 * 60}>
            <ScrollView>
              <Typography.Body1>ScrollView Simple</Typography.Body1>
              {showNetworks.flatMap((item, index) => (
                <ListItem onPress={() => {}} key={`network-${index}`}>
                  <ListItem.Column>
                    <Token
                      size={8}
                      token={{
                        logoURI: item.logoURI,
                        name: item.name,
                        symbol: item.name,
                      }}
                    />
                  </ListItem.Column>
                  <ListItem.Column
                    text={{
                      label: item.name,
                    }}
                    flex={1}
                  />
                  <ListItem.Column
                    text={{
                      label: item.tokenDisplayDecimals,
                    }}
                    flex={1}
                  />
                  <ListItem.Column
                    text={{
                      label: (
                        <Badge size="sm" title={item.impl.toUpperCase()} />
                      ),
                    }}
                  />
                </ListItem>
              ))}
              <Typography.Body1>End</Typography.Body1>
            </ScrollView>
          </Tabs.Tab>
        </Tabs.Container>
      </ContainerView>
    </Box>
  );
}

export default CollapsibleTabView;
