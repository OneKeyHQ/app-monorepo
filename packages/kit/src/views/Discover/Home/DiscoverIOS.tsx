import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Center,
  Divider,
  Empty,
  FlatList,
  Icon,
  Image,
  Pressable,
  Spinner,
  Typography,
  useLocale,
} from '@onekeyhq/components';
import IconHistory from '@onekeyhq/kit/assets/3d_transaction_history.png';
import IconWifi from '@onekeyhq/kit/assets/3d_wifi.png';
import ExploreIMG from '@onekeyhq/kit/assets/explore.png';
import ExploreBG from '@onekeyhq/kit/assets/Explore_bg.png';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  updateRankData,
  updateSyncData,
} from '@onekeyhq/kit/src/store/reducers/discover';

import { useDiscover } from '../../../hooks/redux';
import { HomeRoutes, HomeRoutesParams } from '../../../routes/types';
import DAppIcon from '../DAppIcon';
import { MatchDAppItemType } from '../Explorer/Search/useSearchHistories';
import { requestRankings, requestSync } from '../Service';
import { DAppItemType } from '../type';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.ExploreScreen
>;

type PageStatusType = 'network' | 'loading' | 'data';

type DiscoverProps = {
  onItemSelect: (item: DAppItemType) => Promise<boolean>;
  onItemSelectHistory: (item: MatchDAppItemType) => void;
};
const DiscoverIOS: FC<DiscoverProps> = ({
  onItemSelect,
  onItemSelectHistory,
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { history, syncData } = useDiscover();
  const { locale } = useLocale();
  const [pageStatus, setPageStatus] = useState<PageStatusType>('loading');
  const { dispatch } = backgroundApiProxy;
  const [dappHistory, setDappHistory] = useState<MatchDAppItemType[]>([]);

  useEffect(() => {
    const dappHistoryArray: MatchDAppItemType[] = [];

    Object.entries(history).forEach(([key, value]) => {
      const dAppItem = {
        id: key,
        dapp: syncData.increment[key],
        webSite: value.webSite,
        clicks: value?.clicks ?? 0,
        timestamp: value?.timestamp ?? 0,
      };
      if (dAppItem) dappHistoryArray.push(dAppItem);
    });

    setDappHistory(
      dappHistoryArray.sort((a, b) => (b.timestamp ?? 0) - (a?.timestamp ?? 0)),
    );
  }, [history, syncData.increment]);

  const banner = useMemo(
    () => (
      <Pressable
        onPress={() => {
          navigation.navigate(HomeRoutes.ExploreScreen, { onItemSelect });
        }}
      >
        <Box width="100%" height="268px" shadow="depth.2">
          <Box
            justifyContent="center"
            width="100%"
            height="220px"
            bgColor="surface-default"
            borderRadius="12px"
            overflow="hidden"
          >
            <Image
              width="100%"
              height="220px"
              position="absolute"
              source={ExploreBG}
            />
            <Empty
              imageUrl={ExploreIMG}
              title={intl.formatMessage({
                id: 'title__explore_dapps',
              })}
              subTitle="https://explore.onekey.so →"
            />
          </Box>
          <Typography.Subheading color="text-subdued" mt="24px">
            {intl.formatMessage({
              id: 'transaction__history',
            })}
          </Typography.Subheading>
        </Box>
      </Pressable>
    ),
    [intl, navigation, onItemSelect],
  );

  const renderItem: ListRenderItem<MatchDAppItemType> = useCallback(
    ({ item, index }) => {
      const {
        favicon: dappFavicon,
        chain,
        name,
        url: dappUrl,
      } = item.dapp || {};

      const {
        favicon: webSiteFavicon,
        title,
        url: webSiteUrl,
      } = item.webSite || {};

      const itemTitle = () => {
        const itemName = name ?? title ?? 'Unknown';
        if (itemName.length > 24) {
          return `${itemName.slice(0, 24)}...`;
        }
        return itemName;
      };

      return (
        <Pressable
          onPress={() => {
            onItemSelectHistory(item);
          }}
        >
          <Box
            padding="16px"
            height="76px"
            width="100%"
            bgColor="surface-default"
            borderTopRadius={index === 0 ? '12px' : '0px'}
            borderRadius={index === dappHistory.length - 1 ? '12px' : '0px'}
          >
            <Box flexDirection="row" flex={1} alignItems="center">
              {(!!dappFavicon || item.dapp) && (
                <DAppIcon size={40} favicon={dappFavicon ?? ''} chain={chain} />
              )}

              {(!!webSiteFavicon || item.webSite) && (
                <Center
                  width="40px"
                  height="40px"
                  borderRadius="12px"
                  borderWidth="1px"
                  borderColor="border-subdued"
                >
                  <Image
                    width="36px"
                    height="36px"
                    src={webSiteFavicon ?? ''}
                    source={{ uri: webSiteFavicon }}
                    borderColor="border-subdued"
                    fallbackElement={
                      <Center w="40px" h="40px">
                        <Icon size={24} name="GlobeSolid" />
                      </Center>
                    }
                  />
                </Center>
              )}

              <Box
                flexDirection="column"
                ml="12px"
                justifyContent="center"
                flex={1}
              >
                <Typography.Body2Strong>{itemTitle()}</Typography.Body2Strong>
                <Typography.Caption color="text-subdued" numberOfLines={1}>
                  {dappUrl ?? webSiteUrl}
                </Typography.Caption>
              </Box>
            </Box>
          </Box>
        </Pressable>
      );
    },
    [dappHistory.length, onItemSelectHistory],
  );

  const getData = useCallback(() => {
    setPageStatus(
      Object.keys(syncData.increment).length > 0 ? 'data' : 'loading',
    );
    requestSync(0, locale)
      .then((response) => {
        if (response.data.timestamp > syncData.timestamp) {
          dispatch(updateSyncData(response.data));
        }
        setPageStatus('data');
        requestRankings().then((response2) => {
          dispatch(updateRankData(response2.data));
        });
      })
      .catch(() => {
        setPageStatus(
          Object.keys(syncData.increment).length > 0 ? 'data' : 'network',
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, locale]);

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
          px="16px"
          data={dappHistory}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <Divider />}
          keyExtractor={(item, index) => `Dapp history${item.id}${index}`}
          ListHeaderComponent={banner}
          ListEmptyComponent={
            <Empty
              imageUrl={IconHistory}
              title={intl.formatMessage({ id: 'title__no_history' })}
              subTitle={intl.formatMessage({ id: 'title__no_history_desc' })}
            />
          }
        />
      ) : (
        <Box flex={1} flexDirection="column" justifyContent="center">
          {noData()}
        </Box>
      )}
    </Box>
  );
};

export default DiscoverIOS;
