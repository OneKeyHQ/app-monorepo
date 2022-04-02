import React, {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { ListRenderItem, useWindowDimensions } from 'react-native';

import {
  Box,
  Empty,
  FlatList,
  Image,
  Pressable,
  Spinner,
  Typography,
  useIsVerticalLayout,
  useLocale,
} from '@onekeyhq/components';
import IconWifi from '@onekeyhq/kit/assets/3d_wifi.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import DAppIcon from '../DAppIcon';
import { imageUrl, requestRankings, requestSync } from '../Service';
// import { rankingDataMock, syncDataMock } from '../Service/MockData';
import { DAppItemType, RankingsPayload, SyncRequestPayload } from '../type';

import CardView from './CardView';
import DiscoverIOS from './DiscoverIOS';
import ListView from './ListView';
import { SectionDataType, SectionType } from './type';

const whiteList: { title: string; type: SectionType }[] = [
  { title: 'NFTs', type: 'card' },
  { title: 'DeFi', type: 'list' },
];

const Banner: FC<SectionDataType> = ({ data }) => {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();
  const { width } = useWindowDimensions();
  const cardWidth = (width - 256 - 96) / 3;
  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item }) => {
      const url = imageUrl(item.pic ?? '');
      return (
        <Pressable onPress={() => {}}>
          <Box
            width={isSmallScreen ? '294px' : `${cardWidth}px`}
            height="100%"
            bgColor="surface-default"
            ml="16px"
            borderRadius="12px"
            padding="12px"
          >
            <Image
              width={isSmallScreen ? '270px' : `${cardWidth - 24}px`}
              height={isSmallScreen ? '134px' : '177px'}
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
              {item.description}
            </Typography.Caption>
          </Box>
        </Pressable>
      );
    },
    [cardWidth, isSmallScreen],
  );
  return (
    <Box width="100%" height={isSmallScreen ? '306px' : '349px'}>
      <Typography.PageHeading pl={isSmallScreen ? '16px' : '32px'}>
        {intl.formatMessage({
          id: 'title__explore',
        })}
      </Typography.PageHeading>
      <FlatList
        mt="32px"
        contentContainerStyle={{
          paddingLeft: isSmallScreen ? 0 : 16,
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

export const Discover = () => {
  const { locale } = useLocale();
  const [flatListData, updateFlatListData] = useState<SectionDataType[]>([]);
  const navigation = useNavigation();
  const intl = useIntl();
  const [pageStatus, setPageStatus] = useState<PageStatusType>('loading');

  useLayoutEffect(() => {
    if (platformEnv.isIOS) {
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
          return <Banner {...item} />;
        case 'card':
          return <CardView {...item} />;
        case 'list':
          return <ListView {...item} />;
        default:
          return null;
      }
    },
    [],
  );

  const generaListData = useCallback(
    (syncData: SyncRequestPayload, rankData: RankingsPayload) => {
      const listData: SectionDataType[] = [];
      const { increment, banners } = syncData;
      const { tags } = rankData;
      if (increment) {
        if (banners) {
          const dAppItems = banners.map((item) => {
            const dApp = increment[item.dapp];
            return { pic: item.pic, ...dApp };
          });
          listData.push({ type: 'banner', title: 'Explore', data: dAppItems });
        }
        if (tags.length > 0) {
          tags.forEach((item) => {
            const filter = whiteList.filter((i) => i.title === item.name);
            if (filter.length > 0) {
              const { dapps } = item;
              const dAppItems = dapps.map((i) => increment[i]);
              listData.push({
                type: filter[0].type,
                title: filter[0].title,
                data: dAppItems,
              });
            }
          });
        }
      }
      return listData;
    },
    [],
  );

  const getData = useCallback(() => {
    setPageStatus('loading');
    requestSync(0, locale)
      .then((response) => {
        requestRankings()
          .then((response2) => {
            setPageStatus('data');
            updateFlatListData(() => [
              ...generaListData(response.data, response2.data),
            ]);
          })
          .catch(() => {
            setPageStatus('network');
          });
      })
      .catch(() => {
        setPageStatus('network');
      });
  }, [generaListData, locale]);

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
          keyExtractor={(item, index) => `${item.type}${index}`}
        />
      ) : (
        <Box flex={1} flexDirection="column" justifyContent="center">
          {noData()}
        </Box>
      )}
    </Box>
  );
};

const Home = () => (platformEnv.isIOS ? <DiscoverIOS /> : <Discover />);

export default Home;
