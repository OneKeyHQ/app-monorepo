/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { isNil } from 'lodash';

import {
  Badge,
  IconButton,
  Image,
  ListItem,
  ListView,
  Page,
  SearchBar,
  SectionList,
  SizableText,
  Skeleton,
  Stack,
  Tab,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { ETabRoutes } from '@onekeyhq/kit/src/routes/Tab/type';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import type {
  ICategory,
  IDApp,
  IDAppTag,
  IDiscoveryBanner,
} from '@onekeyhq/shared/types/discovery';

import { EDiscoveryModalRoutes } from '../../router/Routes';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type {
  IBrowserBookmark,
  IBrowserHistory,
  IMatchDAppItemType,
} from '../../types';

const RecommendListContainer = ({
  onContentSizeChange,
}: {
  onContentSizeChange: ((w: number, h: number) => void) | undefined;
}) => {
  const navigation = useAppNavigation();
  const { result: dataSource } = usePromiseResult(async () => {
    const data =
      await backgroundApiProxy.serviceDiscovery.fetchDiscoveryHomePageData();
    return data.categories.map((i) => ({ ...i, data: i.dapps })) ?? [];
  }, []);

  const { handleOpenWebSite } = useBrowserAction().current;

  return (
    <SectionList
      estimatedItemSize="$10"
      onContentSizeChange={onContentSizeChange}
      sections={isNil(dataSource) ? [] : dataSource}
      renderSectionHeader={({ section: { name } }) => (
        <Stack p="$3" bg="$bg">
          <SizableText size="$headingXs">{name}</SizableText>
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
          onPress={() => {
            handleOpenWebSite({
              navigation,
              dApp: item,
            });
          }}
        >
          {item.tags?.map((tag: IDAppTag) => (
            <Badge badgeType="success" badgeSize="sm">
              <SizableText>{tag.name}</SizableText>
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
    keyExtractor={(item) => item.categoryId}
    renderItem={({ item }) => (
      <ListItem
        onPress={() => setActiveId(item.categoryId)}
        bg={activeId === item.categoryId ? '$bgActive' : '$bg'}
      >
        <SizableText>{item.name}</SizableText>
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
  const navigation = useAppNavigation();
  const { handleOpenWebSite } = useBrowserAction().current;
  const [activeId, setActiveId] = useState('');
  const [dAppListDataSource, setDAppListDataSource] = useState<IDApp[]>([]);

  const { result: headerDataSource } = usePromiseResult(async () => {
    const data = await backgroundApiProxy.serviceDiscovery.fetchCategoryList();
    setActiveId(data[0].categoryId);
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
      setDAppListDataSource(dAppListResult?.data ?? []);
    }
  }, [dAppListResult?.data]);

  // const headerDataSource = useMemo(() => result ?? [], [result]);
  return (
    <ListView
      data={dAppListDataSource}
      estimatedItemSize="$10"
      ListHeaderComponent={
        <DiscoveryListHeader
          dataSource={isNil(headerDataSource) ? [] : headerDataSource}
          onContentSizeChange={onContentSizeChange}
          activeId={activeId}
          setActiveId={setActiveId}
        />
      }
      keyExtractor={(item) => item.dappId}
      renderItem={({ item }) => (
        <ListItem
          avatarProps={{
            src: item.logo ?? item.originLogo,
            fallbackProps: {
              children: <Skeleton w="$10" h="$10" />,
            },
          }}
          title={item.name}
          onPress={() => {
            handleOpenWebSite({ navigation, dApp: item });
          }}
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
  handleOpenWebsite,
}: {
  banners?: IDiscoveryBanner[];
  bookmarkData?: IBrowserBookmark[];
  historyData?: IBrowserHistory[];
  handleSearchBarPress: () => void;
  handleOpenWebsite: ({ dApp, webSite }: IMatchDAppItemType) => void;
  handleHeaderMorePress: (tabIndex: number) => void;
}) {
  const [tabIndex, setTabIndex] = useState(0);
  const bookmarks = useMemo(() => bookmarkData ?? [], [bookmarkData]);
  const histories = useMemo(() => historyData ?? [], [historyData]);
  return (
    <Stack p="$4">
      <SizableText size="$headingXl" py="$2">
        探索DApp
      </SizableText>
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
        <SizableText size="$headingXl">Banner</SizableText>
        {banners?.map((banner, index) => (
          <Image
            key={`${banner.src}-${index}`}
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
            onPress={() => {
              handleOpenWebsite({
                webSite: {
                  url: item.url,
                  title: item.title,
                },
              });
            }}
          >
            <ListItem.Avatar
              src={item.logo}
              fallbackProps={{
                children: <Skeleton w="$10" h="$10" />,
              }}
              circular
            />
            <SizableText
              flex={1}
              minHeight="$8"
              numberOfLines={1}
              mt="$2"
              color="$text"
              size="$bodyMd"
            >
              {item.title}
            </SizableText>
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
  const { handleOpenWebSite } = useBrowserAction().current;
  const { result: bookmarkData, run: refreshBrowserBookmark } =
    usePromiseResult(
      async () =>
        backgroundApiProxy.serviceDiscovery.getBookmarkData({
          generateIcon: true,
          sliceCount: 8,
        }),
      [],
    );

  const { result: historyData, run: refreshBrowserHistory } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceDiscovery.getHistoryData({
        generateIcon: true,
        sliceCount: 8,
      }),
    [],
  );

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
      // Execute the `usePromiseResult` in the nextTick because the focus state may not have been updated.
      setTimeout(() => {
        void refreshBrowserBookmark();
        void refreshBrowserHistory();
      });
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
              handleOpenWebsite={({ dApp, webSite }) =>
                handleOpenWebSite({
                  navigation,
                  dApp,
                  webSite,
                })
              }
            />
          }
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
