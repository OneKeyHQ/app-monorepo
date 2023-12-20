/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useState } from 'react';

import {
  Badge,
  Button,
  Image,
  ListItem,
  ListView,
  Page,
  SearchBar,
  SectionList,
  Skeleton,
  Stack,
  Tab,
  Text,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import type {
  ICategory,
  IDApp,
  IDAppTag,
  IDiscoveryBanner,
  IDiscoveryHomePageData,
  IDiscoveryListParams,
} from '@onekeyhq/shared/types/discovery';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import { EDiscoveryModalRoutes } from '../../router/Routes';

const RecommendListContainer = ({
  onContentSizeChange,
}: {
  onContentSizeChange: ((w: number, h: number) => void) | undefined;
}) => {
  const { result } = usePromiseResult(async () => {
    const data =
      await backgroundApiProxy.serviceDiscovery.fetchDiscoveryHomePageData();
    return data;
  }, []);

  const dataSource = useMemo(
    () => result?.categories.map((i) => ({ ...i, data: i.dapps })) ?? [],
    [result?.categories],
  );

  return (
    <SectionList
      estimatedItemSize="$10"
      onContentSizeChange={onContentSizeChange}
      sections={dataSource}
      renderSectionHeader={({ section: { name } }) => (
        <Stack p="$3" bg="$bg">
          <Text variant="$headingXs">{name}</Text>
        </Stack>
      )}
      renderItem={({ item }) => (
        <ListItem
          avatarProps={{
            src: item.logo ?? item.originLogo,
            fallbackProps: {
              children: <Skeleton w="$10" h="$10" />,
            },
          }}
          title={item.name}
          onPress={() => {}}
        >
          {item.tags?.map((tag: IDAppTag) => (
            <Badge type="success" size="sm">
              <Text>{tag.name}</Text>
            </Badge>
          ))}
        </ListItem>
      )}
    />
  );
};

const DiscoveryListHeader = ({
  dataSource,
  activeId,
  setActiveId,
  onContentSizeChange,
}: {
  dataSource: ICategory[];
  activeId: string;
  setActiveId: Dispatch<SetStateAction<string>>;
  onContentSizeChange: ((w: number, h: number) => void) | undefined;
}) => (
  <ListView
    data={dataSource}
    estimatedItemSize="$10"
    horizontal
    showsHorizontalScrollIndicator={false}
    keyExtractor={(item) => item.id}
    renderItem={({ item }) => (
      <ListItem
        onPress={() => setActiveId(item.id)}
        bg={activeId === item.id ? '$bgActive' : '$bg'}
      >
        <Text>{item.name}</Text>
      </ListItem>
    )}
    onContentSizeChange={onContentSizeChange}
  />
);

const DiscoveryListContainer = ({
  onContentSizeChange,
}: {
  onContentSizeChange: ((w: number, h: number) => void) | undefined;
}) => {
  const [activeId, setActiveId] = useState('');
  const [dAppListDataSource, setDAppListDataSource] = useState<IDApp[]>([]);
  const { result } = usePromiseResult(async () => {
    const data = await backgroundApiProxy.serviceDiscovery.fetchCategoryList();
    setActiveId(data[0].id);
    setDAppListDataSource(data[0].dapps);
    return data;
  }, []);

  const { result: dAppListResult } = usePromiseResult(async () => {
    if (!activeId) return;
    const dAppList =
      await backgroundApiProxy.serviceDiscovery.fetchDAppListByCategory({
        category: activeId,
      });
    return dAppList;
  }, [activeId]);

  useEffect(() => {
    if (Array.isArray(dAppListResult?.data)) {
      setDAppListDataSource(dAppListResult.data);
    }
  }, [dAppListResult?.data]);

  const headerDataSource = useMemo(() => result ?? [], [result]);
  return (
    <ListView
      data={dAppListDataSource}
      estimatedItemSize="$10"
      ListHeaderComponent={
        <DiscoveryListHeader
          dataSource={headerDataSource}
          onContentSizeChange={onContentSizeChange}
          activeId={activeId}
          setActiveId={setActiveId}
        />
      }
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => (
        <ListItem
          avatarProps={{
            src: item.logo ?? item.originLogo,
            fallbackProps: {
              children: <Skeleton w="$10" h="$10" />,
            },
          }}
          title={item.name}
          onPress={() => {}}
        />
      )}
      onContentSizeChange={onContentSizeChange}
    />
  );
};

function DashboardHeader({ banners }: { banners?: IDiscoveryBanner[] }) {
  return (
    <Stack p="$4">
      <Stack>
        <Text variant="$headingXl">Banner</Text>
        {banners?.map((banner) => (
          <Image
            width="$30"
            height="$10"
            source={{
              uri: banner.src,
            }}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function Dashboard() {
  const navigation = useAppNavigation();
  const { result } = usePromiseResult(async () => {
    const data =
      await backgroundApiProxy.serviceDiscovery.fetchDiscoveryHomePageData();
    return data;
  }, []);

  const data = useMemo(
    () => [
      {
        title: '推荐',
        page: RecommendListContainer,
      },
      {
        title: '探索',
        page: DiscoveryListContainer,
      },
    ],
    [],
  );
  return (
    <Page>
      <Page.Body>
        <YStack p="$2" alignItems="center" justifyContent="center">
          <Stack
            $md={{
              width: '100%',
            }}
            onPress={() => {
              console.log('onPress');
              navigation.pushModal(EModalRoutes.DiscoveryModal, {
                screen: EDiscoveryModalRoutes.SearchModal,
              });
            }}
          >
            <SearchBar readonly />
          </Stack>
          <Button
            testID="fake-search-modal"
            onPress={() => {
              console.log('onPress');
              navigation.pushModal(EModalRoutes.DiscoveryModal, {
                screen: EDiscoveryModalRoutes.SearchModal,
              });
            }}
          >
            Search Modal
          </Button>
          <Button
            testID="bookmark-modal"
            onPress={() => {
              console.log('onPress');
              navigation.pushModal(EModalRoutes.DiscoveryModal, {
                screen: EDiscoveryModalRoutes.BookmarkListModal,
              });
            }}
          >
            Bookmark Modal
          </Button>
          <Button
            testID="history-modal"
            onPress={() => {
              console.log('onPress');
              navigation.pushModal(EModalRoutes.DiscoveryModal, {
                screen: EDiscoveryModalRoutes.HistoryListModal,
              });
            }}
          >
            History Modal
          </Button>
        </YStack>
        <Tab
          data={data}
          initialScrollIndex={0}
          ListHeaderComponent={<DashboardHeader banners={result?.banners} />}
          nestedScrollEnabled
          headerProps={{
            itemContainerStyle: { flex: 1 },
            cursorStyle: { width: '70%', h: '$0.5', bg: '$text' },
          }}
        />
      </Page.Body>
    </Page>
  );
}

export default Dashboard;
