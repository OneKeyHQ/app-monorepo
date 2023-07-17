import { type FC, useCallback, useContext, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, Icon, Pressable, Typography } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigation } from '../../../../hooks';
import { getAppNavigation } from '../../../../hooks/useAppNavigation';
import {
  HomeRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../../routes/routesEnum';
import { GasPanelRoutes } from '../../../GasPanel/types';
import { GasPrice } from '../../components/GasPrice';
import { HistoryFavicon } from '../../components/HistoryFavicon';
import { useUserBrowserHistories } from '../../hooks';
import { DiscoverModalRoutes } from '../../type';
import { DiscoverContext } from '../context';

import type { HomeRoutesParams } from '../../../../routes/types';
import type { MatchDAppItemType } from '../../Explorer/explorerUtils';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RecentHistoryItemProps = {
  item: MatchDAppItemType;
};

const RecentHistoryItem: FC<RecentHistoryItemProps> = ({ item }) => {
  const logoURL = item.dapp?.logoURL || item.webSite?.favicon || '';
  const name = item.dapp?.name || item.webSite?.title || '';
  const url = item.dapp?.url || item.webSite?.url || '';
  const { onItemSelectHistory } = useContext(DiscoverContext);
  const onPress = useCallback(() => {
    onItemSelectHistory({
      id: item.id,
      webSite: { title: name, url, favicon: logoURL },
    });
  }, [onItemSelectHistory, logoURL, name, url, item.id]);
  return (
    <Pressable onPress={onPress}>
      <Box
        py="2"
        px="3"
        borderRadius={12}
        justifyContent="center"
        alignItems="center"
      >
        <HistoryFavicon logoURL={logoURL} url={url} />
        <Typography.Caption w="12" numberOfLines={1} textAlign="center">
          {name ?? 'Unknown'}
        </Typography.Caption>
      </Box>
    </Pressable>
  );
};

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.DAppListScreen
>;

export const BrowserShortcuts: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const histories = useUserBrowserHistories();
  const { onItemSelectHistory } = useContext(DiscoverContext);
  const items = useMemo(() => histories.slice(0, 8), [histories]);
  const onNavigation = useCallback(
    (itemSource: string) => {
      if (platformEnv.isNative) {
        getAppNavigation().navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Discover,
          params: {
            screen: DiscoverModalRoutes.MyDAppListModal,
            params: {
              onItemSelect: onItemSelectHistory,
              defaultIndex: itemSource === 'Favorites' ? 0 : 1,
            },
          },
        });
      } else {
        navigation.navigate(HomeRoutes.MyDAppListScreen, {
          onItemSelect: onItemSelectHistory,
          defaultIndex: itemSource === 'Favorites' ? 0 : 1,
        });
      }
    },
    [navigation, onItemSelectHistory],
  );
  const onFav = useCallback(() => {
    onNavigation('Favorites');
  }, [onNavigation]);
  const onHistory = useCallback(() => {
    onNavigation('History');
  }, [onNavigation]);
  const onGas = useCallback(() => {
    getAppNavigation().navigate(RootRoutes.Modal, {
      screen: ModalRoutes.GasPanel,
      params: {
        screen: GasPanelRoutes.GasPanelModal,
        params: {
          networkId: '',
        },
      },
    });
  }, []);
  return (
    <Box w="full" flexDirection="row" mt="8" flexWrap="wrap">
      {items.slice(0, 4).map((item) => (
        <Center w="1/4" key={item.id} mb="4">
          <RecentHistoryItem item={item} />
        </Center>
      ))}
      <Center w="1/4" mb="4">
        <Pressable alignItems="center" onPress={onFav}>
          <Center
            w="12"
            h="12"
            borderRadius={12}
            borderColor="border-subdued"
            borderWidth={0.5}
            bg="surface-subdued"
          >
            <Icon name="StarMini" />
          </Center>
          <Box mt="2">
            <Typography.Caption>
              {intl.formatMessage({ id: 'title__favorite' })}
            </Typography.Caption>
          </Box>
        </Pressable>
      </Center>
      <Center w="1/4" mb="4">
        <Pressable alignItems="center" onPress={onHistory}>
          <Center
            w="12"
            h="12"
            borderRadius={12}
            borderColor="border-subdued"
            borderWidth={0.5}
            bg="surface-subdued"
          >
            <Icon name="ClockMini" />
          </Center>
          <Box mt="2">
            <Typography.Caption>
              {intl.formatMessage({ id: 'transaction__history' })}
            </Typography.Caption>
          </Box>
        </Pressable>
      </Center>
      <Center w="1/4" mb="4">
        <Pressable alignItems="center" onPress={onGas}>
          <GasPrice />
          <Box mt="2">
            <Typography.Caption>🔥Gas</Typography.Caption>
          </Box>
        </Pressable>
      </Center>
    </Box>
  );
};
