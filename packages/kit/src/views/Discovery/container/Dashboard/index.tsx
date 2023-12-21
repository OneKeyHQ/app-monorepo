/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Badge,
  IconButton,
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
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { ETabRoutes } from '@onekeyhq/kit/src/routes/Tab/type';
import {
  useBrowserBookmarkAction,
  useBrowserHistoryAction,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import type {
  ICategory,
  IDApp,
  IDAppTag,
  IDiscoveryBanner,
} from '@onekeyhq/shared/types/discovery';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import { EDiscoveryModalRoutes } from '../../router/Routes';
import { getUrlIcon } from '../../utils/explorerUtils';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IBrowserBookmark, IBrowserHistory } from '../../types';

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

function DashboardHeader({
  banners,
  bookmarkData,
  historyData,
  handleHeaderMorePress,
  handleSearchBarPress,
}: {
  banners?: IDiscoveryBanner[];
  bookmarkData?: IBrowserBookmark[];
  historyData?: IBrowserHistory[];
  handleSearchBarPress: () => void;
  handleHeaderMorePress: (tabIndex: number) => void;
}) {
  const [tabIndex, setTabIndex] = useState(0);
  const bookmarks = useMemo(() => bookmarkData ?? [], [bookmarkData]);
  const histories = useMemo(() => historyData ?? [], [historyData]);
  return (
    <Stack p="$4">
      <Text variant="$headingXl" py="$2">
        探索DApp
      </Text>
      <Stack
        pb="$2"
        $md={{
          width: '100%',
        }}
        onPress={() => {
          handleSearchBarPress();
        }}
      >
        <SearchBar readonly />
      </Stack>
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
      <XStack justifyContent="space-between">
        <Tab.Header
          data={[{ title: '书签' }, { title: '历史' }]}
          onSelectedPageIndex={(index: number) => {
            setTabIndex(index);
          }}
        />
        <IconButton
          size="small"
          icon="DotHorOutline"
          variant="tertiary"
          focusStyle={undefined}
          p="$0.5"
          m={-3}
          onPress={() => {
            handleHeaderMorePress(tabIndex);
          }}
        />
      </XStack>
      <ListView
        estimatedItemSize="$10"
        horizontal
        data={tabIndex === 0 ? bookmarks : histories}
        keyExtractor={(item) =>
          tabIndex === 0 ? item.url : (item as IBrowserHistory).id
        }
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <YStack
            maxWidth="$20"
            alignItems="center"
            justifyContent="center"
            p="$4"
            onPress={() => {}}
          >
            <ListItem.Avatar.Component
              src={getUrlIcon(item.url)}
              fallbackProps={{
                children: <Skeleton w="$10" h="$10" />,
              }}
              circular
            />
            <Text
              flex={1}
              minHeight="$8"
              numberOfLines={1}
              mt="$2"
              color="$text"
              variant="$bodyMd"
            >
              {item.title}
            </Text>
          </YStack>
        )}
      />
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
  const { getBookmarkData } = useBrowserBookmarkAction().current;
  const { getHistoryData } = useBrowserHistoryAction().current;
  const { result: bookmarkData, run: refreshBrowserBookmark } =
    usePromiseResult(async () => {
      const bookmarks = await getBookmarkData();
      return bookmarks.slice(0, 8);
    }, [getBookmarkData]);

  const { result: historyData, run: refreshBrowserHistory } =
    usePromiseResult(async () => {
      const histories = await getHistoryData();
      return histories.slice(0, 8);
    }, [getHistoryData]);

  const handleSearchBarPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.SearchModal,
    });
  }, [navigation]);
  const handleHeaderMorePress = useCallback(
    (tabIndex: number) => {
      navigation.pushModal(EModalRoutes.DiscoveryModal, {
        screen:
          tabIndex === 0
            ? EDiscoveryModalRoutes.BookmarkListModal
            : EDiscoveryModalRoutes.HistoryListModal,
      });
    },
    [navigation],
  );

  useListenTabFocusState(ETabRoutes.Discovery, (isFocus) => {
    if (isFocus) {
      void refreshBrowserBookmark();
      void refreshBrowserHistory();
    }
  });

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
        <YStack p="$2" alignItems="center" justifyContent="center" />
        <Tab
          data={data}
          initialScrollIndex={0}
          ListHeaderComponent={
            <DashboardHeader
              banners={result?.banners}
              bookmarkData={bookmarkData}
              historyData={historyData}
              handleHeaderMorePress={handleHeaderMorePress}
              handleSearchBarPress={handleSearchBarPress}
            />
          }
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

export default withBrowserProvider(Dashboard);
