import { FC, useCallback, useEffect, useLayoutEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { ListRenderItem, useWindowDimensions } from 'react-native';

import {
  Box,
  Center,
  Empty,
  FlatList,
  NetImage,
  Pressable,
  Spinner,
  Typography,
  useIsVerticalLayout,
  useLocale,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  updateRankData,
  updateSyncData,
} from '@onekeyhq/kit/src/store/reducers/discover';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import DAppIcon from '../DAppIcon';
import { MatchDAppItemType } from '../Explorer/explorerUtils';
import { imageUrl, requestRankings, requestSync } from '../Service';
import { DAppItemType, RankingsPayload, SyncRequestPayload } from '../type';

import CardView from './CardView';
import ListView from './ListView';

import type { SectionDataType } from './type';

interface DiscoverProps {
  onItemSelect: (item: DAppItemType) => void;
  onItemSelectHistory: (item: MatchDAppItemType) => void;
}

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
          height={isSmallScreen ? '258px' : `285px`}
        >
          <Pressable
            onPress={() => {
              if (onItemSelect) {
                onItemSelect(item);
              }
            }}
            width={isSmallScreen ? 294 : cardWidth}
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
              width={isSmallScreen ? 270 : cardWidth - 24}
              height={isSmallScreen ? 134 : 177}
              src={url}
              borderRadius="12px"
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

const DiscoverHome: FC<DiscoverProps> = (props) => {
  const { locale } = useLocale();
  const navigation = useNavigation();
  const intl = useIntl();
  const { dispatch } = backgroundApiProxy;
  useLayoutEffect(() => {
    if (platformEnv.isNative) {
      navigation.setOptions({
        title: intl.formatMessage({
          id: 'title__explore',
        }),
      });
    }
  }, [navigation, intl]);

  const renderItem: ListRenderItem<SectionDataType> = useCallback(
    ({ item }) => {
      switch (item.type) {
        case 'banner':
          return <Banner {...item} {...props} />;
        case 'card':
          return <CardView {...item} {...props} />;
        case 'list':
          return <ListView {...item} {...props} />;
        default:
          return null;
      }
    },
    [props],
  );

  const generaListData = useCallback(
    (
      syncResponceData?: SyncRequestPayload,
      rankResponceData?: RankingsPayload,
    ) => {
      if (syncResponceData && rankResponceData) {
        const listData: SectionDataType[] = [];
        const { increment, banners } = syncResponceData;
        const { tags, special } = rankResponceData;
        if (increment) {
          if (banners) {
            const dAppItems = banners.map((item) => {
              const dApp = increment[item.dapp];
              return { pic: item.pic, ...dApp, id: item.dapp };
            });
            listData.push({
              type: 'banner',
              title: 'Explore',
              data: dAppItems,
            });
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
      }
      return [];
    },
    [intl],
  );

  const [flatListData, updateFlatListData] = useState<SectionDataType[]>([]);

  const [loading, setLoading] = useState<boolean>();
  const getData = useCallback(async () => {
    setLoading(true);
    const [syncDataResult, rankDataResult] = await Promise.all([
      requestSync(0, locale),
      requestRankings(),
    ]);
    setLoading(false);

    if (syncDataResult && rankDataResult) {
      dispatch(updateSyncData(syncDataResult), updateRankData(rankDataResult));
      updateFlatListData(() => generaListData(syncDataResult, rankDataResult));
    } else {
      updateFlatListData(() => []);
    }
  }, [dispatch, generaListData, locale]);

  useEffect(() => {
    getData();
  }, [getData]);

  return (
    <Box flex="1" bg="background-default">
      {loading ? (
        <Center flex={1}>
          <Spinner size="sm" />
        </Center>
      ) : (
        <FlatList
          contentContainerStyle={{
            paddingBottom: 24,
            paddingTop: 24,
          }}
          data={flatListData}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.type ?? ''}${index}`}
          ListEmptyComponent={
            <Empty
              emoji="🌐"
              title={intl.formatMessage({ id: 'title__no_connection' })}
              subTitle={intl.formatMessage({
                id: 'title__no_connection_desc',
              })}
              actionTitle={intl.formatMessage({
                id: 'action__retry',
              })}
              handleAction={() => getData()}
            />
          }
        />
      )}
    </Box>
  );
};

export default DiscoverHome;
