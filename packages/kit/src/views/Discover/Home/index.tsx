import React, {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/core';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { ListRenderItem, useWindowDimensions } from 'react-native';

import {
  Box,
  Empty,
  FlatList,
  NetImage,
  Pressable,
  Spinner,
  Typography,
  useIsVerticalLayout,
  useLocale,
} from '@onekeyhq/components';
import IconWifi from '@onekeyhq/kit/assets/3d_wifi.png';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import {
  updateRankData,
  updateSyncData,
} from '@onekeyhq/kit/src/store/reducers/discover';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useDiscover } from '../../../hooks/redux';
import DAppIcon from '../DAppIcon';
import { MatchDAppItemType } from '../Explorer/Search/useSearchHistories';
import { imageUrl, requestRankings, requestSync } from '../Service';
import { DAppItemType, RankingsPayload, SyncRequestPayload } from '../type';

import CardView from './CardView';
import DiscoverNative from './DiscoverNative';
import ListView from './ListView';

import type { SectionDataType } from './type';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.ExploreScreen>;

type DiscoverProps = {
  onItemSelect: (item: DAppItemType) => Promise<boolean>;
  onItemSelectHistory: (item: MatchDAppItemType) => Promise<boolean>;
};

const Banner: FC<SectionDataType> = ({ data, onItemSelect }) => {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();
  const { width } = useWindowDimensions();
  const cardWidth = (width - 256 - 96) / 3;
  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item }) => {
      const url = imageUrl(item.pic ?? '');
      return (
        <Box
          padding="8px"
          justifyContent="center"
          alignItems="center"
          width={isSmallScreen ? '310px' : `${cardWidth + 16}px`}
          height={isSmallScreen ? '258px' : `285px`}
        >
          <Pressable
            onPress={() => {
              if (onItemSelect) {
                onItemSelect(item);
              }
            }}
            width={isSmallScreen ? '294px' : `${cardWidth}px`}
            height="100%"
            bgColor="surface-default"
            borderRadius="12px"
            padding="12px"
            borderWidth={1}
            borderColor="border-subdued"
            _hover={{
              bg: 'surface-hovered',
            }}
          >
            <NetImage
              width={isSmallScreen ? 270 : cardWidth}
              height={isSmallScreen ? 134 : 177}
              uri={url}
              borderRadius={12}
            />
            <Box mt="12px" flexDirection="row" alignItems="center">
              <DAppIcon size={28} favicon={item.favicon} chain={item.chain} />
              <Typography.Body2Strong ml="10px">
                {item.name}
              </Typography.Body2Strong>
            </Box>
            <Typography.Caption
              mt="12px"
              color="text-subdued"
              numberOfLines={2}
            >
              {item.subtitle}
            </Typography.Caption>
          </Pressable>
        </Box>
      );
    },
    [cardWidth, isSmallScreen, onItemSelect],
  );
  return (
    <Box width="100%" height={isSmallScreen ? '306px' : '349px'}>
      <Typography.PageHeading pl={isSmallScreen ? '16px' : '32px'}>
        {intl.formatMessage({
          id: 'title__explore',
        })}
      </Typography.PageHeading>
      <FlatList
        mt="24px"
        contentContainerStyle={{
          paddingLeft: isSmallScreen ? 8 : 24,
          paddingRight: 16,
        }}
        showsHorizontalScrollIndicator={false}
        horizontal
        data={data}
        renderItem={renderItem}
        keyExtractor={(item, index) => `Banner${index}`}
      />
    </Box>
  );
};

type PageStatusType = 'network' | 'loading' | 'data';

export const Discover: FC<DiscoverProps> = ({
  onItemSelect: propOnItemSelect,
  ...rest
}) => {
  let onItemSelect: ((item: DAppItemType) => Promise<boolean>) | undefined;
  const route = useRoute<RouteProps>();
  if (platformEnv.isNative) {
    const { onItemSelect: routeOnItemSelect } = route.params;
    onItemSelect = routeOnItemSelect;
  } else {
    onItemSelect = propOnItemSelect;
  }

  const { locale } = useLocale();
  const [flatListData, updateFlatListData] = useState<SectionDataType[]>([]);
  const navigation = useNavigation();
  const intl = useIntl();
  const { dispatch } = backgroundApiProxy;
  const { syncData, rankData } = useDiscover();
  const [pageStatus, setPageStatus] = useState<PageStatusType>(
    rankData && rankData.tags.length > 0 ? 'data' : 'loading',
  );

  useLayoutEffect(() => {
    if (platformEnv.isNative) {
      navigation.setOptions({
        title: intl.formatMessage({
          id: 'title__explore',
        }),
      });
    }
  }, [navigation, intl]);

  const callback = useCallback(
    (item: DAppItemType) => {
      // iOS 弹窗无法展示在 modal 上面并且页面层级多一层，提前返回一层。
      if (platformEnv.isNative) {
        navigation.goBack();
      }
      return onItemSelect?.(item) ?? Promise.resolve(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onItemSelect],
  );

  const renderItem: ListRenderItem<SectionDataType> = useCallback(
    ({ item }) => {
      switch (item.type) {
        case 'banner':
          return <Banner {...item} {...rest} onItemSelect={callback} />;
        case 'card':
          return <CardView {...item} {...rest} onItemSelect={callback} />;
        case 'list':
          return <ListView {...item} {...rest} onItemSelect={callback} />;
        default:
          return null;
      }
    },
    [callback, rest],
  );

  const generaListData = useCallback(
    (
      syncResponceData: SyncRequestPayload,
      rankResponceData: RankingsPayload,
    ) => {
      const listData: SectionDataType[] = [];
      const { increment, banners } = syncResponceData;
      const { tags, special } = rankResponceData;
      if (increment) {
        if (banners) {
          const dAppItems = banners.map((item) => {
            const dApp = increment[item.dapp];
            return { pic: item.pic, ...dApp, id: item.dapp };
          });
          listData.push({ type: 'banner', title: 'Explore', data: dAppItems });
        }
        const newTags = [
          {
            name: intl.formatMessage({ id: 'title__leaderboard' }),
            dapps: special.daily,
          },
          {
            name: intl.formatMessage({ id: 'title__newly_added' }),
            dapps: special.new,
          },
          ...tags,
        ];

        newTags.forEach((item) => {
          const { dapps } = item;
          const dAppItems = dapps.map((key) => ({
            ...increment[key],
            id: key,
          }));
          if (dAppItems.length > 0) {
            listData.push({
              type: listData.length % 2 === 1 ? 'card' : 'list',
              title: item.name,
              data: dAppItems,
            });
          }
        });
      }
      return listData;
    },
    [],
  );

  const getData = useCallback(() => {
    if (rankData && rankData.tags.length > 0) {
      setPageStatus('data');
      updateFlatListData(() => [...generaListData(syncData, rankData)]);
    } else {
      setPageStatus('loading');
    }
    if (platformEnv.isNative) {
      requestRankings()
        .then((response2) => {
          setPageStatus('data');
          dispatch(updateRankData(response2.data));
          updateFlatListData(() => [
            ...generaListData(syncData, response2.data),
          ]);
        })
        .catch(() => {
          setPageStatus(rankData ? 'data' : 'network');
        });
    } else {
      requestSync(0, locale)
        .then((response) => {
          if (response.data.timestamp > syncData.timestamp) {
            dispatch(updateSyncData(response.data));
          }
          requestRankings()
            .then((response2) => {
              setPageStatus('data');
              dispatch(updateRankData(response2.data));
              updateFlatListData(() => [
                ...generaListData(response.data, response2.data),
              ]);
            })
            .catch(() => {
              setPageStatus(rankData ? 'data' : 'network');
            });
        })
        .catch(() => {
          setPageStatus(rankData ? 'data' : 'network');
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, generaListData, locale]);

  const noData = () => {
    switch (pageStatus) {
      case 'network':
        return (
          <Empty
            imageUrl={IconWifi}
            title={intl.formatMessage({ id: 'title__no_connection' })}
            subTitle={intl.formatMessage({
              id: 'title__no_connection_desc',
            })}
            actionTitle={intl.formatMessage({
              id: 'action__retry',
            })}
            handleAction={() => getData()}
          />
        );
      case 'loading':
        return <Spinner size="sm" />;
      default:
        return null;
    }
  };
  useEffect(() => {
    getData();
  }, [getData]);

  return (
    <Box flex="1" bg="background-default">
      {pageStatus === 'data' ? (
        <FlatList
          contentContainerStyle={{
            paddingBottom: 24,
            paddingTop: 24,
          }}
          data={flatListData}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.type ?? ''}${index}`}
        />
      ) : (
        <Box flex={1} flexDirection="column" justifyContent="center">
          {noData()}
        </Box>
      )}
    </Box>
  );
};

const Home: FC<DiscoverProps> = ({ ...rest }) =>
  platformEnv.isNative ? <DiscoverNative {...rest} /> : <Discover {...rest} />;

export default Home;
