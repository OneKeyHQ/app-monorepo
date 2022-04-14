import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Divider,
  Empty,
  FlatList,
  Pressable,
  Spinner,
  Typography,
  useLocale,
} from '@onekeyhq/components';
import IconHistory from '@onekeyhq/kit/assets/3d_transaction_history.png';
import IconWifi from '@onekeyhq/kit/assets/3d_wifi.png';
import ExploreIMG from '@onekeyhq/kit/assets/explore.png';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { updateSyncData } from '@onekeyhq/kit/src/store/reducers/discover';

import { useDiscover } from '../../../hooks/redux';
import { HomeRoutes, HomeRoutesParams } from '../../../routes/types';
import DAppIcon from '../DAppIcon';
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
};
const DiscoverIOS: FC<DiscoverProps> = ({ onItemSelect }) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { history, syncData } = useDiscover();
  const { locale } = useLocale();
  const [pageStatus, setPageStatus] = useState<PageStatusType>('loading');
  const { dispatch } = backgroundApiProxy;
  const [dappHistory, setDappHistory] = useState<DAppItemType[]>([]);

  useEffect(() => {
    const dappHistoryArray: DAppItemType[] = [];

    Object.entries(history).forEach(([key]) => {
      const dAppItem = { ...syncData.increment[key], id: key };

      if (dAppItem) dappHistoryArray.push(dAppItem);
    });

    setDappHistory(
      dappHistoryArray.sort(
        (a, b) =>
          (history[b.id]?.timestamp ?? 0) - (history[a.id]?.timestamp ?? 0),
      ),
    );
  }, [history, syncData.increment]);

  const banner = useMemo(
    () => (
      <Pressable
        onPress={() => {
          navigation.navigate(HomeRoutes.ExploreScreen, { onItemSelect });
        }}
      >
        <Box width="100%" height="268px">
          <Box
            justifyContent="center"
            width="100%"
            height="220px"
            bgColor="surface-default"
            borderColor="border-subdued"
            borderRadius="12px"
            borderWidth={1}
          >
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

  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item, index }) => (
      <Pressable
        onPress={() => {
          onItemSelect(item);
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
            <DAppIcon size={40} favicon={item.favicon} chain={item.chain} />
            <Box
              flexDirection="column"
              ml="12px"
              justifyContent="center"
              flex={1}
            >
              <Typography.Body2Strong>{item.name}</Typography.Body2Strong>
              <Typography.Caption color="text-subdued" numberOfLines={1}>
                {item.subtitle}
              </Typography.Caption>
            </Box>
          </Box>
        </Box>
      </Pressable>
    ),
    [dappHistory.length, onItemSelect],
  );

  const getData = useCallback(() => {
    setPageStatus('loading');
    requestSync(0, locale)
      .then((response) => {
        dispatch(updateSyncData(response.data));
        requestRankings()
          .then(() => {
            setPageStatus('data');
          })
          .catch(() => {
            setPageStatus('network');
          });
      })
      .catch(() => {
        setPageStatus('network');
      });
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
